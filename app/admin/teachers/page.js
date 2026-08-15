'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import { isOwner } from '../../../lib/roles'
import { HEADER_BG, T, OK, BAD } from '../../../lib/adminTheme'
import { useSpaceTheme } from '../../../lib/useFreshTheme'
import SpaceBg from '../../../components/SpaceBg'

// 강사 관리 — 오너 전용.
// 여기서 하는 일: 강사 가입 승인 · 담당 수업 지정 · 타임별 담당 지정 · 담당 현황 확인.
// ⚠️ 담당 지정이 비어 있으면 그 강사는 강사 화면이 텅 비고 알림도 못 받는다
//    (담당 학생·출석·기록 필터·알림 라우팅이 전부 이 지정에서 파생되므로).
const DOW = ['일','월','화','수','목','금','토']
const BORDER = 'var(--line)'

export default function AdminTeachersPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [courses, setCourses] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [busy, setBusy] = useState({})
  const space = useSpaceTheme()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (!isOwner(data.user)) { router.push('/student'); return }   // 강사는 접근 불가
      setUser(data.user)
      loadAll()
    })
  }, [])

  async function loadAll() {
    const [{ data: us }, { data: cs }, { data: bs }] = await Promise.all([
      supabase.from('users').select('id, name, phone, role, approved').in('role', ['admin', 'teacher']).order('name'),
      supabase.from('class_courses').select('id, name, category, is_active, teacher_id, class_schedules(id, day_of_week, start_time, end_time, teacher_id)').order('name'),
      supabase.from('bookings').select('user_id, course_id, schedule_id').neq('status', 'cancelled'),
    ])
    setTeachers(us || [])
    setCourses(cs || [])
    setBookings(bs || [])
    setLoading(false)
  }

  // 강사 승인 — auth 메타까지 갱신해야 로그인이 열린다(서버 라우트 경유)
  async function approve(id) {
    setBusy(p => ({ ...p, [id]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/approve-teacher', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, approved: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert('승인 실패: ' + (json.error || res.status)); return }
      setTeachers(prev => prev.map(t => t.id === id ? { ...t, approved: true } : t))
    } finally { setBusy(p => { const n = { ...p }; delete n[id]; return n }) }
  }

  // 수업 담당 지정/해제
  async function setCourseTeacher(courseId, teacherId) {
    const { error } = await supabase.from('class_courses').update({ teacher_id: teacherId }).eq('id', courseId)
    if (error) { alert('저장 실패: ' + error.message); return }
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, teacher_id: teacherId } : c))
  }

  // 타임별 담당 지정/해제 (비우면 수업 담당을 따름)
  async function setScheduleTeacher(courseId, schedId, teacherId) {
    const { error } = await supabase.from('class_schedules').update({ teacher_id: teacherId }).eq('id', schedId)
    if (error) { alert('저장 실패: ' + error.message + '\n\nclass_schedules.teacher_id 컬럼이 없으면 migration-schedule-teacher.sql 을 먼저 실행해 주세요.'); return }
    setCourses(prev => prev.map(c => c.id !== courseId ? c : {
      ...c, class_schedules: (c.class_schedules || []).map(s => s.id === schedId ? { ...s, teacher_id: teacherId } : s),
    }))
  }

  // 이 강사가 담당인 수업/타임 (타임 지정이 있으면 그것이 우선)
  function scopeOf(tid) {
    const myCourses = courses.filter(c => c.teacher_id === tid)
    const mySlots = courses.flatMap(c => (c.class_schedules || []).filter(s => s.teacher_id === tid).map(s => ({ ...s, course: c })))
    const excluded = new Set(courses.flatMap(c => (c.class_schedules || []).filter(s => s.teacher_id && s.teacher_id !== tid).map(s => s.id)))
    const ownedSlot = new Set(mySlots.map(s => s.id))
    const courseIds = myCourses.map(c => c.id)
    const students = new Set(bookings.filter(b => {
      if (b.schedule_id && ownedSlot.has(b.schedule_id)) return true
      if (b.schedule_id && excluded.has(b.schedule_id)) return false
      return courseIds.includes(b.course_id)
    }).map(b => b.user_id).filter(Boolean))
    return { myCourses, mySlots, students: students.size }
  }

  if (loading) return null

  const q = search.trim().toLowerCase()
  const list = q ? teachers.filter(t => (t.name || '').toLowerCase().includes(q) || (t.phone || '').includes(q)) : teachers
  const pending = list.filter(t => t.role === 'teacher' && t.approved === false)
  const active = list.filter(t => !(t.role === 'teacher' && t.approved === false))

  const card = { background:'var(--card)', border:`1.5px solid ${BORDER}`, borderRadius:14, padding:'13px 14px', marginBottom:9 }
  const chip = on => ({ padding:'5px 10px', borderRadius:9, border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif',
    fontSize:10.5, fontWeight:800, background: on ? 'var(--ac)' : 'var(--g1)', color: on ? '#fff' : 'var(--tm)' })

  return (
    <>
      {space && <SpaceBg />}
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="profile" color="#fff" size={20} />
          <span className="header-title">강사 관리</span>
        </div>
      </div>

      <div style={{ background: space ? 'transparent' : '#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 90px', minHeight:'80vh' }}>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="강사명 / 연락처 검색"
          style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:`1.5px solid ${BORDER}`, fontSize:13, background:'var(--g1)', fontFamily:'Nunito,sans-serif', marginBottom:14, boxSizing:'border-box', outline:'none' }}/>

        {/* 승인 대기 */}
        {pending.length > 0 && (
          <div style={{ background:'#FFF8E1', border:'1.5px solid #FFE082', borderRadius:14, padding:'12px 13px', marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#8a6d00', marginBottom:8 }}>🧑‍🏫 가입 승인 대기 {pending.length}명</div>
            {pending.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, background:'#fff', border:'1px solid #FFE082', borderRadius:11, padding:'9px 11px', marginBottom:6 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{t.name || '이름 없음'}</div>
                  <div style={{ fontSize:10, color:'var(--tmu)' }}>{t.phone || '연락처 없음'}</div>
                </div>
                <button onClick={() => approve(t.id)} disabled={busy[t.id]}
                  style={{ flexShrink:0, border:'none', background:'#2e7d32', color:'#fff', borderRadius:9, padding:'7px 13px', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: busy[t.id] ? 0.6 : 1 }}>
                  {busy[t.id] ? '처리 중…' : '승인'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10 }}>총 {active.length}명</div>

        {active.map(t => {
          const scope = scopeOf(t.id)
          const open = expanded === t.id
          const owner = t.role === 'admin'
          return (
            <div key={t.id} style={{ ...card, borderColor: open ? 'var(--ac)' : BORDER, background: open ? 'var(--acBg)' : 'var(--card)' }}>
              <div onClick={() => setExpanded(open ? null : t.id)} style={{ display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:'var(--g1)', border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <NavIcon name="profile" color="var(--tm)" size={20} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <span style={{ fontSize:13.5, fontWeight:800, color:'var(--td)' }}>{t.name || '이름 없음'}</span>
                    <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:7,
                      background: owner ? OK.soft : 'var(--acBg)', color: owner ? OK.tx : 'var(--acTx)' }}>
                      {owner ? '오너·강사' : '강사'}
                    </span>
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--tmu)' }}>{t.phone || '연락처 없음'}</div>
                  <div style={{ fontSize:10.5, color:'var(--tm)', marginTop:3, fontWeight:700 }}>
                    담당 수업 {scope.myCourses.length}개
                    {scope.mySlots.length > 0 && ` · 타임 ${scope.mySlots.length}개`}
                    {` · 담당 회원 ${scope.students}명`}
                  </div>
                </div>
                <span style={{ fontSize:16, color:'var(--tmu)', flexShrink:0 }}>{open ? '▾' : '›'}</span>
              </div>

              {open && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px dashed ${BORDER}` }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--td)', marginBottom:8 }}>담당 수업 지정</div>
                  {courses.length === 0 ? (
                    <div style={{ fontSize:11, color:'var(--tmu)' }}>개설된 수업이 없어요</div>
                  ) : courses.map(c => {
                    const mine = c.teacher_id === t.id
                    const other = c.teacher_id && !mine
                    const otherName = other ? (teachers.find(x => x.id === c.teacher_id)?.name || '다른 강사') : ''
                    return (
                      <div key={c.id} style={{ background:'var(--surf)', border:`1.5px solid ${mine ? 'var(--ac)' : BORDER}`, borderRadius:11, padding:'9px 11px', marginBottom:7 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>
                              {c.name} {!c.is_active && <span style={{ fontSize:9, color:'var(--tmu)' }}>(비활성)</span>}
                            </div>
                            {other && <div style={{ fontSize:10, color:'var(--tmu)', marginTop:1 }}>현재 담당: {otherName}</div>}
                          </div>
                          <button onClick={() => setCourseTeacher(c.id, mine ? null : t.id)} style={chip(mine)}>
                            {mine ? '담당 해제' : '담당 지정'}
                          </button>
                        </div>

                        {/* 타임별 담당 — 비워두면 수업 담당을 따른다 */}
                        {(c.class_schedules || []).length > 0 && (
                          <div style={{ marginTop:8, paddingTop:8, borderTop:`1px dashed ${BORDER}` }}>
                            <div style={{ fontSize:9.5, fontWeight:800, color:'var(--tmu)', marginBottom:6 }}>타임별 담당 (비우면 수업 담당을 따라요)</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                              {[...(c.class_schedules || [])].sort((a,b) => (a.day_of_week - b.day_of_week) || (a.start_time || '').localeCompare(b.start_time || '')).map(s => {
                                const sMine = s.teacher_id === t.id
                                const sOther = s.teacher_id && !sMine
                                const sName = sOther ? (teachers.find(x => x.id === s.teacher_id)?.name || '다른 강사') : ''
                                return (
                                  <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                                    <span style={{ fontSize:10.5, color: sMine ? 'var(--acTx)' : 'var(--tm)', fontWeight:700 }}>
                                      {DOW[s.day_of_week] || '?'} {s.start_time}~{s.end_time}
                                      {sOther && <span style={{ color:'var(--tmu)', fontWeight:600 }}> · {sName}</span>}
                                    </span>
                                    <button onClick={() => setScheduleTeacher(c.id, s.id, sMine ? null : t.id)} style={chip(sMine)}>
                                      {sMine ? '해제' : '이 타임 담당'}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {scope.myCourses.length === 0 && scope.mySlots.length === 0 && (
                    <div style={{ marginTop:8, fontSize:10.5, color: BAD.tx, background: BAD.soft, borderRadius:10, padding:'8px 10px', lineHeight:1.6, fontWeight:700 }}>
                      담당이 하나도 없어요. 이 강사는 강사 화면이 비어 있고 수업 알림도 받지 못해요.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {active.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13 }}>강사가 없어요 🐾</div>
        )}
      </div>

      <AdminNav active="" />
    </>
  )
}
