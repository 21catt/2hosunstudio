'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { sendPushToAdmins } from '../../../lib/pushNotify'


const DEPOSIT = { bank: '카카오뱅크', account: '3333038381397', holder: '양승민' }

function getHourlyRate(date, hour) {
  const dow = date.getDay()
  const isWeekend = dow === 0 || dow === 6
  if (isWeekend) return 10000
  if (hour >= 17) return 8000
  return 6000
}

function getRateLabel(date, hour) {
  const dow = date.getDay()
  const isWeekend = dow === 0 || dow === 6
  if (isWeekend) return '주말'
  if (hour >= 17) return '평일 저녁'
  return '평일 낮'
}

function FreeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayD = now.getDate()

  const initDate = (() => {
    const raw = searchParams.get('date')
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
    const d = new Date(raw + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  })()

  const [user, setUser] = useState(null)
  const [userName, setUserName] = useState('')
  const [allBookings, setAllBookings] = useState([])
  const [freeCourse, setFreeCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [depositModal, setDepositModal] = useState(null)

  const [year, setYear] = useState(initDate ? initDate.getFullYear() : todayY)
  const [month, setMonth] = useState(initDate ? initDate.getMonth() : todayM)
  const [selectedDay, setSelectedDay] = useState(initDate ? initDate.getDate() : todayD)
  const [startHour, setStartHour] = useState(null)
  const [duration, setDuration] = useState(1)
  const [selSeat, setSelSeat] = useState(null)
  const [seatPhotos, setSeatPhotos] = useState({})
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => { setPhotoIdx(0) }, [selSeat])
  const photoTouchX = useRef(null)
  function handlePhotoTouchEnd(e, len) {
    if (photoTouchX.current == null || len < 2) return
    const delta = e.changedTouches[0].clientX - photoTouchX.current
    photoTouchX.current = null
    if (Math.abs(delta) < 50) return        // 50px 미만은 무시 (살짝 터치 방지)
    if (delta < 0) setPhotoIdx(i => (i + 1) % len)            // 왼쪽으로 밀면 다음
    else setPhotoIdx(i => (i - 1 + len) % len)               // 오른쪽으로 밀면 이전
  }

  useEffect(() => {
    if (selSeat && startHour) {
      const currentOcc = getSeatOccupancyRange(selectedDay, startHour, duration)
      if (currentOcc[selSeat]) setSelSeat(null)
    }
  }, [selSeat, startHour, duration, selectedDay])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      const { data: profile } = await supabase.from('users').select('name').eq('id', data.user.id).single()
      setUserName(profile?.name || '')
      loadData()
    })
  }, [])

  async function loadData() {
    const { data: sp } = await supabase.from('seat_photos').select('*').order('sort_order', { ascending: true })
    const grouped = {}
    ;(sp || []).forEach(p => {
      if (!grouped[p.seat_id]) grouped[p.seat_id] = []
      grouped[p.seat_id].push(p)
    })
    setSeatPhotos(grouped)

    const { data: ab } = await supabase.from('bookings').select('class_date, class_time, seat').eq('status', 'booked')
    setAllBookings(ab || [])

    const { data: courses } = await supabase
      .from('class_courses')
      .select('*')
      .eq('category', 'free')
      .eq('is_active', true)
      .limit(1)
    setFreeCourse(courses?.[0] || null)

    setLoading(false)
  }

  function monthDiff() {
    return (year - todayY) * 12 + (month - todayM)
  }

  function changeMonth(delta) {
    const newDate = new Date(year, month + delta, 1)
    const diff = (newDate.getFullYear() - todayY) * 12 + (newDate.getMonth() - todayM)
    if (diff < -1 || diff > 1) return
    setYear(newDate.getFullYear())
    setMonth(newDate.getMonth())
    setSelectedDay(1)
    setStartHour(null)
  }

  function getSeatOccupancyAtHour(day, hour) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const occupied = { A: false, B: false, C: false, D: false, E: false }
    const autoSeatOrder = ['D', 'E', 'C', 'B', 'A']

    const relevant = allBookings.filter(b => {
      if (b.class_date !== dateStr) return false
      const [start, end] = (b.class_time || '').split('~')
      if (!start || !end) return false
      const sh = parseInt(start.split(':')[0])
      const eh = parseInt(end.split(':')[0])
      return hour >= sh && hour < eh
    })

    relevant.forEach(b => {
      if (b.seat) occupied[b.seat] = true
    })

    let autoIndex = 0
    relevant.forEach(b => {
      if (!b.seat) {
        while (autoIndex < autoSeatOrder.length && occupied[autoSeatOrder[autoIndex]]) {
          autoIndex++
        }
        if (autoIndex < autoSeatOrder.length) {
          occupied[autoSeatOrder[autoIndex]] = true
          autoIndex++
        }
      }
    })

    return occupied
  }

  function getSeatOccupancyRange(day, startH, dur) {
    const merged = { A: false, B: false, C: false, D: false, E: false }
    for (let h = startH; h < startH + dur; h++) {
      const occ = getSeatOccupancyAtHour(day, h)
      Object.keys(occ).forEach(k => {
        if (occ[k]) merged[k] = true
      })
    }
    return merged
  }

  function calcPrice(day, startH, dur) {
    const date = new Date(year, month, day)
    let total = 0
    for (let h = startH; h < startH + dur; h++) {
      total += getHourlyRate(date, h)
    }
    return total
  }

  async function handleBook() {
    if (!startHour || !selSeat) return

    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    const startStr = `${String(startHour).padStart(2,'0')}:00`
    const endStr = `${String(startHour + duration).padStart(2,'0')}:00`
    const amount = calcPrice(selectedDay, startHour, duration)
    const name = userName || '학생'

    // 입금 안내 모달을 먼저 즉시 표시 (저장·알림은 백그라운드) — 클릭 즉시 반응
    setDepositModal({ amount, dateStr, time: `${startStr}~${endStr}`, seat: selSeat, name })

    supabase.from('bookings').insert({
      user_id: user.id,
      course_id: freeCourse?.id || null,
      schedule_id: null,
      class_name: '자율창작',
      class_date: dateStr,
      class_time: `${startStr}~${endStr}`,
      teacher: freeCourse?.teacher || '',
      status: 'booked',
      seat: selSeat,
      confirmed: false,
      amount,
    }).then(({ error }) => {
      if (error) return
      const pushMsg = `${name}님 자율창작 ${dateStr} ${startStr}~${endStr} ${selSeat}자리 (입금대기)`
      if (freeCourse?.teacher_id) {
        supabase.from('notifications').insert({
          user_id: freeCourse.teacher_id,
          type: 'booking_created',
          title: '자율창작 예약 (입금대기)',
          body: pushMsg
        })
      }
      sendPushToAdmins('🎨 자율창작 예약', pushMsg)
      fetch('/api/kakao/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `새 자율창작 예약 🐾 (입금대기)\n${dateStr} ${startStr}~${endStr}\n${selSeat}자리 · ${amount.toLocaleString()}원`,
          link: 'https://2hosunstudio.vercel.app/admin',
        }),
      }).catch(() => {})
    })
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🎨</div>
    </div>
  )


  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const selDate = new Date(year, month, selectedDay)
  const occ = startHour ? getSeatOccupancyRange(selectedDay, startHour, duration) : { A:false, B:false, C:false, D:false, E:false }
  const price = startHour ? calcPrice(selectedDay, startHour, duration) : 0

  const dateLabel = `${year}.${String(month+1).padStart(2,'0')}.${String(selectedDay).padStart(2,'0')} ${['일','월','화','수','목','금','토'][selDate.getDay()]}요일`
  const rateLabel = startHour ? getRateLabel(selDate, startHour) : '평일 낮'
  const hourlyRate = startHour ? getHourlyRate(selDate, startHour) : 6000

  return (
    <>
      {depositModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:'22px 20px', maxWidth:340, width:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--td)' }}>예약 접수 완료</div>
              <span style={{ fontSize:10, fontWeight:700, background:'#FFF3CD', color:'#856404', padding:'3px 8px', borderRadius:20, border:'1px solid #FFD700' }}>입금 대기</span>
            </div>

            <div style={{ background:'var(--surf)', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:4 }}>{depositModal.dateStr} {depositModal.time} · {depositModal.seat}자리</div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--td)' }}>{depositModal.amount.toLocaleString()}원</div>
            </div>

            <div style={{ background:'var(--bg)', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:6 }}>입금 계좌</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--td)', lineHeight:1.8 }}>
                {DEPOSIT.bank}<br/>
                {DEPOSIT.account}<br/>
                예금주: {DEPOSIT.holder}
              </div>
            </div>

            <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.7, marginBottom:14 }}>
              · 입금자명: <strong>{depositModal.name}</strong> 으로 입금해 주세요.<br/>
              · 24시간 내 입금하지 않으면 자동으로 취소됩니다.
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(DEPOSIT.account).catch(() => {})
                  alert(`계좌번호가 복사됐어요!\n${DEPOSIT.account}`)
                }}
                style={{ flex:1, padding:'11px', background:'var(--acBg)', color:'var(--acTx)', border:'1px solid rgb(var(--ac-rgb) / 0.2)', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                계좌 복사
              </button>
              <button
                onClick={() => { setDepositModal(null); router.push('/student') }}
                style={{ flex:1, padding:'11px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>router.push('/student')}
            style={{ background:'var(--surf)', border:'1.5px solid var(--g2)', borderRadius:8, padding:'4px 10px', color:'var(--td)', fontSize:14, cursor:'pointer' }}>
            ←
          </button>
          <span className="p-title">자율창작</span>
        </div>
      </div>

      <div style={{ background:'#fff', padding:'8px 14px 100px' }}>

        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <button onClick={()=>changeMonth(-1)} disabled={monthDiff()<=-1}
              style={{ background:'transparent', border:'none', fontSize:18, color:'var(--g4)', cursor:'pointer', opacity:monthDiff()<=-1?0.3:1 }}>‹</button>
            <span style={{ fontSize:16, fontWeight:800, color:'var(--td)' }}>
              {year}.{String(month+1).padStart(2,'0')}
            </span>
            <button onClick={()=>changeMonth(1)} disabled={monthDiff()>=1}
              style={{ background:'transparent', border:'none', fontSize:18, color:'var(--g4)', cursor:'pointer', opacity:monthDiff()>=1?0.3:1 }}>›</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
            {['일','월','화','수','목','금','토'].map((d,i)=>(
              <div key={d} style={{ fontSize:10, fontWeight:700, padding:'3px 0',
                color:i===0?'#b05050':i===6?'#5070a0':'var(--tmu)' }}>{d}</div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {Array(firstDow).fill(null).map((_,i)=><div key={`e${i}`} style={{ height:38 }}/>)}
            {Array(daysInMonth).fill(null).map((_,i)=>{
              const d = i+1
              const dow = new Date(year,month,d).getDay()
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
              const todayStr = `${todayY}-${String(todayM+1).padStart(2,'0')}-${String(todayD).padStart(2,'0')}`
              const isPast = dateStr < todayStr
              const isSel = d===selectedDay
              const isT = year===todayY && month===todayM && d===todayD

              return (
                <div key={d}
                  onClick={()=>{ if(!isPast){ setSelectedDay(d); setStartHour(null) } }}
                  style={{ height:38, display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:isPast?'default':'pointer', borderRadius:10, opacity:isPast?0.25:1,
                    background:isSel?'var(--g4)':isT?'var(--g1)':'transparent',
                    color:isSel?'#fff':dow===0?'#b05050':dow===6?'#5070a0':'var(--td)',
                    fontSize:12, fontWeight:isSel||isT?800:700 }}>
                  {d}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background:'var(--surf)', borderRadius:14, padding:'14px 16px', marginBottom:14, border:'1.5px solid var(--g2)' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:6 }}>
            오늘 1시간, 자유롭게 🐾
          </div>
          <div style={{ fontSize:11, color:'var(--tm)', lineHeight:1.6 }}>
            원하는 자리에서 자유롭게 그려요.<br/>
            평일 낮 6,000원 · 저녁 8,000원 · 주말 10,000원 (1시간)
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>시작 시간</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:5 }}>
            {Array.from({length:12}, (_,i)=>10+i).map(h => {
              const date = new Date(year, month, selectedDay)
              const rate = getHourlyRate(date, h)
              const isNight = h >= 17
              const isWeekend = date.getDay()===0 || date.getDay()===6
              const isSel = startHour===h
              return (
                <div key={h} onClick={()=>{ setStartHour(h) }}
                  style={{ padding:'8px 4px', borderRadius:10, textAlign:'center', cursor:'pointer',
                    background:isSel?'var(--g4)':'var(--bg)',
                    color:isSel?'#fff':'var(--td)',
                    border:`1.5px solid ${isSel?'var(--g4)':'var(--g1)'}` }}>
                  <div style={{ fontSize:12, fontWeight:800 }}>{h}시</div>
                  <div style={{ fontSize:8, color:isSel?'#fff':isWeekend?'#b05050':isNight?'#7B4F00':'var(--tmu)', marginTop:1, fontWeight:600 }}>
                    {(rate/1000)|0}w
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {startHour && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>사용 시간</div>
            <div style={{ display:'flex', gap:6 }}>
              {[1,2,3,4].map(d => {
                const isSel = duration===d
                const endHour = startHour + d
                const valid = endHour <= 22
                return (
                  <div key={d} onClick={()=>{ if(valid){ setDuration(d) } }}
                    style={{ flex:1, padding:'10px', borderRadius:10, textAlign:'center', cursor:valid?'pointer':'default', opacity:valid?1:0.3,
                      background:isSel?'var(--g4)':'var(--bg)',
                      color:isSel?'#fff':'var(--td)',
                      border:`1.5px solid ${isSel?'var(--g4)':'var(--g1)'}`,
                      fontSize:12, fontWeight:700 }}>
                    {d}시간
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {startHour && (
          <div style={{ background:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:14, border:'1.5px solid var(--g1)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
              <div style={{ fontSize:11, color:'var(--tmu)' }}>{dateLabel}</div>
              <div style={{ fontSize:10, color:'#7B4F00', background:'#FAEEDA', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>
                {rateLabel} · {hourlyRate.toLocaleString()}원/시간
              </div>
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--td)' }}>
              {startHour}시 ~ {startHour + duration}시
            </div>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>자리 선택</div>
            <div style={{ background:'var(--surf)', borderRadius:14, padding:'14px 12px', border:'1.5px solid var(--g1)' }}>
              <div style={{ textAlign:'center', fontSize:9, color:'var(--tm)', marginBottom:8, letterSpacing:2, fontWeight:600 }}>─── 창가 ───</div>

              {(() => {
                const seats = [
                  { id:'A', x:80, y:100, label:'창가·자연광' },
                  { id:'B', x:170, y:100, label:'창가·자연광' },
                  { id:'C', x:295, y:120, label:'중앙' },
                  { id:'D', x:385, y:120, label:'중앙' },
                  { id:'E', x:290, y:220, label:'창가' },
                ]
                return (
                  <svg viewBox="0 0 560 320" style={{ width:'100%', display:'block' }}>
                    <defs>
                      <pattern id="woodFree" patternUnits="userSpaceOnUse" width="18" height="18">
                        <rect width="18" height="18" fill="#F4EDE0"/>
                        <line x1="0" y1="0" x2="18" y2="0" stroke="#E8DCC4" strokeWidth="0.3"/>
                        <line x1="0" y1="18" x2="18" y2="18" stroke="#E8DCC4" strokeWidth="0.3"/>
                      </pattern>
                    </defs>

                    <path d="M 40 60 L 250 60 L 250 100 L 540 100 L 540 270 L 200 270 L 200 230 L 40 230 Z"
                          fill="url(#woodFree)" stroke="#D4C9B0" strokeWidth="0.8"/>

                    <rect x="455" y="150" width="70" height="90" rx="20" fill="#E0D2B5" stroke="#C9B894" strokeWidth="0.6"/>
                    <text x="490" y="200" textAnchor="middle" fontSize="10" fill="#8B7355" fontWeight="500">테이블</text>

                    {seats.map(s => {
                      const isOcc = occ[s.id]
                      const isSel = selSeat === s.id
                      const bg = isSel ? '#7FA85A' : isOcc ? '#E8C9B8' : '#F0EAE0'
                      const stroke = isSel ? '#5C8540' : isOcc ? '#C99880' : '#C9B894'
                      const textColor = isSel ? '#FFFFFF' : isOcc ? '#7A4530' : 'var(--td)'
                      const labelColor = isSel ? '#5C8540' : isOcc ? '#A07560' : 'var(--tm)'
                      return (
                        <g key={s.id} style={{ cursor: isOcc ? 'not-allowed' : 'pointer', opacity: isOcc ? 0.7 : 1 }}
                          onClick={() => !isOcc && setSelSeat(s.id)}>
                          <rect x={s.x} y={s.y} width="34" height="34" rx="7" fill={bg} stroke={stroke} strokeWidth={isSel ? 1.5 : 1}/>
                          <text x={s.x+17} y={s.y+23} textAnchor="middle" fontSize="15" fontWeight="500" fill={textColor}>{s.id}</text>
                          {isSel && (
                            <>
                              <circle cx={s.x+28} cy={s.y+4} r="5" fill="#FFFFFF" stroke="#5C8540" strokeWidth="1"/>
                              <path d={`M ${s.x+25.5} ${s.y+4} L ${s.x+27.5} ${s.y+6} L ${s.x+30.5} ${s.y+3}`}
                                    stroke="#5C8540" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          )}
                          <text x={s.x+17} y={s.y+48} textAnchor="middle" fontSize="9" fill={labelColor} fontWeight={isSel ? 600 : 500}>
                            {isOcc ? '사용 중' : s.label}
                          </text>
                        </g>
                      )
                    })}

                    <line x1="40" y1="210" x2="22" y2="210" stroke="#8B7355" strokeWidth="1.8"/>
                    <text x="18" y="204" fontSize="10" fill="#8B7355" fontWeight="500" textAnchor="end">입구</text>

                    <text x="290" y="295" textAnchor="middle" fontSize="11" fill="#8B7355" fontWeight="500" letterSpacing="3">─── 창가 ───</text>
                  </svg>
                )
              })()}

              <div style={{ display:'flex', justifyContent:'center', gap:12, fontSize:9, color:'var(--tmu)', marginTop:8 }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ display:'inline-block', width:10, height:10, borderRadius:3, background:'#7FA85A' }}/>선택
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ display:'inline-block', width:10, height:10, borderRadius:3, background:'#F0EAE0', border:'0.5px solid #C9B894' }}/>가능
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ display:'inline-block', width:10, height:10, borderRadius:3, background:'#E8C9B8', opacity:0.7 }}/>사용 중
                </span>
              </div>
            </div>
          </div>

        {selSeat && seatPhotos[selSeat]?.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>{selSeat} 자리 사진</div>
          <div style={{ position:'relative', borderRadius:14, overflow:'hidden', aspectRatio:'4/3', background:'#f0ede8' }}
              onTouchStart={(e) => { photoTouchX.current = e.touches[0].clientX }}
              onTouchEnd={(e) => handlePhotoTouchEnd(e, seatPhotos[selSeat].length)}>
              <img src={seatPhotos[selSeat][photoIdx].image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
              {seatPhotos[selSeat].length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx(i => (i - 1 + seatPhotos[selSeat].length) % seatPhotos[selSeat].length)}
                    style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', width:44, height:44, borderRadius:'50%', background:'rgba(0,0,0,0.45)', color:'#fff', border:'none', fontSize:26, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
                  <button onClick={() => setPhotoIdx(i => (i + 1) % seatPhotos[selSeat].length)}
                    style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:44, height:44, borderRadius:'50%', background:'rgba(0,0,0,0.45)', color:'#fff', border:'none', fontSize:26, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
                  <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
                    {seatPhotos[selSeat].map((_,i) => (
                      <div key={i} onClick={() => setPhotoIdx(i)} style={{ width:8, height:8, borderRadius:'50%', background:i===photoIdx?'#fff':'rgba(255,255,255,0.5)', cursor:'pointer' }}/>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {startHour && selSeat && (
          <div style={{ background:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:14, border:'1.5px solid var(--g1)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--tmu)', marginBottom:6 }}>
              <span>{selSeat} 자리 · {duration}시간</span>
              <span>{price.toLocaleString()}원</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', paddingTop:10, borderTop:'1px solid var(--g1)' }}>
              <span style={{ fontSize:12, color:'var(--tmu)' }}>결제 금액</span>
              <span style={{ fontSize:20, fontWeight:800, color:'var(--td)' }}>{price.toLocaleString()}원</span>
            </div>
          </div>
        )}

        {startHour && (
          selSeat ? (
            <button onClick={handleBook}
              style={{ width:'100%', padding:'14px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:14, fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
              {selSeat} 자리 예약하기
            </button>
          ) : (
            <div style={{ padding:'14px', background:'var(--bg)', borderRadius:14, textAlign:'center', color:'var(--tmu)', fontSize:12, fontWeight:700 }}>
              자리를 선택해 주세요
            </div>
          )
        )}

        <div style={{ background:'var(--surf)', borderRadius:14, padding:'14px 16px', marginTop:14, border:'1.5px solid var(--g2)' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:10 }}>
            이용 전 꼭 읽어주세요 🐾
          </div>
          <div style={{ fontSize:11, color:'var(--tm)', lineHeight:1.9 }}>
            <div>· 사용한 자리는 깨끗이 정리하고 떠나주세요.</div>
            <div>· 미디엄 · 세척통 · 유리 파레트는 자유롭게 사용할 수 있어요.</div>
            <div>· 물감 · 붓 등 개인 도구는 직접 준비해 주세요.</div>
            <div>· 휴지와 유리 파레트는 사용 후 직접 치워주세요.</div>
            <div>· 작업 중 나온 쓰레기는 분리수거 해주세요.</div>
            <div>· 예약 시간 안에 정리까지 마쳐주세요.</div>
            <div>· 의자나 집기 오염이 심한 경우 배상을 요청드릴 수 있어요.</div>
            <div>· 다른 분들을 위해 통화 · 큰 소리는 자제해 주세요.</div>
            <div>· 완성한 작품은 당일 가져가 주세요. 보관은 어려워요.</div>
            <div>· 예약 시작 6시간 전까지만 취소 및 환불이 가능해요.</div>
          </div>
        </div>

        <div style={{ background:'var(--surf)', borderRadius:14, padding:'14px 16px', marginTop:10, border:'1.5px solid var(--g2)' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:10 }}>
            작품 보관 안내 🖼️
          </div>
          <div style={{ fontSize:11, color:'var(--tm)', lineHeight:1.9 }}>
            <div>· 덜 마른 작품은 건조대에 두고 가실 수 있어요.</div>
            <div>· 보관은 최대 2주이며, 기간 안에 찾아가 주세요.</div>
            <div>· 맡기실 땐 라벨에 이름 · 날짜 · 연락처를 적어주세요.</div>
            <div>· 2주가 지난 작품은 폐기될 수 있어요. (맡기시면 이에 동의하는 것으로 봐요.)</div>
          </div>
        </div>
      </div>

      <StudentNav active="calendar" />
    </>
  )
}

export default function FreePage() {
  return (
    <Suspense fallback={null}>
      <FreeInner />
    </Suspense>
  )
}
