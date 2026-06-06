'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useTodayWeather } from '../../components/WeatherBar'
import StudentNav from '../../components/StudentNav'
import { sendPushToAdmins } from '../../lib/pushNotify'
import { sendKakaoToAdmins } from '../../lib/kakaoNotify'

const EMOJI = { drawing:'✏️', painting:'🎨', sculpture:'🗿', free:'🖼️', meeting:'👥' }
const CAT_NAME = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작', meeting:'모임' }
const CAT_COLOR = { drawing:'#e8f5e0', painting:'#EDE7F6', sculpture:'#FFF3E0', free:'#E3F2FD', meeting:'#FFF8E1' }
const CAT_TEXT = { drawing:'var(--g5)', painting:'#4A148C', sculpture:'#E65100', free:'#0D47A1', meeting:'#F57F17' }

const ACCENT = '#3B6D11'
const ACCENT_BG = '#EAF3DE'
const ACCENT_TEXT = '#27500A'
const CARD = '#F1EFE8'
const BORDER = 'rgba(0,0,0,0.14)'

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
    healthy: { leaf: '#3d6b4f', leafDark: '#2a4a37', flower: '#6b9bc4', flowerDark: '#4a7aa3', pot: '#c97a4a', potDark: '#a05c33', potLight: '#e09060', drop: '#7a9bbf' },
    mild: { leaf: '#5a7a6a', leafDark: '#3d5a4d', flower: '#8ba8c4', flowerDark: '#6b8aa8', pot: '#c97a4a', potDark: '#a05c33', potLight: '#e09060', drop: 'transparent' },
    wilted: { leaf: '#8a8a78', leafDark: '#6a6a5a', flower: 'transparent', flowerDark: 'transparent', pot: '#b8704a', potDark: '#946238', potLight: '#c98860', drop: 'transparent' }
  }
  const c = palette[stage]
  const leavesHealthy = [[5,4],[5,5],[5,6],[5,7],[5,8],[5,9],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[3,8],[4,7],[2,9],[3,7],[4,6],[2,6],[3,5],[2,5],[1,6],[3,3],[2,4],[7,7],[8,8],[9,9],[7,6],[8,7],[8,5],[9,6],[9,5],[10,6],[8,3],[9,4]]
  const leavesWilted = [[5,5],[5,6],[5,7],[5,8],[5,9],[6,5],[6,6],[6,7],[6,8],[6,9],[3,9],[4,8],[7,8],[8,9],[3,7],[4,7],[7,7],[8,7]]
  const leaves = stage === 'wilted' ? leavesWilted : leavesHealthy
  const flowers = [[4,2],[5,2],[6,2],[7,2],[5,1],[6,1],[5,3],[6,3],[2,3],[3,3],[2,2],[8,3],[9,3],[9,2]]

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
          {stage !== 'wilted' && flowers.map(([x,y],i) => (<rect key={`f-${i}`} x={x*4} y={y*4} width="4" height="4" fill={c.flower}/>))}
          {stage !== 'wilted' && flowers.filter(([,y]) => y >= 2).slice(0, 6).map(([x,y],i) => (<rect key={`fd-${i}`} x={x*4+2} y={y*4+2} width="2" height="2" fill={c.flowerDark}/>))}
          {leaves.map(([x,y],i) => (<rect key={`l-${i}`} x={x*4} y={y*4} width="4" height="4" fill={c.leaf}/>))}
          {leaves.filter(([x,y]) => (x+y) % 3 === 0).map(([x,y],i) => (<rect key={`ld-${i}`} x={x*4+1} y={y*4+1} width="2" height="2" fill={c.leafDark}/>))}
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

export default function StudentPage() {
  const router = useRouter()
  const todayWeather = useTodayWeather()
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [meetingTickets, setMeetingTickets] = useState([])
  const [bookings, setBookings] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [animDay, setAnimDay] = useState(null)
  const [selCat, setSelCat] = useState(null)
  const [selCourse, setSelCourse] = useState(null)
  const [selSchedule, setSelSchedule] = useState(null)
  const [paymentModal, setPaymentModal] = useState(null)
  const [selectedCount, setSelectedCount] = useState(1)
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
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    const { data: t } = await supabase.from('tickets').select('*').eq('user_id', userId).single()
    setTicket(t)
    const { data: b } = await supabase.from('bookings').select('*').eq('user_id', userId)
    setBookings(b || [])
    const { data: ab } = await supabase.from('bookings').select('course_id, schedule_id, class_date')
    setAllBookings(ab || [])
    const { data: c } = await supabase.from('class_courses').select('*, class_schedules(*)').eq('is_active', true)
    setClasses(c || [])
    const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', userId).eq('status', 'confirmed').gt('remain', 0).gte('expires_at', new Date().toISOString().split('T')[0])
    setMeetingTickets(mt || [])
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

  function dayClasses(day) {
    const dow = new Date(year, month, day).getDay()
    return classes.filter(c => c.class_schedules?.some(s => s.day_of_week === dow))
  }

  function getSchedulesForDay(course, day) {
    const dow = new Date(year, month, day).getDay()
    const seen = new Set()
    return (course.class_schedules || []).filter(s => s.day_of_week === dow).filter(s => {
      const key = `${s.start_time}-${s.end_time}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a,b) => a.start_time.localeCompare(b.start_time))
  }

  function isBooked(courseId, scheduleId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.some(b => b.course_id === courseId && b.schedule_id === scheduleId && b.class_date === dateStr)
  }

  function getBookingCount(courseId, scheduleId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return allBookings.filter(b => b.course_id === courseId && b.schedule_id === scheduleId && b.class_date === dateStr).length
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
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
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

    if (selCourse.category === 'meeting') {
      const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', user.id).eq('status', 'confirmed').gt('remain', 0).gte('expires_at', new Date().toISOString().split('T')[0]).limit(1)

      if (mt && mt.length > 0) {
        await handleMeetingBookWithTicket(mt[0])
        return
      }

      setPaymentModal({ course: selCourse, schedule: selSchedule })
      return
    }

    if (!ticket || ticket.remain <= 0) { alert('잔여 수강권이 없어요 🐾'); return }
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

    await supabase.from('tickets').update({ remain: ticket.remain-1 }).eq('id', ticket.id)

    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    const pushMsg = `${profile?.name || '학생'}님 ${selCourse.name} ${dateStr} ${selSchedule.start_time} 예약`
    if (selCourse.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: selCourse.teacher_id,
        type: 'booking_created',
        title: '새 예약',
        body: pushMsg,
        related_id: newBooking?.id
      })
    }
    sendPushToAdmins('🐾 새 예약', pushMsg)
    sendKakaoToAdmins('🐾 새 예약', pushMsg)

    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    loadData(user.id)
  }

  async function handleMeetingBook() {
    if (!paymentModal) return
    const { course, schedule } = paymentModal
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`

    const expires = new Date()
    expires.setMonth(expires.getMonth() + 1)
    await supabase.from('meeting_tickets').insert({
      user_id: user.id,
      total: selectedCount,
      remain: selectedCount - 1,
      status: 'pending',
      expires_at: expires.toISOString().split('T')[0]
    })

    const { data: newBooking } = await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: course.id,
      schedule_id: schedule.id,
      class_name: course.name,
      class_date: dateStr,
      class_time: `${schedule.start_time}~${schedule.end_time}`,
      teacher: course.teacher,
      status: 'pending'
    }).select().single()

    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    if (course.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: course.teacher_id,
        type: 'meeting_pending',
        title: '모임 참여권 신청 (입금 대기)',
        body: `${profile?.name || '학생'}님이 ${course.name} ${selectedCount}회권 신청. 금액: ${((course.price || 0) * selectedCount).toLocaleString()}원. 입금 확인 후 확정 처리 필요.`,
        related_id: newBooking?.id
      })
    }

    setPaymentModal(null)
    setSelectedCount(1)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    loadData(user.id)
    alert('신청 완료! 입금 확인 후 확정됩니다 🐾')
  }

  async function handleMeetingBookWithTicket(ticket) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`

    await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: selCourse.id,
      schedule_id: selSchedule.id,
      class_name: selCourse.name,
      class_date: dateStr,
      class_time: `${selSchedule.start_time}~${selSchedule.end_time}`,
      teacher: selCourse.teacher,
      status: 'confirmed'
    })

    await supabase.from('meeting_tickets').update({ remain: ticket.remain - 1 }).eq('id', ticket.id)

    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    loadData(user.id)
  }

  async function handleCancel(booking) {
    const diff = (new Date(booking.class_date) - new Date()) / (1000*60*60)
    if (diff < 4) { alert('수업 4시간 전에는 취소할 수 없어요'); return }

    const { data: course } = await supabase.from('class_courses').select('teacher_id, category').eq('id', booking.course_id).single()

    await supabase.from('bookings').delete().eq('id', booking.id)

    if (course?.category === 'meeting') {
      const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', user.id).eq('status', 'confirmed').gte('expires_at', new Date().toISOString().split('T')[0]).order('expires_at', { ascending: true }).limit(1)
      if (mt && mt.length > 0) {
        await supabase.from('meeting_tickets').update({ remain: mt[0].remain + 1 }).eq('id', mt[0].id)
      }
    } else {
      await supabase.from('tickets').update({ remain: ticket.remain+1 }).eq('id', ticket.id)
    }

    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    if (course?.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: course.teacher_id,
        type: 'booking_cancelled',
        title: '예약 취소',
        body: `${profile?.name || '학생'}님이 ${booking.class_name} ${booking.class_date} ${booking.class_time} 취소`
      })
    }

    loadData(user.id)
  }

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const bd = bookedDays()
  const dc = dayClasses(selectedDay)

  const dayBookings = bookings.filter(b => {
    const d = new Date(b.class_date)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay
  })

  const catGroups = dc.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {})
  const cats = Object.keys(catGroups)
  const catCourses = selCat ? catGroups[selCat] || [] : []

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes spark { 0% { transform: translate(0,0) scale(1.2); opacity:1; } 100% { transform: translate(var(--tx),var(--ty)) scale(0); opacity:0; } }
        @keyframes catPop { 0% { transform: scale(0) rotate(-15deg); opacity:0; } 55% { transform: scale(1.28) rotate(6deg); opacity:1; } 100% { transform: scale(1) rotate(0deg); opacity:1; } }
        .cat-anim { animation: catPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes slideUp { from { transform: translateY(10px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        .slide-up { animation: slideUp 0.25s ease forwards; }
      `}</style>

      {paymentModal && (
        <div onClick={()=>{setPaymentModal(null); setSelectedCount(1)}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'20px 18px', maxWidth:340, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--td)', marginBottom:6 }}>모임 참여 안내</div>
            <div style={{ fontSize:12, color:'var(--tm)', lineHeight:1.6, marginBottom:14 }}>{paymentModal.course.name}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:6 }}>참여 횟수 선택</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {[1,2,3,4].map(n => (
                <div key={n} onClick={()=>setSelectedCount(n)} style={{ flex:1, padding:'8px', borderRadius:10, textAlign:'center', cursor:'pointer', background:selectedCount===n?'var(--g4)':'var(--bg)', color:selectedCount===n?'#fff':'var(--td)', border:`1.5px solid ${selectedCount===n?'var(--g4)':'var(--g1)'}`, fontSize:12, fontWeight:700 }}>
                  {n}회
                </div>
              ))}
            </div>
            <div style={{ background:'var(--bg)', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:6 }}>참여비 ({paymentModal.course.price?.toLocaleString() || 0}원 × {selectedCount}회)</div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--g5)', marginBottom:10 }}>{((paymentModal.course.price || 0) * selectedCount).toLocaleString()}원</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>입금 계좌</div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--td)', lineHeight:1.6 }}>
                카카오뱅크<br/>3333-03-8381397<br/>예금주: 양승민
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.6, marginBottom:14 }}>
              • 신청 후 위 계좌로 입금해 주세요.<br/>
              • 입금 확인 후 모임 참여권이 확정됩니다.<br/>
              • 모임권은 발급일로부터 1개월 내 사용해야 하며 이월되지 않습니다.<br/>
              • 모임권은 모든 모임에서 사용 가능합니다.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{setPaymentModal(null); setSelectedCount(1)}} style={{ flex:1, padding:'11px', background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>취소</button>
              <button onClick={handleMeetingBook} style={{ flex:1, padding:'11px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>신청하기</button>
            </div>
          </div>
        </div>
      )}

      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🐱</span>
          <span className="header-title">2호선 스튜디오</span>
        </div>
        <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>로그아웃</button>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <button onClick={() => changeMonth(-1)} disabled={monthDiff() <= -3} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() <= -3 ? 0.3 : 1 }}>‹</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18, fontWeight:800, color:'var(--td)' }}>{year}.{String(month+1).padStart(2,'0')}</span>
            {(year !== todayY || month !== todayM) && (
              <button onClick={() => { setYear(todayY); setMonth(todayM); setSelectedDay(todayD) }} style={{ background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>오늘</button>
            )}
          </div>
          <button onClick={() => changeMonth(1)} disabled={monthDiff() >= 3} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() >= 3 ? 0.3 : 1 }}>›</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
          {['일','월','화','수','목','금','토'].map((d,i)=>(
            <div key={d} style={{ fontSize:10, fontWeight:700, padding:'3px 0', color:i===0?'#b05050':i===6?'#5070a0':'var(--tmu)' }}>{d}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:6 }}>
          {Array(firstDow).fill(null).map((_,i)=><div key={`e${i}`} style={{ height:52 }}/>)}
          {Array(daysInMonth).fill(null).map((_,i)=>{
            const d = i+1
            const dow = new Date(year,month,d).getDay()
            const isMon = dow===1
            const isB = bd.has(d)
            const isSel = d===selectedDay
            const isT = d===today
            const isAnim = animDay===d
            const hasCls = dayClasses(d).length > 0

            return (
              <div key={d} ref={el => cellRefs.current[d] = el} onClick={()=>handleDayClick(d)} style={{ height:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:isMon?'default':'pointer', borderRadius:12, opacity:isMon?0.3:1, position:'relative', background:isSel?ACCENT_BG:'transparent', border:isSel?`1.5px solid ${ACCENT}`:'1.5px solid transparent' }}>
                {isT && todayWeather && (
                  <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', fontSize:13, zIndex:1 }}>{todayWeather.icon}</div>
                )}
                {isB || isSel ? (
                  <div className={isAnim?'cat-anim':''} style={{ display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1 }}>
                    <img src={getCatImage(d)} alt="" style={{ width:34, height:34, objectFit:'contain' }}/>
                    <span style={{ fontSize:9, fontWeight:800, color:'var(--td)', marginTop:-1 }}>{d}</span>
                  </div>
                ) : isT ? (
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--g4)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>{d}</div>
                ) : (
                  <div style={{ fontSize:12, fontWeight:700, color:dow===0?'#b05050':dow===6?'#5070a0':'var(--td)' }}>{d}</div>
                )}
                {!isB && hasCls && !isSel && (
                  <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--g3)', marginTop:2 }}/>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:12, paddingLeft:2 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--g3)', flexShrink:0 }}/>
          <span style={{ fontSize:10, color:'var(--tmu)', fontWeight:500 }}>수업 있는 날</span>
        </div>

        <div style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid var(--g2)' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700 }}>내 수강권</div>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:4 }}>
              {ticket?`${ticket.total}회권 · 잔여 ${ticket.remain}회`:'수강권 없음'}
            </div>
            {ticket && (
              <>
                <div style={{ width:'100%', height:5, background:'rgba(255,255,255,0.5)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                  <div style={{ width: `${(ticket.remain / ticket.total) * 100}%`, height: '100%', background: ticket.remain/ticket.total >= 0.6 ? 'var(--g4)' : ticket.remain/ticket.total >= 0.3 ? 'var(--g3)' : '#c9a07a', transition: 'width 0.3s ease, background 0.3s ease' }}/>
                </div>
                <div style={{ fontSize:10, color:'var(--g4)', fontWeight:600 }}>만료: {ticket.expires_at}</div>
              </>
            )}
          </div>
          <div style={{ marginLeft:12 }}><PixelPlant ratio={ticket ? (ticket.remain / ticket.total) : 0}/></div>
        </div>

        {meetingTickets.length > 0 && (
          <div style={{ background:'#FFF8E1', borderRadius:14, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid #FFE082' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#F57F17', fontWeight:700, marginBottom:2 }}>👥 모임 참여권</div>
              {meetingTickets.map(mt => (
                <div key={mt.id} style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>
                  잔여 {mt.remain}/{mt.total}회 · 만료 {mt.expires_at}
                </div>
              ))}
            </div>
          </div>
        )}

        <div onClick={()=>router.push('/student/free')} style={{ background:'#FBF8F2', borderRadius:14, padding:'14px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid #E8DCC4', cursor:'pointer' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'#8B7355', fontWeight:700, marginBottom:2 }}>🎨 자율창작</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#5C5247', marginBottom:2 }}>1시간만, 자유롭게</div>
            <div style={{ fontSize:10, color:'#A89880' }}>평일 낮 6,000원부터</div>
          </div>
          <div style={{ fontSize:18, color:'#8B7355' }}>›</div>
        </div>

        <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>{month+1}월 {selectedDay}일 수업</div>

        {dc.length === 0 ? (
          <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 수업이 없어요 🐾</div>
        ) : (
          <>
            {cats.length > 1 && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수업 종류 선택</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {cats.map(cat => (
                    <div key={cat} onClick={() => {
                      if (cat === 'free') { router.push('/student/free'); return }
                      setSelCat(cat); setSelCourse(null); setSelSchedule(null)
                    }} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:20, cursor:'pointer', background:selCat===cat?ACCENT_BG:CARD, border:`1.5px solid ${selCat===cat?ACCENT:BORDER}` }}>
                      <span style={{ fontSize:16 }}>{EMOJI[cat]||'🎨'}</span>
                      <span style={{ fontSize:12, fontWeight:500, color:selCat===cat?ACCENT_TEXT:'var(--td)' }}>{CAT_NAME[cat]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cats.length === 1 && cats[0] === 'free' && (
              <div onClick={()=>router.push('/student/free')} style={{ padding:'14px 16px', background:'#FBF8F2', borderRadius:14, border:'1.5px solid #E8DCC4', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#5C5247' }}>🎨 자율창작 예약하러 가기</div>
                  <div style={{ fontSize:10, color:'#8B7355', marginTop:2 }}>자리와 시간을 직접 선택해요</div>
                </div>
                <div style={{ fontSize:18, color:'#8B7355' }}>›</div>
              </div>
            )}

            {cats.length === 1 && cats[0] !== 'free' && selCat !== cats[0] && (() => { setTimeout(() => setSelCat(cats[0]), 0); return null })()}

            {selCat && selCat !== 'free' && catCourses.length === 1 && selCourse !== catCourses[0] && (() => { setTimeout(() => setSelCourse(catCourses[0]), 0); return null })()}

            {selCat && selCat !== 'free' && catCourses.length > 0 && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                {catCourses.length > 1 && (
                  <div style={{ fontSize:11, fontWeight:500, color:'var(--tmu)', marginBottom:8 }}>수업 선택</div>
                )}
                {catCourses.map(c => {
                  const isOpen = selCourse?.id === c.id
                  const daySchedules = getSchedulesForDay(c, selectedDay)
                  return (
                    <div key={c.id} style={{ borderRadius:14, marginBottom:8, overflow:'hidden', border:`1.5px solid ${isOpen?ACCENT:BORDER}`, background:isOpen?ACCENT_BG:CARD }}>
                      <div onClick={() => { if (isOpen) { setSelCourse(null); setSelSchedule(null) } else { setSelCourse(c); setSelSchedule(null) } }}
                        style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:isOpen?ACCENT_TEXT:'var(--td)' }}>{c.name}</div>
                          <div style={{ fontSize:11, color:'var(--tmu)', marginTop:2 }}>
                            강사 {c.teacher}
                            {daySchedules.length > 0 && <span style={{ marginLeft:6 }}>{daySchedules.map(s=>`${s.start_time}~${s.end_time}`).join(' / ')}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize:16, color:isOpen?ACCENT:'var(--tmu)', display:'inline-block', transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'rotate(0deg)' }}>›</span>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop:`1px solid ${ACCENT}28`, padding:'6px 12px 12px' }}>
                          {daySchedules.length === 0 ? (
                            <div style={{ fontSize:11, color:'var(--tmu)', padding:'8px 0', textAlign:'center' }}>이 날 수업 시간이 없어요</div>
                          ) : daySchedules.map(s => {
                            const booked = isBooked(c.id, s.id, selectedDay)
                            const booking = getBooking(c.id, s.id, selectedDay)
                            const cnt = getBookingCount(c.id, s.id, selectedDay)
                            const remain = c.max_count - cnt
                            const full = remain <= 0 && !booked
                            const isSel = selSchedule?.id === s.id
                            return (
                              <div key={s.id}
                                onClick={() => { if (!full && !booked) setSelSchedule(isSel ? null : s) }}
                                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:10, marginBottom:6, background:booked?'#E8F5E0':'#fff', border:`1.5px solid ${booked?'#a8d9a0':isSel?ACCENT:BORDER}`, cursor:full||booked?'default':'pointer', opacity:full?0.45:1 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0, background:booked?'#6db870':isSel?ACCENT:'transparent', border:`2px solid ${booked?'#6db870':isSel?ACCENT:BORDER}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    {(booked||isSel) && <svg width="9" height="7" viewBox="0 0 9 7"><polyline points="1,3.5 3,6 8,1" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </div>
                                  <span style={{ fontSize:13, fontWeight:500, color:isSel?ACCENT_TEXT:'var(--td)' }}>{s.start_time}~{s.end_time}</span>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:11, fontWeight:500, color:full?'#c0392b':booked?'#6db870':isSel?ACCENT_TEXT:'var(--tmu)' }}>
                                    {booked?'예약됨':full?'마감':`${remain}자리 남음`}
                                  </span>
                                  {booked && (
                                    <button onClick={e=>{e.stopPropagation();handleCancel(booking)}}
                                      style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(255,255,255,0.8)', color:'var(--tm)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:500 }}>
                                      취소
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {selSchedule && !isBooked(selCourse?.id, selSchedule?.id, selectedDay) && (
              <div className="slide-up" style={{ marginBottom:14 }}>
                {isBookable(selectedDay) ? (
                  selCourse?.category === 'meeting' || (ticket && ticket.remain > 0) ? (
                    <button onClick={handleBook}
                      style={{ width:'100%', padding:'15px 20px', background:ACCENT, color:'#fff', border:'none', borderRadius:14, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                      {selCourse?.name} {selSchedule?.start_time}~{selSchedule?.end_time} 예약하기
                    </button>
                  ) : (
                    <div style={{ padding:'14px', background:'#ffebee', borderRadius:14, textAlign:'center', color:'#c0392b', fontSize:12, fontWeight:500 }}>잔여 수강권이 없어요 🐾</div>
                  )
                ) : (
                  <div style={{ padding:'14px', background:CARD, borderRadius:14, textAlign:'center', color:'var(--tmu)', fontSize:12, fontWeight:500 }}>{monthDiff() < 0 ? '지난 날짜는 예약할 수 없어요' : '예약은 다음 달까지만 가능해요'}</div>
                )}
              </div>
            )}
          </>
        )}

        {dayBookings.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>내 예약</div>
            {dayBookings.map(b => (
              <div key={b.id} style={{ background:b.status==='pending'?'#FFF3E0':'#e8f5e0', borderRadius:12, padding:'10px 14px', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between', border:`1.5px solid ${b.status==='pending'?'#E65100':'var(--g3)'}` }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{b.class_name}{b.seat?` · ${b.seat}자리`:''}</div>
                  <div style={{ fontSize:10, color:'var(--tm)' }}>{b.class_time}</div>
                  {b.status==='pending' && (<div style={{ fontSize:9, color:'#E65100', fontWeight:700, marginTop:2 }}>모임 확정 대기중</div>)}
                </div>
                <button onClick={() => handleCancel(b)} style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:'var(--g1)', color:'var(--tm)', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>취소</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ height:80 }}/>
      </div>

      <StudentNav active="schedule" />
    </>
  )
}
