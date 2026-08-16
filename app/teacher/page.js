'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { isTeacher, isOwner, isPendingTeacher } from '../../lib/roles'
import { loadTeachingScope } from '../../lib/teaching'
import TeacherNav from '../../components/TeacherNav'
import { NavIcon } from '../../components/NavIcons'
import LoadingCat from '../../components/LoadingCat'

// 강사 홈 — "내 수업"을 중심으로 오늘 수업·예약 학생·담당 회원을 본다.
// 담당 학생은 별도 컬럼 없이 파생된다: 내 수업(class_courses.teacher_id = 나)에
// 예약한 학생 = 내 담당. 그래서 학생이 내 수업을 예약하면 자동으로 목록에 뜬다.
const DOW = ['일','월','화','수','목','금','토']
const todayStr = () => new Date().toISOString().split('T')[0]

export default function TeacherHomePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [bookings, setBookings] = useState([])   // 내 수업의 예약 전체(오늘 이후 + 지난 것 일부)
  const [nameMap, setNameMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)              // 0 = 오늘, 1 = 담당 회원

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (isPendingTeacher(data.user)) { alert('아직 관리자 승인 전이에요 🐾'); router.push('/login'); return }
      if (!isTeacher(data.user)) { router.push('/student'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(uid) {
    // 내 담당 = 수업 담당 + 타임 담당(class_schedules.teacher_id 우선)
    const scope = await loadTeachingScope(uid)
    if (!scope.hasAny) { setCourses([]); setLoading(false); return }

    const { data: cs } = await supabase
      .from('class_courses')
      .select('*, class_schedules(*)')
      .in('id', scope.scopeCourseIds)
      .eq('is_active', true)
    setCourses(cs || [])

    const { data: bs } = await supabase
      .from('bookings')
      .select('*')
      .in('course_id', scope.scopeCourseIds)
      .order('class_date', { ascending: true })
    // 내 수업이어도 그 타임이 다른 강사면 제외
    const list = (bs || []).filter(scope.isMine)
    setBookings(list)

    const uids = [...new Set(list.map(b => b.user_id).filter(Boolean))]
    if (uids.length) {
      const { data: us } = await supabase.from('users').select('id, name, phone').in('id', uids)
      setNameMap(Object.fromEntries((us || []).map(u => [u.id, u])))
    }
    setLoading(false)
  }

  if (loading) return <LoadingCat />

  const today = todayStr()
  const todayList = bookings.filter(b => b.class_date === today && b.status === 'booked')
  const upcoming = bookings.filter(b => b.class_date > today && b.status === 'booked')
  // 담당 회원 = 내 수업에 예약한 적 있는 학생(자동 파생)
  const memberIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))]
  const memberRows = memberIds.map(id => {
    const mine = bookings.filter(b => b.user_id === id)
    const attended = mine.filter(b => b.attended).length
    const last = mine.filter(b => b.class_date <= today).slice(-1)[0]
    return { id, name: nameMap[id]?.name || '학생', phone: nameMap[id]?.phone || '', attended, count: mine.length, last: last?.class_date || '-' }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const card = { background:'var(--card)', border:'1.5px solid var(--line)', borderRadius:14, padding:'12px 14px', marginBottom:8 }

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="clipboard" color="#fff" size={20} />
          <span className="header-title">강사 · {user?.user_metadata?.name || ''}</span>
        </div>
      </div>

      <div style={{ background:'var(--page)', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 90px', minHeight:'80vh' }}>

        {isOwner(user) && (
          <div style={{ background:'var(--acBg)', border:'1.5px solid var(--ac)', borderRadius:12, padding:'9px 12px', marginBottom:12, fontSize:11, fontWeight:700, color:'var(--acTx)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <span>오너 계정으로 강사 화면을 보고 있어요</span>
            <button onClick={() => router.push('/admin')} style={{ flexShrink:0, border:'none', background:'var(--ac)', color:'#fff', borderRadius:9, padding:'5px 10px', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>관리자 화면</button>
          </div>
        )}

        {courses.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--tmu)', fontSize:13, lineHeight:1.7 }}>
            담당으로 지정된 수업이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>관리자에게 수업 담당 지정을 요청해 주세요.</span>
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
              {[
                { label:'내 수업', val:`${courses.length}개` },
                { label:'담당 회원', val:`${memberIds.length}명` },
                { label:'오늘 수업', val:`${todayList.length}건` },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--bg)', borderRadius:12, padding:'10px', textAlign:'center', border:'1.5px solid var(--g1)' }}>
                  <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--td)' }}>{s.val}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', borderBottom:'2px solid var(--g1)', marginBottom:14 }}>
              {['오늘·예정','담당 회원'].map((t,i) => (
                <div key={t} onClick={() => setTab(i)}
                  style={{ flex:1, textAlign:'center', padding:'9px 0', fontSize:12, fontWeight:700,
                    color:tab===i?'var(--g4)':'var(--tmu)', cursor:'pointer',
                    borderBottom:tab===i?'2.5px solid var(--g4)':'2.5px solid transparent', marginBottom:-2 }}>
                  {t}
                </div>
              ))}
            </div>

            {tab === 0 ? (
              <>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--td)', marginBottom:8 }}>오늘 수업</div>
                {todayList.length === 0 ? (
                  <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12, marginBottom:10 }}>오늘 예약된 수업이 없어요 🐾</div>
                ) : todayList.map(b => (
                  <div key={b.id} style={card}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{nameMap[b.user_id]?.name || '학생'}</span>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:8, background: b.attended ? '#e8f5e0' : 'var(--g1)', color: b.attended ? 'var(--g5)' : 'var(--tm)' }}>
                        {b.attended ? '✓ 출석' : '대기'}
                      </span>
                    </div>
                    <div style={{ fontSize:10.5, color:'var(--tmu)' }}>{b.class_name} · {b.class_time}</div>
                  </div>
                ))}
                <button onClick={() => router.push('/admin/attendance')}
                  style={{ width:'100%', marginTop:6, marginBottom:16, padding:'11px', borderRadius:12, border:'none', background:'var(--ac)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                  출석 체크하러 가기 →
                </button>

                <div style={{ fontSize:11, fontWeight:800, color:'var(--td)', marginBottom:8 }}>다가오는 예약 {upcoming.length}건</div>
                {upcoming.slice(0, 10).map(b => {
                  const d = new Date(b.class_date + 'T00:00:00')
                  return (
                    <div key={b.id} style={card}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:11.5, fontWeight:800, color:'var(--td)' }}>{nameMap[b.user_id]?.name || '학생'}</span>
                        <span style={{ fontSize:10, color:'var(--tmu)' }}>{b.class_date.slice(5).replace('-','/')} ({DOW[d.getDay()]})</span>
                      </div>
                      <div style={{ fontSize:10.5, color:'var(--tmu)', marginTop:2 }}>{b.class_name} · {b.class_time}</div>
                    </div>
                  )
                })}
                {upcoming.length === 0 && <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>예정된 예약이 없어요 🐾</div>}
              </>
            ) : (
              <>
                <div style={{ fontSize:10.5, color:'var(--tmu)', marginBottom:10, lineHeight:1.6 }}>
                  내 수업을 예약한 학생이 자동으로 담당 회원이 돼요.
                </div>
                {memberRows.length === 0 ? (
                  <div style={{ textAlign:'center', padding:30, color:'var(--tmu)', fontSize:12 }}>아직 담당 회원이 없어요 🐾</div>
                ) : memberRows.map(m => (
                  <div key={m.id} style={card}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12.5, fontWeight:800, color:'var(--td)' }}>{m.name}</span>
                      <span style={{ fontSize:10, color:'var(--tmu)' }}>최근 {m.last}</span>
                    </div>
                    <div style={{ fontSize:10.5, color:'var(--tmu)' }}>예약 {m.count}회 · 출석 {m.attended}회</div>
                  </div>
                ))}
                <button onClick={() => router.push('/admin/records')}
                  style={{ width:'100%', marginTop:10, padding:'11px', borderRadius:12, border:'none', background:'var(--ac)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                  수업 기록·피드백 →
                </button>
              </>
            )}
          </>
        )}
      </div>

      <TeacherNav active="home" />
    </>
  )
}
