'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import TeacherNav from '../../../components/TeacherNav'
import { isTeacher, isOwner } from '../../../lib/roles'
import { loadTeachingScope } from '../../../lib/teaching'
import { NavIcon } from '../../../components/NavIcons'
import { HEADER_BG, PRIMARY, T, OK } from '../../../lib/adminTheme'
import { sendPushToUser } from '../../../lib/pushNotify'
import { useSpaceTheme } from '../../../lib/useFreshTheme'
import SpaceBg from '../../../components/SpaceBg'
import { ensureUserRow } from '../../../lib/ensureUserRow'

const DOW = ['일','월','화','수','목','금','토']

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function AdminAttendancePage() {
  const router = useRouter()
  const [user,        setUser]        = useState(null)
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [bookings,    setBookings]    = useState([])
  const [userNames,   setUserNames]   = useState({})
  const [loading,     setLoading]     = useState(true)
  const [toggling,    setToggling]    = useState({})
  const space = useSpaceTheme()

  // 출석은 bookings 한 행이 진실 — 관리자·담당 강사 누가 체크해도 같은 값을 본다.
  // 다른 사람이 체크한 결과가 이 화면에도 보이도록 포커스·주기적으로 다시 읽는다(silent).
  async function load(date, silent = false) {
    if (!silent) setLoading(true)
    const cols = 'id, user_id, course_id, schedule_id, class_name, class_time, attended, attended_at, status'
    const build = sel => supabase
      .from('bookings')
      .select(sel)
      .eq('class_date', date)
      .neq('status', 'cancelled')
      .order('class_time')

    // 강사는 자기 수업 출석만 — 오너는 전체
    let scope = null
    if (!isOwner(user)) {
      scope = await loadTeachingScope(user.id)
      if (!scope.hasAny) { setBookings([]); setUserNames({}); setLoading(false); return }
    }
    const run = async sel => {
      let q = build(sel)
      if (scope) q = q.in('course_id', scope.scopeCourseIds)
      return q
    }
    // attended_by 컬럼이 아직 없으면(migration-attended-by.sql 전) 조용히 기존 컬럼만
    let { data: bks, error: bErr } = await run(cols + ', attended_by')
    if (bErr) ({ data: bks } = await run(cols))

    // 내 수업이어도 그 타임이 다른 강사면 제외
    const list = scope ? (bks || []).filter(scope.isMine) : (bks || [])
    setBookings(list)

    const ids = [...new Set([...list.map(b => b.user_id), ...list.map(b => b.attended_by)].filter(Boolean))]
    if (ids.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids)
      const map = {}
      ;(users || []).forEach(u => { map[u.id] = u.name })
      setUserNames(map)
    } else {
      setUserNames({})
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (!isTeacher(data.user)) { router.push('/student'); return }
      await ensureUserRow(data.user)   // 행이 없으면 RLS 가 저장을 조용히 막는다
      setUser(data.user)
    })
  }, [])

  useEffect(() => {
    if (user) load(selectedDate)
  }, [user, selectedDate])

  // 다른 운영진이 체크한 결과를 반영 — 화면에 돌아올 때 + 보고 있는 동안 15초마다
  useEffect(() => {
    if (!user) return
    const refresh = () => { if (document.visibilityState === 'visible') load(selectedDate, true) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const t = setInterval(refresh, 15000)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(t)
    }
  }, [user, selectedDate])

  // 저장 — attended_by 컬럼이 없으면 빼고 다시 시도
  // ⚠️ 바뀐 행 수를 반드시 확인한다: 권한이 없으면 RLS 가 error 없이 0행만 바꾼다(조용한 무동작).
  //    예전엔 그래서 화면엔 체크됐다가 새로고침하면 풀려 있었다(2026-09-22 실사고).
  async function saveAttendance(ids, next, now) {
    const base = { attended: next, attended_at: next ? now : null }
    const verify = res => {
      if (res.error) return res.error
      const n = (res.data || []).length
      if (n < ids.length) return { message: `저장 권한이 없어요 (${n}/${ids.length}건). 로그아웃 후 다시 로그인해 보고, 계속 안 되면 오너에게 알려 주세요.` }
      return null
    }
    let res = await supabase.from('bookings').update({ ...base, attended_by: next ? user.id : null }).in('id', ids).select('id')
    if (res.error && /attended_by/.test(res.error.message || '')) {
      res = await supabase.from('bookings').update(base).in('id', ids).select('id')
      return { error: verify(res), update: base }
    }
    return { error: verify(res), update: { ...base, attended_by: next ? user.id : null } }
  }

  // 누르는 순간 서버의 최신 값 — 화면이 오래돼도 남이 이미 체크한 걸 되돌리거나 알림을 두 번 보내지 않게
  async function freshState(ids) {
    let { data, error } = await supabase.from('bookings').select('id, attended, attended_at, attended_by').in('id', ids)
    if (error) ({ data } = await supabase.from('bookings').select('id, attended, attended_at').in('id', ids))
    return Object.fromEntries((data || []).map(r => [r.id, r]))
  }

  // 출석 확정 시 학생에게 인앱 알림 + 웹푸시(구독한 경우)
  async function notifyAttendance(b) {
    const d = new Date(selectedDate + 'T00:00:00')
    const label = `${d.getMonth()+1}/${d.getDate()}(${DOW[d.getDay()]})`
    const body = `${label} ${b.class_name}${b.class_time ? ` ${b.class_time}` : ''} 출석이 확인됐어요! 냥밭 작물이 쑥 자라요 🌱`
    await supabase.from('notifications').insert({ user_id: b.user_id, type: 'attendance', title: '✅ 출석 확인', body })
    sendPushToUser(b.user_id, '✅ 출석 확인', body)
  }

  async function toggleAttended(b) {
    setToggling(prev => ({ ...prev, [b.id]: true }))
    const done = () => setToggling(prev => { const n = { ...prev }; delete n[b.id]; return n })
    const cur = (await freshState([b.id]))[b.id]
    // 화면은 미출석인데 이미 누군가 체크해 둔 경우 — 되돌리지 않고 보여 준다
    if (cur && cur.attended && !b.attended) {
      done()
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...cur } : x))
      await load(selectedDate, true)
      const who = cur.attended_by ? (cur.attended_by === user.id ? '내가' : `${userNames[cur.attended_by] || '다른 운영진'}님이`) : '다른 운영진이'
      alert(`이미 ${who} 출석 체크했어요 ✓`)
      return
    }
    const next = !(cur ? cur.attended : b.attended)
    // 저장 성공을 확인해야 냥밭 작물 성장(출석 개수 기반)이 확실히 반영된다.
    const { error, update } = await saveAttendance([b.id], next, new Date().toISOString())
    done()
    if (error) { alert('출석 저장에 실패했어요. 다시 시도해 주세요.\n' + (error.message || '')); return }
    if (next) notifyAttendance(b)
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...update } : x))
  }

  async function markAllAttended(grp) {
    const fresh = await freshState(grp.map(b => b.id))
    // 그 사이 다른 운영진이 체크한 학생은 빼야 알림이 두 번 가지 않는다
    const pending = grp.filter(b => !(fresh[b.id]?.attended ?? b.attended))
    if (!pending.length) { await load(selectedDate, true); return }
    const { error } = await saveAttendance(pending.map(b => b.id), true, new Date().toISOString())
    if (error) {
      alert('출석 저장에 실패했어요. 다시 시도해 주세요.\n' + (error.message || ''))
      await load(selectedDate) // 실제 저장 상태로 되돌림
      return
    }
    pending.forEach(b => notifyAttendance(b))
    await load(selectedDate, true)
  }

  function shift(delta) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(toDateStr(d))
  }

  // Group by class_name + class_time, preserve time order
  const groupMap = new Map()
  for (const b of bookings) {
    const key = `${b.class_time || ''}||${b.class_name || ''}`
    if (!groupMap.has(key)) groupMap.set(key, { class_name: b.class_name, class_time: b.class_time, items: [] })
    groupMap.get(key).items.push(b)
  }
  const groups = [...groupMap.values()].sort((a, b) => (a.class_time || '').localeCompare(b.class_time || ''))

  const d = new Date(selectedDate + 'T00:00:00')
  const todayStr = toDateStr(new Date())
  const isToday = selectedDate === todayStr
  const dateLabel = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}(${DOW[d.getDay()]})`

  if (!user) return null

  return (
    <>
      {space && <SpaceBg />}
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="check" color="#fff" size={20} />
          <span className="header-title">출석 체크</span>
        </div>
      </div>

      <div style={{ background: 'var(--page)', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px', minHeight:'80vh' }}>

        {/* Date nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:18, marginBottom:20 }}>
          <button onClick={() => shift(-1)}
            style={{ width:36, height:36, borderRadius:'50%', background: T.navBg, border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#5c6b5f', fontFamily:'Nunito,sans-serif' }}>
            ‹
          </button>
          <div style={{ textAlign:'center', minWidth:96 }}>
            <div style={{ fontSize:16, fontWeight:800, color: T.text }}>{dateLabel}</div>
            {isToday && <div style={{ fontSize:10, color: OK.main, fontWeight:700, marginTop:1 }}>오늘</div>}
          </div>
          <button onClick={() => shift(1)}
            style={{ width:36, height:36, borderRadius:'50%', background: T.navBg, border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#5c6b5f', fontFamily:'Nunito,sans-serif' }}>
            ›
          </button>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
            <span style={{ fontSize:30 }}>🐱</span>
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign:'center', padding:56, color: T.mut, fontSize:13 }}>
            이 날 예약이 없어요 🐾
          </div>
        ) : (
          groups.map(({ class_name, class_time, items: grp }) => {
            const key = `${class_time}||${class_name}`
            const attendedCnt = grp.filter(b => b.attended).length
            const allDone = attendedCnt === grp.length

            return (
              <div key={key} style={{ marginBottom:22 }}>
                {/* Group header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, padding:'0 2px' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color: T.text, letterSpacing:'-0.2px' }}>{class_name}</div>
                    <div style={{ fontSize:11, color: T.mut, marginTop:1 }}>
                      {class_time} &nbsp;·&nbsp;
                      <span style={{ color: attendedCnt > 0 ? OK.tx : T.mut, fontWeight:700 }}>
                        {attendedCnt}/{grp.length}명 출석
                      </span>
                    </div>
                  </div>
                  <button onClick={() => markAllAttended(grp)} disabled={allDone}
                    style={{ padding:'7px 14px', background: allDone ? T.navBg : PRIMARY, color: allDone ? T.mut : '#fff', border:'none', borderRadius:11, fontSize:11, fontWeight:700, cursor: allDone ? 'default' : 'pointer', fontFamily:'Nunito,sans-serif', opacity: allDone ? 0.7 : 1 }}>
                    {allDone ? '전원 ✓' : '전원 출석'}
                  </button>
                </div>

                {/* Student rows */}
                <div style={{ borderRadius:16, border:`0.5px solid ${T.card}`, overflow:'hidden', background:'var(--surf)' }}>
                  {grp.map((b, idx) => {
                    const name = userNames[b.user_id] || '학생'
                    const attended = !!b.attended
                    const busy = !!toggling[b.id]

                    return (
                      <div key={b.id} onClick={() => !busy && toggleAttended(b)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', cursor:'pointer', background: attended ? '#F1F8EC' : 'var(--surf)', borderTop: idx === 0 ? 'none' : `0.5px solid ${T.line}`, opacity: busy ? 0.55 : 1, transition:'background 0.12s' }}>

                        {/* Avatar */}
                        <div style={{ width:38, height:38, borderRadius:'50%', background: attended ? OK.soft : T.navBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color: attended ? OK.tx : T.mut, flexShrink:0, transition:'all 0.12s' }}>
                          {name[0] || '?'}
                        </div>

                        {/* Name */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color: attended ? OK.tx : T.text }}>{name}</div>
                          {attended && (b.attended_by || b.attended_at) && (
                            <div style={{ fontSize:10.5, fontWeight:700, color: OK.tx, opacity:0.8, marginTop:2 }}>
                              ✓ {b.attended_by ? (b.attended_by === user.id ? '내가' : `${userNames[b.attended_by] || '운영진'}`) : ''} 체크
                              {b.attended_at ? ` · ${new Date(b.attended_at).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}` : ''}
                            </div>
                          )}
                        </div>

                        {/* Toggle circle */}
                        <div style={{ width:34, height:34, borderRadius:'50%', background: attended ? OK.main : 'var(--surf)', border: `2px solid ${attended ? OK.main : 'rgba(0,0,0,0.12)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                          {attended
                            ? <span style={{ color:'#fff', fontSize:17, lineHeight:1 }}>✓</span>
                            : <div style={{ width:11, height:11, borderRadius:'50%', background:'#d5d3ca' }}/>
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {isOwner(user) ? <AdminNav active="attendance" /> : <TeacherNav active="attendance" />}
    </>
  )
}
