'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const EMOJI = { drawing:'✏️', painting:'🎨', sculpture:'🗿', free:'🖼️' }

export default function StudentPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [bookings, setBookings] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const month = new Date().getMonth()
  const year = new Date().getFullYear()
  const today = new Date().getDate()
  const [loading, setLoading] = useState(true)

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
    const { data: c } = await supabase.from('class_slots').select('*').eq('is_active', true)
    setClasses(c || [])
    setLoading(false)
  }

  function bookedDays() {
    return new Set(bookings.map(b => new Date(b.class_date).getDate()))
  }

  function dayClasses(day) {
    const dow = new Date(year, month, day).getDay()
    return classes.filter(c => c.day_of_week === dow)
  }

  function isBooked(classId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.some(b => b.class_slot_id === classId && b.class_date === dateStr)
  }

  function getBooking(classId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.find(b => b.class_slot_id === classId && b.class_date === dateStr)
  }

  async function handleBook(cls) {
    if (!ticket || ticket.remain <= 0) { alert('잔여 수강권이 없어요 🐾'); return }
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    await supabase.from('bookings').insert({
      user_id: user.id, class_slot_id: cls.id, class_name: cls.name,
      class_date: dateStr, class_time: cls.time, teacher: cls.teacher, status:'booked'
    })
    await supabase.from('tickets').update({ remain: ticket.remain-1 }).eq('id', ticket.id)
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

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
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

        {/* 요일 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
          {['일','월','화','수','목','금','토'].map((d,i)=>(
            <div key={d} style={{ fontSize:10, fontWeight:700, padding:'3px 0',
              color:i===0?'#b05050':i===6?'#5070a0':'var(--tmu)' }}>{d}</div>
          ))}
        </div>

        {/* 달력 그리드 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:12 }}>
          {Array(firstDow).fill(null).map((_,i)=><div key={`e${i}`} style={{ height:46 }}/>)}
          {Array(daysInMonth).fill(null).map((_,i)=>{
            const d=i+1
            const dow=new Date(year,month,d).getDay()
            const isMon=dow===1
            const isB=bd.has(d)
            const isSel=d===selectedDay
            const isT=d===today
            return (
              <div key={d} onClick={()=>!isMon&&setSelectedDay(d)}
                style={{ height:46, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  cursor:isMon?'default':'pointer', borderRadius:12, opacity:isMon?0.3:1,
                  background:isSel&&!isB?'#e8f5e0':'transparent' }}>
                {isB ? (
                  <div style={{ textAlign:'center', lineHeight:1.1 }}>
                    <div style={{ fontSize:14 }}>🐱</div>
                    <div style={{ fontSize:9, fontWeight:800, color:'var(--td)' }}>{d}</div>
                  </div>
                ) : isT ? (
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--g4)', color:'#fff',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>{d}</div>
                ) : (
                  <div style={{ fontSize:12, fontWeight:700,
                    color:dow===0?'#b05050':dow===6?'#5070a0':'var(--td)' }}>{d}</div>
                )}
                {!isB && dayClasses(d).length>0 && (
                  <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--g3)', marginTop:2 }}/>
                )}
              </div>
            )
          })}
        </div>

        {/* 수강권 */}
        <div style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', marginBottom:10,
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

        {/* 수업 목록 */}
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>
          {month+1}월 {selectedDay}일 수업
        </div>

        {dc.length===0 ? (
          <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 수업이 없어요 🐾</div>
        ) : dc.map(cls=>{
          const booked=isBooked(cls.id, selectedDay)
          const booking=getBooking(cls.id, selectedDay)
          return (
            <div key={cls.id} style={{ background:booked?'#e8f5e0':'var(--bg)', borderRadius:14, padding:'12px 14px',
              marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between',
              border:`1.5px solid ${booked?'var(--g3)':'var(--g1)'}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:booked?'var(--g2)':'var(--g1)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                  {EMOJI[cls.category]||'🎨'}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{cls.name}</div>
                  <div style={{ fontSize:10, color:'var(--tm)', fontWeight:600 }}>{cls.time}</div>
                  <div style={{ fontSize:10, color:'var(--tmu)' }}>강사 {cls.teacher}</div>
                </div>
              </div>
              <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)' }}>{cls.current_count||0}/{cls.max_count}명</div>
                <button onClick={()=>booked?handleCancel(booking):handleBook(cls)}
                  style={{ fontSize:10, padding:'4px 12px', borderRadius:20,
                    background:booked?'var(--g1)':'var(--g4)', color:booked?'var(--tm)':'#fff',
                    border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                  {booked?'예약취소':'예약하기'}
                </button>
              </div>
            </div>
          )
        })}
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