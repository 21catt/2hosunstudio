'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'

// 媛�寃� 怨꾩궛
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
  if (isWeekend) return '二쇰쭚'
  if (hour >= 17) return '�됱씪 ����'
  return '�됱씪 ��'
}

export default function FreePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [allBookings, setAllBookings] = useState([])
  const [freeCourse, setFreeCourse] = useState(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayD = now.getDate()

  const [year, setYear] = useState(todayY)
  const [month, setMonth] = useState(todayM)
  const [selectedDay, setSelectedDay] = useState(todayD)
  const [startHour, setStartHour] = useState(null)
  const [duration, setDuration] = useState(1)
  const [selSeat, setSelSeat] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadData()
    })
  }, [])

  async function loadData() {
    const { data: ab } = await supabase.from('bookings').select('class_date, class_time, seat')
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
    setSelSeat(null)
  }

  // �뱀젙 �쒓컙�� �먮━ �먯쑀 �곹깭
  function getSeatOccupancyAtHour(day, hour) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    
    const occupied = { A: false, B: false, C: false, D: false, E: false }
    const autoSeatOrder = ['D', 'E', 'C', 'B', 'A']

    // �대떦 �쒓컙�� �ы븿�섎뒗 紐⑤뱺 �덉빟 李얘린
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

  // �ъ슜 �쒓컙 �꾩껜 �숈븞 �먯쑀 �곹깭
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

  // 媛�寃� 怨꾩궛 (�쒓컙��蹂꾨줈 �ㅻ� �� �덉뼱�� �⑹궛)
  function calcPrice(day, startH, dur) {
    const date = new Date(year, month, day)
    let total = 0
    for (let h = startH; h < startH + dur; h++) {
      total += getHourlyRate(date, h)
    }
    return total
  }

  async function handleBook() {
    if (!startHour || !selSeat || !freeCourse) return
    
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    const startStr = `${String(startHour).padStart(2,'0')}:00`
    const endStr = `${String(startHour + duration).padStart(2,'0')}:00`

    await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: freeCourse.id,
      schedule_id: null,
      class_name: '�먯쑉李쎌옉',
      class_date: dateStr,
      class_time: `${startStr}~${endStr}`,
      teacher: freeCourse.teacher || '',
      status: 'booked',
      seat: selSeat
    })

    if (freeCourse.teacher_id) {
      const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
      await supabase.from('notifications').insert({
        user_id: freeCourse.teacher_id,
        type: 'booking_created',
        title: '�먯쑉李쎌옉 �덉빟',
        body: `${profile?.name || '�숈깮'}�섏씠 ${dateStr} ${startStr}~${endStr} ${selSeat}�먮━ �덉빟`
      })
    }

    alert('�덉빟 �꾨즺! �맽')
    router.push('/student')
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>�렓</div>
    </div>
  )

  if (!freeCourse) return (
    <div style={{ padding:20, textAlign:'center' }}>
      <div style={{ fontSize:14, color:'var(--td)', marginBottom:14 }}>�꾩쭅 �먯쑉李쎌옉�� �대━吏� �딆븯�댁슂</div>
      <button onClick={()=>router.push('/student')}
        style={{ padding:'10px 18px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:12, fontWeight:700, cursor:'pointer' }}>
        �뚯븘媛�湲�
      </button>
    </div>
  )

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const selDate = new Date(year, month, selectedDay)
  const occ = startHour ? getSeatOccupancyRange(selectedDay, startHour, duration) : { A:false, B:false, C:false, D:false, E:false }
  const price = startHour ? calcPrice(selectedDay, startHour, duration) : 0
  
  const dateLabel = `${year}.${String(month+1).padStart(2,'0')}.${String(selectedDay).padStart(2,'0')} ${['��','��','��','��','紐�','湲�','��'][selDate.getDay()]}�붿씪`
  const rateLabel = startHour ? getRateLabel(selDate, startHour) : '�됱씪 ��'
  const hourlyRate = startHour ? getHourlyRate(selDate, startHour) : 6000

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>router.push('/student')}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, padding:'4px 10px', color:'#fff', fontSize:14, cursor:'pointer' }}>
            ��
          </button>
          <span className="header-title">�먯쑉李쎌옉</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 100px' }}>
        
        {/* �덈궡 */}
        <div style={{ background:'#FBF8F2', borderRadius:14, padding:'14px 16px', marginBottom:14, border:'1.5px solid #E8DCC4' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#5C5247', marginBottom:6 }}>
            �ㅻ뒛 1�쒓컙, �먯쑀濡�쾶 �맽
          </div>
          <div style={{ fontSize:11, color:'#8B7355', lineHeight:1.6 }}>
            �먰븯�� �먮━�먯꽌 �먯쑀濡�쾶 洹몃젮��.<br/>
            �됱씪 �� 6,000�� 쨌 ���� 8,000�� 쨌 二쇰쭚 10,000�� (1�쒓컙)
          </div>
        </div>

        {/* �좎쭨 �좏깮 */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <button onClick={()=>changeMonth(-1)} disabled={monthDiff()<=-1}
              style={{ background:'transparent', border:'none', fontSize:18, color:'var(--g4)', cursor:'pointer', opacity:monthDiff()<=-1?0.3:1 }}>��</button>
            <span style={{ fontSize:16, fontWeight:800, color:'var(--td)' }}>
              {year}.{String(month+1).padStart(2,'0')}
            </span>
            <button onClick={()=>changeMonth(1)} disabled={monthDiff()>=1}
              style={{ background:'transparent', border:'none', fontSize:18, color:'var(--g4)', cursor:'pointer', opacity:monthDiff()>=1?0.3:1 }}>��</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
            {['��','��','��','��','紐�','湲�','��'].map((d,i)=>(
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
                  onClick={()=>{ if(!isPast){ setSelectedDay(d); setStartHour(null); setSelSeat(null) } }}
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

        {/* �쒖옉 �쒓컙 + �ъ슜 �쒓컙 */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>�쒖옉 �쒓컙</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:5 }}>
            {Array.from({length:12}, (_,i)=>10+i).map(h => {
              const date = new Date(year, month, selectedDay)
              const rate = getHourlyRate(date, h)
              const isNight = h >= 17
              const isWeekend = date.getDay()===0 || date.getDay()===6
              const isSel = startHour===h
              return (
                <div key={h} onClick={()=>{ setStartHour(h); setSelSeat(null) }}
                  style={{ padding:'8px 4px', borderRadius:10, textAlign:'center', cursor:'pointer',
                    background:isSel?'var(--g4)':'var(--bg)',
                    color:isSel?'#fff':'var(--td)',
                    border:`1.5px solid ${isSel?'var(--g4)':'var(--g1)'}` }}>
                  <div style={{ fontSize:12, fontWeight:800 }}>{h}��</div>
                  <div style={{ fontSize:8, color:isSel?'#fff':isWeekend?'#b05050':isNight?'#7B4F00':'var(--tmu)', marginTop:1, fontWeight:600 }}>
                    {(rate/1000)|0}k
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {startHour && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>�ъ슜 �쒓컙</div>
            <div style={{ display:'flex', gap:6 }}>
              {[1,2,3,4].map(d => {
                const isSel = duration===d
                const endHour = startHour + d
                const valid = endHour <= 22
                return (
                  <div key={d} onClick={()=>{ if(valid){ setDuration(d); setSelSeat(null) } }}
                    style={{ flex:1, padding:'10px', borderRadius:10, textAlign:'center', cursor:valid?'pointer':'default', opacity:valid?1:0.3,
                      background:isSel?'var(--g4)':'var(--bg)',
                      color:isSel?'#fff':'var(--td)',
                      border:`1.5px solid ${isSel?'var(--g4)':'var(--g1)'}`,
                      fontSize:12, fontWeight:700 }}>
                    {d}�쒓컙
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* �쒓컙 �덈궡 移대뱶 */}
        {startHour && (
          <div style={{ background:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:14, border:'1.5px solid var(--g1)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
              <div style={{ fontSize:11, color:'var(--tmu)' }}>{dateLabel}</div>
              <div style={{ fontSize:10, color:'#7B4F00', background:'#FAEEDA', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>
                {rateLabel} 쨌 {hourlyRate.toLocaleString()}��/�쒓컙
              </div>
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--td)' }}>
              {startHour}�� ~ {startHour + duration}��
            </div>
          </div>
        )}

        {/* �먮━ �좏깮 */}
        {startHour && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>�먮━ �좏깮</div>
            <div style={{ background:'#FBF8F2', borderRadius:14, padding:'14px 12px', border:'1.5px solid var(--g1)' }}>
              <div style={{ textAlign:'center', fontSize:9, color:'#8B7355', marginBottom:8, letterSpacing:2, fontWeight:600 }}>������ 李쎄� ������</div>

              {(() => {
                const seats = [
                  { id:'A', x:80, y:100, label:'李쎄�쨌�먯뿰愿�' },
                  { id:'B', x:170, y:100, label:'李쎄�쨌�먯뿰愿�' },
                  { id:'C', x:295, y:120, label:'以묒븰' },
                  { id:'D', x:385, y:120, label:'以묒븰' },
                  { id:'E', x:290, y:220, label:'李쎄�' },
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
                    <text x="490" y="200" textAnchor="middle" fontSize="10" fill="#8B7355" fontWeight="500">�뚯씠釉�</text>

                    {seats.map(s => {
                      const isOcc = occ[s.id]
                      const isSel = selSeat === s.id
                      const bg = isSel ? '#7FA85A' : isOcc ? '#E8C9B8' : '#F0EAE0'
                      const stroke = isSel ? '#5C8540' : isOcc ? '#C99880' : '#C9B894'
                      const textColor = isSel ? '#FFFFFF' : isOcc ? '#7A4530' : '#5C5247'
                      const labelColor = isSel ? '#5C8540' : isOcc ? '#A07560' : '#8B7355'
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
                            {isOcc ? '�ъ슜 以�' : s.label}
                          </text>
                        </g>
                      )
                    })}

                    <line x1="40" y1="210" x2="22" y2="210" stroke="#8B7355" strokeWidth="1.8"/>
                    <text x="18" y="204" fontSize="10" fill="#8B7355" fontWeight="500" textAnchor="end">�낃뎄</text>

                    <text x="290" y="295" textAnchor="middle" fontSize="11" fill="#8B7355" fontWeight="500" letterSpacing="3">������ 李쎄� ������</text>
                  </svg>
                )
              })()}

              <div style={{ display:'flex', justifyContent:'center', gap:12, fontSize:9, color:'var(--tmu)', marginTop:8 }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ display:'inline-block', width:10, height:10, borderRadius:3, background:'#7FA85A' }}/>�좏깮
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ display:'inline-block', width:10, height:10, borderRadius:3, background:'#F0EAE0', border:'0.5px solid #C9B894' }}/>媛���
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ display:'inline-block', width:10, height:10, borderRadius:3, background:'#E8C9B8', opacity:0.7 }}/>�ъ슜 以�
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 媛�寃� */}
        {startHour && selSeat && (
          <div style={{ background:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:14, border:'1.5px solid var(--g1)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--tmu)', marginBottom:6 }}>
              <span>{selSeat} �먮━ 쨌 {duration}�쒓컙</span>
              <span>{price.toLocaleString()}��</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', paddingTop:10, borderTop:'1px solid var(--g1)' }}>
              <span style={{ fontSize:12, color:'var(--tmu)' }}>寃곗젣 湲덉븸</span>
              <span style={{ fontSize:20, fontWeight:800, color:'var(--td)' }}>{price.toLocaleString()}��</span>
            </div>
          </div>
        )}

        {/* �덉빟 踰꾪듉 */}
        {startHour && (
          selSeat ? (
            <button onClick={handleBook}
              style={{ width:'100%', padding:'14px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:14, fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
              {selSeat} �먮━ �덉빟�섍린
            </button>
          ) : (
            <div style={{ padding:'14px', background:'var(--bg)', borderRadius:14, textAlign:'center', color:'var(--tmu)', fontSize:12, fontWeight:700 }}>
              �먮━瑜� �좏깮�� 二쇱꽭��
            </div>
          )
        )}

        <div style={{ textAlign:'center', fontSize:10, color:'var(--tmu)', marginTop:12, lineHeight:1.6 }}>
          5�쒓컙 �꾧퉴吏� 臾대즺 痍⑥냼
        </div>
      </div>

      <StudentNav active="schedule" />
    </>
  )
}