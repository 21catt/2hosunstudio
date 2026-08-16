'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import { pixelCatImg } from '../../../lib/pixelCats'
import { isOwner } from '../../../lib/roles'
import { HEADER_BG, BAD } from '../../../lib/adminTheme'
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
  const [openSched, setOpenSched] = useState({})   // `강사:수업` → 타임 목록 펼침(기본 접힘)
  const [onlyMine, setOnlyMine] = useState(false)  // 담당 수업만 보기
  const [catMap, setCatMap] = useState({})         // 프로필 고양이
  const [sortAsc, setSortAsc] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
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
    // 프로필 고양이(있으면 카드 아바타로)
    const ids = (us || []).map(u => u.id)
    if (ids.length) {
      const { data: prefs } = await supabase.from('user_prefs').select('user_id, profile_cat').in('user_id', ids)
      setCatMap(Object.fromEntries((prefs || []).map(p => [p.user_id, p.profile_cat])))
    }
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
  const filtered = q ? teachers.filter(t => (t.name || '').toLowerCase().includes(q) || (t.phone || '').includes(q)) : teachers
  const list = [...filtered].sort((a, b) => (sortAsc ? 1 : -1) * (a.name || '').localeCompare(b.name || ''))
  const pending = list.filter(t => t.role === 'teacher' && t.approved === false)
  const active = list.filter(t => !(t.role === 'teacher' && t.approved === false))
  // 강사별 점 색 — 레퍼런스처럼 카드마다 다른 색 점(이름 기반 결정적)
  const DOT = ['#2e7d32','#4a4ad6','#1DB98B','#8b5cf6','#e2557a','#e08a1e','#0ea5e9']
  const dotOf = t => t.role === 'admin' ? '#2e7d32' : DOT[[...(t.name || 'x')].reduce((s,c) => s + c.charCodeAt(0), 0) % DOT.length]
  const detail = active.find(t => t.id === expanded) || null

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

        {/* 목록 헤더 — 총원 + 정렬 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:12, color:'var(--tmu)', fontWeight:700 }}>
            총 <b style={{ color:'var(--ac)', fontWeight:900 }}>{active.length}</b>명
          </span>
          <button onClick={() => setSortAsc(v => !v)}
            style={{ background:'transparent', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontSize:11.5, fontWeight:700, color:'var(--tm)' }}>
            이름 {sortAsc ? '오름차순' : '내림차순'} ▾
          </button>
        </div>

        {/* 강사 카드 그리드 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
          {active.map(t => {
            const scope = scopeOf(t.id)
            const owner = t.role === 'admin'
            const me = t.id === user?.id
            const cat = catMap[t.id]
            return (
              <div key={t.id} onClick={() => setExpanded(t.id)}
                style={{ position:'relative', background:'var(--card)', border:`1.5px solid ${BORDER}`, borderRadius:16, padding:'16px 14px 14px', cursor:'pointer' }}>
                {me && (
                  <span style={{ position:'absolute', top:10, right:10, fontSize:9, fontWeight:800, background:'var(--g1)', color:'var(--tm)', borderRadius:7, padding:'2px 7px' }}>나</span>
                )}
                <div style={{ width:56, height:56, borderRadius:'50%', overflow:'hidden', background:'var(--g1)', border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                  {cat
                    ? <img src={pixelCatImg(cat)} alt="" width={40} height={40} style={{ imageRendering:'pixelated', display:'block' }}/>
                    : <NavIcon name="profile" color="var(--tmu)" size={26} />}
                </div>
                <div style={{ fontSize:14.5, fontWeight:900, color:'var(--td)', marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {t.name || '이름 없음'}
                </div>
                <div style={{ fontSize:11.5, color:'var(--tmu)', marginBottom:8, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {t.phone || '연락처 없음'}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background: dotOf(t), flexShrink:0 }}/>
                  <span style={{ fontSize:11.5, color:'var(--tm)', fontWeight:700 }}>{owner ? '스튜디오 오너' : '강사'}</span>
                </div>
                <div style={{ marginTop:8, paddingTop:8, borderTop:`1px dashed ${BORDER}`, fontSize:10, color: (scope.myCourses.length || scope.mySlots.length) ? 'var(--tm)' : BAD.tx, fontWeight:700 }}>
                  {(scope.myCourses.length || scope.mySlots.length)
                    ? `수업 ${scope.myCourses.length}${scope.mySlots.length ? ` · 타임 ${scope.mySlots.length}` : ''} · 회원 ${scope.students}`
                    : '담당 없음'}
                </div>
              </div>
            )
          })}
        </div>

        {/* 상세 — 담당 지정 시트 */}
        {detail && (() => {
          const t = detail
          const scope = scopeOf(t.id)
          return (
            <div onClick={() => setExpanded(null)}
              style={{ position:'fixed', inset:0, background:'rgba(10,11,25,0.55)', zIndex:1200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
              <div onClick={e => e.stopPropagation()}
                style={{ background:'var(--surf)', width:'100%', maxWidth:430, borderRadius:'22px 22px 0 0', maxHeight:'86vh', overflowY:'auto', boxSizing:'border-box', padding:'16px 14px calc(20px + env(safe-area-inset-bottom))' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', background:'var(--g1)', border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {catMap[t.id]
                      ? <img src={pixelCatImg(catMap[t.id])} alt="" width={32} height={32} style={{ imageRendering:'pixelated', display:'block' }}/>
                      : <NavIcon name="profile" color="var(--tmu)" size={22} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:900, color:'var(--td)' }}>{t.name || '이름 없음'}</div>
                    <div style={{ fontSize:11, color:'var(--tmu)' }}>
                      {t.phone || '연락처 없음'} · 담당 회원 {scope.students}명
                    </div>
                  </div>
                  <button onClick={() => setExpanded(null)}
                    style={{ width:30, height:30, borderRadius:'50%', border:`1.5px solid ${BORDER}`, background:'var(--g1)', color:'var(--tm)', fontSize:13, fontWeight:900, cursor:'pointer', padding:0, flexShrink:0 }}>✕</button>
                </div>

                <div>{(() => { const open = true; return (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px dashed ${BORDER}` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:'var(--td)' }}>담당 수업 지정</span>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={() => setOnlyMine(false)} style={chip(!onlyMine)}>전체 {courses.length}</button>
                      <button onClick={() => setOnlyMine(true)} style={chip(onlyMine)}>
                        담당만 {courses.filter(c => c.teacher_id === t.id || (c.class_schedules || []).some(s => s.teacher_id === t.id)).length}
                      </button>
                    </div>
                  </div>
                  {courses.length === 0 ? (
                    <div style={{ fontSize:11, color:'var(--tmu)' }}>개설된 수업이 없어요</div>
                  ) : courses
                    .filter(c => !onlyMine || c.teacher_id === t.id || (c.class_schedules || []).some(s => s.teacher_id === t.id))
                    .map(c => {
                    const mine = c.teacher_id === t.id
                    const other = c.teacher_id && !mine
                    const otherName = other ? (teachers.find(x => x.id === c.teacher_id)?.name || '다른 강사') : ''
                    const slots = c.class_schedules || []
                    const slotCount = slots.length
                    const mySlotCount = slots.filter(s => s.teacher_id === t.id).length
                    const schedKey = `${t.id}:${c.id}`
                    const schedOpen = !!openSched[schedKey]
                    return (
                      <div key={c.id} style={{ background:'var(--surf)', border:`1.5px solid ${mine ? 'var(--ac)' : BORDER}`, borderRadius:11, padding:'9px 11px', marginBottom:7 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>
                              {c.name} {!c.is_active && <span style={{ fontSize:9, color:'var(--tmu)' }}>(비활성)</span>}
                            </div>
                            {other && <div style={{ fontSize:10, color:'var(--tmu)', marginTop:1 }}>현재 담당: {otherName}</div>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                            {slotCount > 0 && (
                              // 타임 목록은 기본으로 접어 둔다 — 다 펼치면 스크롤이 너무 길어진다
                              <button onClick={() => setOpenSched(p => ({ ...p, [schedKey]: !p[schedKey] }))}
                                style={{ ...chip(false), display:'inline-flex', alignItems:'center', gap:3 }}>
                                타임 {slotCount}{mySlotCount > 0 && <span style={{ color:'var(--acTx)' }}>·{mySlotCount}</span>} {schedOpen ? '▾' : '▸'}
                              </button>
                            )}
                            <button onClick={() => setCourseTeacher(c.id, mine ? null : t.id)} style={chip(mine)}>
                              {mine ? '담당 해제' : '담당 지정'}
                            </button>
                          </div>
                        </div>

                        {/* 타임별 담당 — 비워두면 수업 담당을 따른다 */}
                        {slotCount > 0 && schedOpen && (
                          <div style={{ marginTop:8, paddingTop:8, borderTop:`1px dashed ${BORDER}` }}>
                            <div style={{ fontSize:9.5, fontWeight:800, color:'var(--tmu)', marginBottom:6 }}>타임별 담당 (비우면 수업 담당을 따라요)</div>
                            <div className="no-scrollbar" style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:168, overflowY:'auto' }}>
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
                ) })()}</div>
              </div>
            </div>
          )
        })()}

        {active.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13 }}>강사가 없어요 🐾</div>
        )}
      </div>

      {/* 강사 추가 안내 — 강사는 직접 가입 후 승인받는 구조라 오너가 계정을 만들지 않는다 */}
      <button onClick={() => setInviteOpen(true)} aria-label="강사 추가"
        style={{ position:'fixed', right:18, bottom:78, width:56, height:56, borderRadius:'50%', border:'none', background:'var(--g5)', color:'#fff', fontSize:26, fontWeight:400, cursor:'pointer', boxShadow:'0 6px 18px -4px rgba(0,0,0,0.4)', zIndex:60, lineHeight:1 }}>
        ＋
      </button>

      {inviteOpen && (
        <div onClick={() => setInviteOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(10,11,25,0.55)', zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surf)', borderRadius:18, padding:'20px 18px', maxWidth:340, width:'100%', boxSizing:'border-box' }}>
            <div style={{ fontSize:15, fontWeight:900, color:'var(--td)', marginBottom:10 }}>🧑‍🏫 강사 추가하기</div>
            <div style={{ fontSize:12, color:'var(--tm)', lineHeight:1.8, marginBottom:16 }}>
              강사는 본인이 직접 가입해요.<br/>
              1. 로그인 화면 → <b>강사로 가입하기</b><br/>
              2. 가입하면 이 화면에 <b>승인 대기</b>로 떠요<br/>
              3. <b>승인</b> 후 <b>담당 수업</b>을 지정해 주세요
            </div>
            <button onClick={() => setInviteOpen(false)}
              style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:'var(--ac)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
              알겠어요
            </button>
          </div>
        </div>
      )}

      <AdminNav active="" />
    </>
  )
}
