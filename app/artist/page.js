'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useTodayWeather } from '../../components/WeatherBar'
import { NavIcon } from '../../components/NavIcons'
const CAT_IMAGES = [
  '/cats/cat01.png',
  '/cats/cat02.png',
  '/cats/cat03.png',
  '/cats/cat04.png',
  '/cats/cat05.png',
]

function getCatImage(d) {
  return CAT_IMAGES[(d * 7 + 3) % CAT_IMAGES.length]
}

function PixelPlant({ ratio }) {
  const stage = ratio >= 0.6 ? 'healthy' : ratio >= 0.3 ? 'mild' : 'wilted'
  const palette = {
    healthy: {
      leaf: '#3d6b4f', leafDark: '#2a4a37',
      flower: '#6b9bc4', flowerDark: '#4a7aa3',
      pot: '#c97a4a', potDark: '#a05c33', potLight: '#e09060',
      drop: '#7a9bbf'
    },
    mild: {
      leaf: '#5a7a6a', leafDark: '#3d5a4d',
      flower: '#8ba8c4', flowerDark: '#6b8aa8',
      pot: '#c97a4a', potDark: '#a05c33', potLight: '#e09060',
      drop: 'transparent'
    },
    wilted: {
      leaf: '#8a8a78', leafDark: '#6a6a5a',
      flower: 'transparent', flowerDark: 'transparent',
      pot: '#b8704a', potDark: '#946238', potLight: '#c98860',
      drop: 'transparent'
    }
  }
  const c = palette[stage]
  const leavesHealthy = [
    [5,4],[5,5],[5,6],[5,7],[5,8],[5,9],
    [6,4],[6,5],[6,6],[6,7],[6,8],[6,9],
    [3,8],[4,7],[2,9],[3,7],[4,6],
    [2,6],[3,5],[2,5],[1,6],[3,3],[2,4],
    [7,7],[8,8],[9,9],[7,6],[8,7],
    [8,5],[9,6],[9,5],[10,6],[8,3],[9,4],
  ]
  const leavesWilted = [
    [5,5],[5,6],[5,7],[5,8],[5,9],
    [6,5],[6,6],[6,7],[6,8],[6,9],
    [3,9],[4,8],[7,8],[8,9],
    [3,7],[4,7],[7,7],[8,7],
  ]
  const leaves = stage === 'wilted' ? leavesWilted : leavesHealthy
  const flowers = [
    [4,2],[5,2],[6,2],[7,2],[5,1],[6,1],[5,3],[6,3],
    [2,3],[3,3],[2,2],[8,3],[9,3],[9,2],
  ]

  return (
    <div style={{ position:'relative', width:48, height:48 }}>
      <style>{`
        @keyframes pSwayH { 0%,100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
        @keyframes pSwayM { 0%,100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
        @keyframes pSwayW { 0%,100% { transform: translateY(0); } 50% { transform: translateY(0.4px); } }
        @keyframes pDrop { 0% { transform: translateY(-3px); opacity:0; } 15% { opacity:1; } 85% { opacity:1; } 100% { transform: translateY(10px); opacity:0; } }
        .p-h { animation: pSwayH 3.2s ease-in-out infinite; transform-origin: 50% 85%; }
        .p-m { animation: pSwayM 4.2s ease-in-out infinite; transform-origin: 50% 85%; }
        .p-w { animation: pSwayW 5s ease-in-out infinite; }
        .p-d1 { animation: pDrop 2.6s ease-in 0s infinite; }
        .p-d2 { animation: pDrop 2.6s ease-in 1.3s infinite; }
      `}</style>
      <div className={stage === 'healthy' ? 'p-h' : stage === 'mild' ? 'p-m' : 'p-w'} style={{ position:'absolute', inset:0 }}>
        <svg viewBox="0 0 48 48" width="48" height="48" shapeRendering="crispEdges">
          {stage !== 'wilted' && flowers.map(([x,y],i) => (
            <rect key={`f-${i}`} x={x*4} y={y*4} width="4" height="4" fill={c.flower}/>
          ))}
          {stage !== 'wilted' && flowers.filter(([,y]) => y >= 2).slice(0, 6).map(([x,y],i) => (
            <rect key={`fd-${i}`} x={x*4+2} y={y*4+2} width="2" height="2" fill={c.flowerDark}/>
          ))}
          {leaves.map(([x,y],i) => (
            <rect key={`l-${i}`} x={x*4} y={y*4} width="4" height="4" fill={c.leaf}/>
          ))}
          {leaves.filter(([x,y]) => (x+y) % 3 === 0).map(([x,y],i) => (
            <rect key={`ld-${i}`} x={x*4+1} y={y*4+1} width="2" height="2" fill={c.leafDark}/>
          ))}
          <rect x="12" y="36" width="24" height="2" fill={c.potDark}/>
          <rect x="14" y="38" width="20" height="8" fill={c.pot}/>
          <rect x="14" y="38" width="2" height="6" fill={c.potLight}/>
          <rect x="32" y="38" width="2" height="8" fill={c.potDark}/>
          <rect x="14" y="46" width="20" height="2" fill={c.potDark}/>
        </svg>
      </div>
      {stage === 'healthy' && (
        <>
          <div className="p-d1" style={{ position:'absolute', top:2, left:12, width:2, height:3, background:c.drop, borderRadius:'50% 50% 50% 50% / 60% 60% 40% 40%' }}/>
          <div className="p-d2" style={{ position:'absolute', top:2, left:32, width:2, height:3, background:c.drop, borderRadius:'50% 50% 50% 50% / 60% 60% 40% 40%' }}/>
        </>
      )}
    </div>
  )
}

export default function ArtistPage() {
    const todayWeather = useTodayWeather()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [bookings, setBookings] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [meetings, setMeetings] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [animDay, setAnimDay] = useState(null)
  const [selCourse, setSelCourse] = useState(null)
  const [selSchedule, setSelSchedule] = useState(null)
  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayD = now.getDate()
  const [year, setYear] = useState(todayY)
  const [month, setMonth] = useState(todayM)
  const today = (year === todayY && month === todayM) ? todayD : -1
  const [loading, setLoading] = useState(true)
  const cellRefs = useRef({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const role = data.user.user_metadata?.role
      if (role !== 'artist' && role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    // 회의 참여권은 type='meeting' 으로 구분
    const { data: t } = await supabase.from('tickets').select('*').eq('user_id', userId).eq('type', 'meeting').single()
    setTicket(t)
    const { data: b } = await supabase.from('bookings').select('*').eq('user_id', userId)
    setBookings(b || [])
    const { data: allMeetingBookings } = await supabase
  .from('bookings')
  .select('course_id, class_date, schedule_id')
  .in('course_id', (await supabase.from('class_courses').select('id').eq('category', 'meeting')).data?.map(c => c.id) || [])
setAllBookings(allMeetingBookings || [])
    // 카테고리가 meeting 인 것만
    const { data: m } = await supabase
      .from('class_courses')
      .select('*, class_schedules(*)')
      .eq('is_active', true)
      .eq('category', 'meeting')
    setMeetings(m || [])
    setLoading(false)
  }

  function bookingsInView() {
    return bookings.filter(b => {
      const d = new Date(b.class_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }

  function bookedDays() {
    return new Set(bookingsInView().map(b => new Date(b.class_date).getDate()))
  }

  function dayMeetings(day) {
  const dow = new Date(year, month, day).getDay()
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  return meetings.filter(c => {
    if (!c.is_active) return false
    const hasSchedule = c.class_schedules?.some(s => s.day_of_week === dow)
    if (!hasSchedule) return false
    if (!c.is_unlimited) {
      if (c.start_date && dateStr < c.start_date) return false
      if (c.end_date && dateStr > c.end_date) return false
    }
    return true
  })
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
    setSelCourse(null)
    setSelSchedule(null)
    setAnimDay(d)
    spawnParticles(cellRefs.current[d])
    setTimeout(() => setAnimDay(null), 500)
  }

  function monthDiff() {
    return (year - todayY) * 12 + (month - todayM)
  }

  function changeMonth(delta) {
    const newDate = new Date(year, month + delta, 1)
    const diff = (newDate.getFullYear() - todayY) * 12 + (newDate.getMonth() - todayM)
    if (diff < -3 || diff > 3) return
    setYear(newDate.getFullYear())
    setMonth(newDate.getMonth())
    setSelectedDay(1)
    setSelCourse(null); setSelSchedule(null)
  }

  function isBookable(day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const todayStr = `${todayY}-${String(todayM+1).padStart(2,'0')}-${String(todayD).padStart(2,'0')}`
    if (dateStr < todayStr) return false
    const diff = monthDiff()
    if (diff > 1) return false
    return true
  }

  async function handleBook() {
  if (!selCourse || !selSchedule) return
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`

  const { data: newBooking } = await supabase.from('bookings').insert({
    user_id: user.id,
    course_id: selCourse.id,
    schedule_id: selSchedule.id,
    class_name: selCourse.name,
    class_date: dateStr,
    class_time: `${selSchedule.start_time}~${selSchedule.end_time}`,
    teacher: selCourse.teacher,
    status: 'booked'
  }).select().single()

  const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
  if (selCourse.teacher_id) {
    await supabase.from('notifications').insert({
      user_id: selCourse.teacher_id,
      type: 'booking_created',
      title: '새 회의 신청',
      body: `${profile?.name || '작가'}님이 ${selCourse.name} ${dateStr} ${selSchedule.start_time} 참여 신청`,
      related_id: newBooking?.id
    })
  }

  setSelCourse(null); setSelSchedule(null)
  loadData(user.id)
}

  async function handleCancel(booking) {
    const diff = (new Date(booking.class_date) - new Date()) / (1000*60*60)
    if (diff < 4) { alert('회의 4시간 전에는 취소할 수 없어요'); return }

    const { data: course } = await supabase.from('class_courses').select('teacher_id').eq('id', booking.course_id).single()

    await supabase.from('bookings').delete().eq('id', booking.id)
    await supabase.from('tickets').update({ remain: ticket.remain+1 }).eq('id', ticket.id)

    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    if (course?.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: course.teacher_id,
        type: 'booking_cancelled',
        title: '회의 신청 취소',
        body: `${profile?.name || '작가'}님이 ${booking.class_name} ${booking.class_date} ${booking.class_time} 취소`
      })
    }

    loadData(user.id)
  }

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const bd = bookedDays()
  const dc = dayMeetings(selectedDay)

  const dayBookings = bookings.filter(b => {
    const d = new Date(b.class_date)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay
  })

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🖼️</div>
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
          <NavIcon name="photo" color="#fff" size={20} />
          <span className="header-title">전시 작가</span>
        </div>
        <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))}
          style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
          로그아웃
        </button>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <button onClick={() => changeMonth(-1)}
            disabled={monthDiff() <= -3}
            style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() <= -3 ? 0.3 : 1 }}>‹</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18, fontWeight:800, color:'var(--td)' }}>
              {year}.{String(month+1).padStart(2,'0')}
            </span>
            {(year !== todayY || month !== todayM) && (
              <button onClick={() => { setYear(todayY); setMonth(todayM); setSelectedDay(todayD) }}
                style={{ background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                오늘
              </button>
            )}
          </div>
          <button onClick={() => changeMonth(1)}
            disabled={monthDiff() >= 3}
            style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() >= 3 ? 0.3 : 1 }}>›</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
          {['일','월','화','수','목','금','토'].map((d,i)=>(
            <div key={d} style={{ fontSize:10, fontWeight:700, padding:'3px 0',
              color:i===0?'#b05050':i===6?'#5070a0':'var(--tmu)' }}>{d}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:12 }}>
          {Array(firstDow).fill(null).map((_,i)=><div key={`e${i}`} style={{ height:52 }}/>)}
          {Array(daysInMonth).fill(null).map((_,i)=>{
            const d = i+1
            const dow = new Date(year,month,d).getDay()
            const isMon = dow===1
            const isB = bd.has(d)
            const isSel = d===selectedDay
            const isT = d===today
            const isAnim = animDay===d
            const hasCls = dayMeetings(d).length > 0

            return (
              <div key={d}
                ref={el => cellRefs.current[d] = el}
                onClick={()=>handleDayClick(d)}
                style={{ height:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  cursor:isMon?'default':'pointer', borderRadius:12, opacity:isMon?0.3:1, position:'relative',
                  background:isSel?'#e8f5e0':'transparent',
                  border:isSel?'1.5px solid var(--g3)':'1.5px solid transparent' }}>
                    {isT && todayWeather && (
  <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', fontSize:13, zIndex:1 }}>
    {todayWeather.icon}
  </div>
)}
                {isB || isSel ? (
                  <div className={isAnim?'cat-anim':''} style={{ display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1 }}>
                    <img src={getCatImage(d)} alt="" style={{ width:34, height:34, objectFit:'contain' }}/>
                    <span style={{ fontSize:9, fontWeight:800, color:'var(--td)', marginTop:-1 }}>{d}</span>
                  </div>
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

        {/* 참여권 + 화초 */}
        <div style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', marginBottom:12,
          display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid var(--g2)' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700 }}>회의 참여권</div>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:4 }}>
              {ticket?`${ticket.total}회권 · 잔여 ${ticket.remain}회`:'참여권 없음'}
            </div>
            {ticket && (
              <>
                <div style={{ width:'100%', height:5, background:'rgba(255,255,255,0.5)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                  <div style={{
                    width: `${(ticket.remain / ticket.total) * 100}%`,
                    height: '100%',
                    background: ticket.remain/ticket.total >= 0.6 ? 'var(--g4)' : ticket.remain/ticket.total >= 0.3 ? 'var(--g3)' : '#c9a07a',
                    transition: 'width 0.3s ease, background 0.3s ease'
                  }}/>
                </div>
                <div style={{ fontSize:10, color:'var(--g4)', fontWeight:600 }}>만료: {ticket.expires_at}</div>
              </>
            )}
          </div>
          <div style={{ marginLeft:12 }}>
            <PixelPlant ratio={ticket ? (ticket.remain / ticket.total) : 0}/>
          </div>
        </div>

        <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>
          {month+1}월 {selectedDay}일 회의
        </div>

        {dc.length === 0 ? (
          <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 회의가 없어요 🐾</div>
        ) : (
          <>
           {dc.map(c => {
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
  const count = allBookings.filter(b => b.course_id === c.id && b.class_date === dateStr).length
  return (
    <div key={c.id} onClick={() => { setSelCourse(c); setSelSchedule(null) }}
      style={{ padding:'10px 14px', borderRadius:12, marginBottom:6, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:selCourse?.id===c.id?'#e8f5e0':'var(--bg)',
        border:`1.5px solid ${selCourse?.id===c.id?'var(--g4)':'var(--g2)'}` }}>
      <div>
        <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{c.name}</div>
        <div style={{ fontSize:10, color:'var(--tmu)' }}>주최 {c.teacher}</div>
      </div>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--g5)' }}>
        {count}/{c.max_count}명
      </div>
    </div>
  )
})}

            {selCourse && (
              <div className="slide-up" style={{ marginTop:12, marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>시간 선택</div>
                {getSchedulesForDay(selCourse, selectedDay).map(s => {
                  const booked = isBooked(selCourse.id, s.id, selectedDay)
                  const booking = getBooking(selCourse.id, s.id, selectedDay)
                  const isSel = selSchedule?.id === s.id
                  return (
                    <div key={s.id} onClick={() => !booked && setSelSchedule(s)}
                      style={{ padding:'10px 14px', borderRadius:12, marginBottom:6,
                        cursor:booked?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                        background:booked?'#e8f5e0':isSel?'#e8f5e0':'var(--bg)',
                        border:`1.5px solid ${booked?'var(--g3)':isSel?'var(--g4)':'var(--g2)'}` }}>
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
                          신청취소
                        </button>
                      ) : (
                        <span style={{ fontSize:10, color:isSel?'var(--g5)':'var(--tmu)', fontWeight:700 }}>
                          {isSel?'✓ 선택됨':'선택'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {selSchedule && !isBooked(selCourse?.id, selSchedule?.id, selectedDay) && (
              <div className="slide-up">
                {isBookable(selectedDay) ? (
  <button className="btn-primary" onClick={handleBook}>
    {selCourse?.name} {selSchedule?.start_time}~{selSchedule?.end_time} 참여 신청
  </button>
) : (
                  <div style={{ padding:'14px', background:'var(--bg)', borderRadius:14, textAlign:'center', color:'var(--tmu)', fontSize:12, fontWeight:600 }}>
                    {monthDiff() < 0 ? '지난 날짜는 신청할 수 없어요' : '신청은 다음 달까지만 가능해요'}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {dayBookings.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>내 신청</div>
            {dayBookings.map(b => (
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
          { href:'/artist', label:'회의', icon:'calendar', active:true },
          { href:'/lounge', label:'라운지', icon:'chat' },
        ].map(t=>(
          <a key={t.label} href={t.href} className={`nav-item ${t.active?'active':''}`}>
            <NavIcon name={t.icon} active={t.active} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  )
}