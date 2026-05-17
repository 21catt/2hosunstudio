'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const EMOJI = { drawing:'✏️', painting:'🎨', sculpture:'🗿', free:'🖼️' }
const CAT_NAME = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작' }
const CAT_COLOR = { drawing:'#e8f5e0', painting:'#EDE7F6', sculpture:'#FFF3E0', free:'#E3F2FD' }
const CAT_TEXT = { drawing:'var(--g5)', painting:'#4A148C', sculpture:'#E65100', free:'#0D47A1' }

const CAT_POSES = [
  (d,f,s) => `<svg viewBox="0 0 60 54" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <path d="M15 26 Q13 15 18 12 Q21 22 24 24" fill="${f}" stroke="${s}" stroke-width="2"/>
    <path d="M45 26 Q47 15 42 12 Q39 22 36 24" fill="${f}" stroke="${s}" stroke-width="2"/>
    <path d="M10 30 Q10 14 30 14 Q50 14 50 30 Q50 44 30 46 Q10 46 10 30Z" fill="${f}" stroke="${s}" stroke-width="2"/>
    <circle cx="23" cy="28" r="2.2" fill="${s}"/>
    <circle cx="37" cy="28" r="2.2" fill="${s}"/>
    <path d="M27 35 Q30 38 33 35" stroke="${s}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <text x="30" y="44" text-anchor="middle" font-size="10" font-weight="800" fill="#1e3828" font-family="Nunito,sans-serif">${d}</text>
  </svg>`,
  (d,f,s) => `<svg viewBox="0 0 60 52" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <path d="M14 24 Q12 13 17 10 Q20 20 23 22" fill="${f}" stroke="${s}" stroke-width="1.8"/>
    <path d="M46 24 Q48 13 43 10 Q40 20 37 22" fill="${f}" stroke="${s}" stroke-width="1.8"/>
    <path d="M10 30 Q10 14 30 14 Q50 14 50 30 Q50 44 30 46 Q10 46 10 30Z" fill="${f}" stroke="${s}" stroke-width="2"/>
    <circle cx="23" cy="28" r="2.2" fill="${s}"/>
    <circle cx="37" cy="28" r="2.2" fill="${s}"/>
    <path d="M23 36 Q30 43 37 36" stroke="${s}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <text x="30" y="50" text-anchor="middle" font-size="10" font-weight="800" fill="#1e3828" font-family="Nunito,sans-serif">${d}</text>
  </svg>`,
]

const CAT_COLORS = [
  {f:'#c8e6c0',s:'#3d8b50'},
  {f:'#d8eec8',s:'#2a5c38'},
  {f:'#b8dab0',s:'#4a7a58'},
  {f:'#e0f2d8',s:'#6db870'},
  {f:'#a8d4a0',s:'#3d8b50'},
]

function getCat(d) {
  return { pose: CAT_POSES[(d*7+3)%2], ...CAT_COLORS[(d*3+1)%5] }
}

export default function StudentPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [bookings, setBookings] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [animDay, setAnimDay] = useState(null)
  // 예약 선택 상태
  const [selCat, setSelCat] = useState(null) // 선택한 카테고리
  const [selCourse, setSelCourse] = useState(null) // 선택한 수업
  const [selSchedule, setSelSchedule] = useState(null) // 선택한 시간
  const month = new Date().getMonth()
  const year = new Date().getFullYear()
  const today = new Date().getDate()
  const [loading, setLoading] = useState(true)
  const cellRefs = useRef({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    const { data: t } = await supabase.from('tickets').select('*').eq('user_id', userId).single()
    setTicket(t)
    const { data: b } = await supabase.from('bookings').select('*').eq('user_id', userId)
    setBookings(b || [])
    const { data: c } = await supabase
      .from('class_courses')
      .select('*, class_schedules(*)')
      .eq('is_active', true)
    setClasses(c || [])
    setLoading(false)
  }

  function bookedDays() {
    return new Set(bookings.map(b => new Date(b.class_date).getDate()))
  }

  function dayClasses(day) {
    const dow = new Date(year, month, day).getDay()
    return classes.filter(c =>
      c.class_schedules?.some(s => s.day_of_week === dow)
    )
  }

 function getSchedulesForDay(course, day) {
  const dow = new Date(year, month, day).getDay()
  const seen = new Set()
  return (course.class_schedules || [])
    .filter(s => s.day_of_week === dow)
    .filter(s => {
      const key = `${s.start_time}-${s.end_time}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
  

  function isBooked(courseId, scheduleId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.some(b => b.course_id === courseId && b.schedule_id === scheduleId && b.class_date === dateStr)
  }

  function getBooking(courseId, scheduleId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.find(b => b.course_id === courseId && b.schedule_id === scheduleId && b.class_date === dateStr)
  }

  function spawnParticles(el) {
    if (!el) return
    const colors = ['#c8e6c0','#6db870','#3d8b50','#a8d4a0','#fff']
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div')
      const angle = (i/8)*360
      const dist = 20 + Math.random()*20
      s.style.cssText = `position:absolute;width:6px;height:6px;border-radius:50%;background:${colors[i%5]};left:50%;top:50%;margin:-3px;pointer-events:none;z-index:99;animation:spark 0.6s ease-out forwards;--tx:${Math.cos(angle*Math.PI/180)*dist}px;--ty:${Math.sin(angle*Math.PI/180)*dist}px;`
      el.appendChild(s)
      setTimeout(() => s.remove(), 700)
    }
  }

  function handleDayClick(d) {
    const dow = new Date(year, month, d).getDay()
    if (dow === 1) return
    setSelectedDay(d)
    setSelCat(null)
    setSelCourse(null)
    setSelSchedule(null)
    setAnimDay(d)
    spawnParticles(cellRefs.current[d])
    setTimeout(() => setAnimDay(null), 500)
  }

  async function handleBook() {
    if (!selCourse || !selSchedule) return
    if (!ticket || ticket.remain <= 0) { alert('잔여 수강권이 없어요 🐾'); return }
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: selCourse.id,
      schedule_id: selSchedule.id,
      class_name: selCourse.name,
      class_date: dateStr,
      class_time: `${selSchedule.start_time}~${selSchedule.end_time}`,
      teacher: selCourse.teacher,
      status: 'booked'
    })
    await supabase.from('tickets').update({ remain: ticket.remain-1 }).eq('id', ticket.id)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    loadData(user.id)
  }

  async function handleCancel(booking) {
    const diff = (new Date(booking.class_date) - new Date()) / (1000*60*60)
    if (diff < 4) { alert('수업 4시간 전에는 취소할 수 없어요'); return }
    await supabase.from('bookings').delete().eq('id', booking.id)
    await supabase.from('tickets').update({ remain: ticket.remain+1 }).eq('id', ticket.id)
    loadData(user.id)
  }

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const bd = bookedDays()
  const dc = dayClasses(selectedDay)

  // 카테고리별 그룹
  const catGroups = dc.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {})
  const cats = Object.keys(catGroups)

  // 선택된 카테고리의 수업들
  const catCourses = selCat ? catGroups[selCat] || [] : []

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes spark {
          0% { transform: translate(0,0) scale(1.2); opacity:1; }
          100% { transform: translate(var(--tx),var(--ty)) scale(0); opacity:0; }
        }
        @keyframes catPop {
          0% { transform: scale(0) rotate(-15deg); opacity:0; }
          55% { transform: scale(1.28) rotate(6deg); opacity:1; }
          100% { transform: scale(1) rotate(0deg); opacity:1; }
        }
        .cat-anim { animation: catPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity:0; }
          to { transform: translateY(0); opacity:1; }
        }
        .slide-up { animation: slideUp 0.25s ease forwards; }
      `}</style>

      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🐱</span>
          <span className="header-title">2호선 스튜디오</span>
        </div>
        <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))}
          style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
          로그아웃
        </button>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0' }}>
        <div style={{ fontSize:18, fontWeight:800, color:'var(--td)', marginBottom:14 }}>
          {year}.{String(month+1).padStart(2,'0')}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
          {['일','월','화','수','목','금','토'].map((d,i)=>(
            <div key={d} style={{ fontSize:10, fontWeight:700, padding:'3px 0',
              color:i===0?'#b05050':i===6?'#5070a0':'var(--tmu)' }}>{d}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:12 }}>
          {Array(firstDow).fill(null).map((_,i)=><div key={`e${i}`} style={{ height:48 }}/>)}
          {Array(daysInMonth).fill(null).map((_,i)=>{
            const d = i+1
            const dow = new Date(year,month,d).getDay()
            const isMon = dow===1
            const isB = bd.has(d)
            const isSel = d===selectedDay
            const isT = d===today
            const cat = getCat(d)
            const isAnim = animDay===d
            const hasCls = dayClasses(d).length > 0

            return (
              <div key={d}
                ref={el => cellRefs.current[d] = el}
                onClick={()=>handleDayClick(d)}
                style={{ height:48, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  cursor:isMon?'default':'pointer', borderRadius:12, opacity:isMon?0.3:1, position:'relative',
                  background:isSel?'#e8f5e0':'transparent',
                  border:isSel?'1.5px solid var(--g3)':'1.5px solid transparent' }}>
                {isB || isSel ? (
                  <div className={isAnim?'cat-anim':''} dangerouslySetInnerHTML={{ __html: cat.pose(d, cat.f, cat.s) }}/>
                ) : isT ? (
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--g4)', color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>{d}</div>
                ) : (
                  <div style={{ fontSize:12, fontWeight:700,
                    color:dow===0?'#b05050':dow===6?'#5070a0':'var(--td)' }}>{d}</div>
                )}
                {!isB && hasCls && !isSel && (
                  <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--g3)', marginTop:2 }}/>
                )}
              </div>
            )
          })}
        </div>

        {/* 수강권 */}
        <div style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', marginBottom:12,
          display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid var(--g2)' }}>
          <div>
            <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700 }}>내 수강권</div>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>
              {ticket?`${ticket.total}회권 · 잔여 ${ticket.remain}회`:'수강권 없음'}
            </div>
            {ticket&&<div style={{ fontSize:10, color:'var(--g4)', fontWeight:600 }}>만료: {ticket.expires_at}</div>}
          </div>
          <span style={{ fontSize:28 }}>🎨</span>
        </div>

        <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>
          {month+1}월 {selectedDay}일 수업
        </div>

        {dc.length === 0 ? (
          <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 수업이 없어요 🐾</div>
        ) : (
          <>
            {/* Step 1: 카테고리 선택 */}
            {cats.length > 1 && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수업 종류 선택</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {cats.map(cat => (
                    <div key={cat} onClick={() => { setSelCat(cat); setSelCourse(null); setSelSchedule(null) }}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:20, cursor:'pointer',
                        background:selCat===cat?CAT_COLOR[cat]:'var(--bg)',
                        border:`1.5px solid ${selCat===cat?CAT_TEXT[cat]:'var(--g2)'}` }}>
                      <span style={{ fontSize:16 }}>{EMOJI[cat]||'🎨'}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:selCat===cat?CAT_TEXT[cat]:'var(--td)' }}>{CAT_NAME[cat]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 카테고리 하나면 자동 선택 */}
            {cats.length === 1 && selCat !== cats[0] && (() => { setTimeout(() => setSelCat(cats[0]), 0); return null })()}

            {/* Step 2: 수업 선택 (같은 카테고리에 여러 수업이면) */}
            {selCat && catCourses.length > 1 && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수업 선택</div>
                {catCourses.map(c => (
                  <div key={c.id} onClick={() => { setSelCourse(c); setSelSchedule(null) }}
                    style={{ padding:'10px 14px', borderRadius:12, marginBottom:6, cursor:'pointer',
                      background:selCourse?.id===c.id?CAT_COLOR[c.category]:'var(--bg)',
                      border:`1.5px solid ${selCourse?.id===c.id?CAT_TEXT[c.category]:'var(--g2)'}` }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{c.name}</div>
                    <div style={{ fontSize:10, color:'var(--tmu)' }}>강사 {c.teacher}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 수업 하나면 자동 선택 */}
            {selCat && catCourses.length === 1 && selCourse !== catCourses[0] && (() => { setTimeout(() => setSelCourse(catCourses[0]), 0); return null })()}

            {/* Step 3: 시간 선택 */}
            {selCourse && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>시간 선택</div>
                {getSchedulesForDay(selCourse, selectedDay).map(s => {
                  const booked = isBooked(selCourse.id, s.id, selectedDay)
                  const booking = getBooking(selCourse.id, s.id, selectedDay)
                  const isSel = selSchedule?.id === s.id
                  return (
                    <div key={s.id} onClick={() => !booked && setSelSchedule(s)}
                      style={{ padding:'10px 14px', borderRadius:12, marginBottom:6,
                        cursor:booked?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                        background:booked?'#e8f5e0':isSel?CAT_COLOR[selCourse.category]:'var(--bg)',
                        border:`1.5px solid ${booked?'var(--g3)':isSel?CAT_TEXT[selCourse.category]:'var(--g2)'}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:booked?'var(--g4)':'var(--g2)', flexShrink:0 }}/>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--td)' }}>
                          {s.start_time}~{s.end_time}
                        </span>
                      </div>
                      {booked ? (
                        <button onClick={e=>{e.stopPropagation(); handleCancel(booking)}}
                          style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:'var(--g1)',
                            color:'var(--tm)', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                          예약취소
                        </button>
                      ) : (
                        <span style={{ fontSize:10, color:isSel?CAT_TEXT[selCourse.category]:'var(--tmu)', fontWeight:700 }}>
                          {isSel?'✓ 선택됨':'선택'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 예약 버튼 */}
            {selSchedule && !isBooked(selCourse?.id, selSchedule?.id, selectedDay) && (
              <div className="slide-up">
                <button className="btn-primary" onClick={handleBook}>
                  {selCourse?.name} {selSchedule?.start_time}~{selSchedule?.end_time} 예약하기
                </button>
              </div>
            )}
          </>
        )}

        {/* 내 예약 현황 */}
        {bookings.filter(b => new Date(b.class_date).getDate() === selectedDay).length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>내 예약</div>
            {bookings.filter(b => new Date(b.class_date).getDate() === selectedDay).map(b => (
              <div key={b.id} style={{ background:'#e8f5e0', borderRadius:12, padding:'10px 14px',
                marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between',
                border:'1.5px solid var(--g3)' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{b.class_name}</div>
                  <div style={{ fontSize:10, color:'var(--tm)' }}>{b.class_time}</div>
                </div>
                <button onClick={() => handleCancel(b)}
                  style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:'var(--g1)',
                    color:'var(--tm)', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                  취소
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ height:80 }}/>
      </div>

      <nav className="bottom-nav">
        {[
          { href:'/student', label:'일정', icon:'📅', active:true },
          { href:'/student/notification', label:'알림', icon:'🔔' },
          { href:'/student/farm', label:'냥밭', icon:'🌱' },
          { href:'/lounge', label:'라운지', icon:'💬' },
        ].map(t=>(
          <a key={t.label} href={t.href} className={`nav-item ${t.active?'active':''}`}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  )
}