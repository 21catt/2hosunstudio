'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import StudentNav from '../../components/StudentNav'
import { NavIcon } from '../../components/NavIcons'
import { LogoMark, HeroDeco, DotPatch } from '../../components/Deco'
import { applyTheme, isValidTheme } from '../../lib/theme'
import { bookClass, requestBookingApproval, hasValidTicket, cancelBooking } from '../../lib/booking'
import LoadingCat from '../../components/LoadingCat'

const CELL_W = 56
const CELL_GAP = 8
const STRIP_DAYS = 28 // 이번 주 월요일부터 4주

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StudentHomePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [nextBooking, setNextBooking] = useState(null)
  const [pendingBooking, setPendingBooking] = useState(null)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [selDate, setSelDate] = useState(null)
  const [bookingBusy, setBookingBusy] = useState(null)
  const [cancelModal, setCancelModal] = useState(null) // { booking, label } — 취소 확인 다이얼로그
  const [cancelBusy, setCancelBusy] = useState(false)
  const stripRef = useRef(null)
  const dragMoved = useRef(false)

  const now = new Date()
  const todayStr = fmtDate(now)

  // 날짜 스트립: 이번 주 월요일부터 4주
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const stripDates = Array.from({ length: STRIP_DAYS }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null)
      loadData(data.user?.id || null)
    })
  }, [])

  // 오늘 셀이 보이도록 스트립 초기 스크롤
  useEffect(() => {
    if (loading) return
    const el = stripRef.current
    if (!el) return
    const idx = stripDates.findIndex(d => fmtDate(d) === todayStr)
    if (idx > 1) el.scrollLeft = (idx - 1) * (CELL_W + CELL_GAP)
  }, [loading])

  // 마우스 드래그 → 관성 스크롤 (터치는 네이티브 모멘텀 사용)
  useEffect(() => {
    if (loading) return
    const el = stripRef.current
    if (!el) return
    let down = false, startX = 0, startScroll = 0, lastX = 0, lastT = 0, vel = 0, raf = null
    const onDown = e => {
      if (e.pointerType !== 'mouse') return
      down = true; dragMoved.current = false
      startX = lastX = e.clientX; lastT = performance.now()
      startScroll = el.scrollLeft; vel = 0
      if (raf) cancelAnimationFrame(raf)
    }
    const onMove = e => {
      if (!down) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 5) dragMoved.current = true
      el.scrollLeft = startScroll - dx
      const t = performance.now(), dt = Math.max(1, t - lastT)
      vel = (e.clientX - lastX) / dt
      lastX = e.clientX; lastT = t
    }
    const onUp = () => {
      if (!down) return
      down = false
      let v = vel * 16
      const glide = () => {
        if (Math.abs(v) < 0.4) return
        el.scrollLeft -= v
        v *= 0.94
        raf = requestAnimationFrame(glide)
      }
      glide()
      setTimeout(() => { dragMoved.current = false }, 50)
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [loading])

  async function loadData(userId) {
    if (userId) {
      const { data: t } = await supabase.from('tickets').select('*').eq('user_id', userId).single()
      setTicket(t)
      const { data: b } = await supabase.from('bookings').select('*').eq('user_id', userId).neq('status', 'cancelled')
      setMyBookings(b || [])
      const upcoming = (b || [])
        .filter(x => x.class_date >= todayStr)
        .sort((x, y) => (x.class_date + (x.class_time || '')).localeCompare(y.class_date + (y.class_time || '')))
      setNextBooking(upcoming.find(x => x.confirmed !== false) || null)
      setPendingBooking(upcoming.find(x => x.confirmed === false) || null)
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)
      setUnread(count || 0)
      const { data: pref } = await supabase.from('user_prefs').select('*').eq('user_id', userId).single()
      if (isValidTheme(pref?.theme)) applyTheme(pref.theme)
    }
    // 공개 데이터: 수업(운영 요일·기간) + 정원 계산용 전체 예약
    const { data: c } = await supabase.from('class_courses').select('*, class_schedules(*), class_exceptions(*)').eq('is_active', true)
    setClasses(c || [])
    const { data: ab } = await supabase.from('bookings').select('course_id, schedule_id, class_date').eq('status', 'booked')
    setAllBookings(ab || [])
    setLoading(false)
  }

  // 날짜 탭 → 그날 수업 패널 토글 (드래그로 지나간 경우는 무시)
  function goDate(d) {
    if (dragMoved.current) return
    const ds = fmtDate(d)
    setSelDate(prev => prev === ds ? null : ds)
  }

  const bookedDates = new Set(myBookings.map(b => b.class_date))

  // 캘린더 페이지의 courseOpenOnDay와 동일 규칙 (예외 요일·운영 기간 반영)
  function coursesOn(ds) {
    const dow = new Date(ds + 'T00:00:00').getDay()
    return classes.filter(c => {
      if (!c.class_schedules?.some(s => s.day_of_week === dow)) return false
      if (c.class_exceptions?.some(e => e.day_of_week === dow)) return false
      if (!c.is_unlimited) {
        if (c.start_date && ds < c.start_date) return false
        if (c.end_date && ds > c.end_date) return false
      }
      return true
    })
  }

  function schedulesFor(c, ds) {
    const dow = new Date(ds + 'T00:00:00').getDay()
    const seen = new Set()
    return (c.class_schedules || []).filter(s => s.day_of_week === dow).filter(s => {
      const key = `${s.start_time}-${s.end_time}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  function seatCount(c, s, ds) {
    return allBookings.filter(b => b.course_id === c.id && b.schedule_id === s.id && b.class_date === ds).length
  }

  function myBookingFor(c, s, ds) {
    return myBookings.find(b => b.course_id === c.id && b.schedule_id === s.id && b.class_date === ds)
  }

  async function quickBook(c, s, ds) {
    if (!user) { router.push('/signup'); return }
    if (c.category === 'meeting') { router.push(`/student/calendar?date=${ds}`); return }
    const key = `${c.id}-${s.id}-${ds}`
    setBookingBusy(key)
    try {
      if (hasValidTicket(ticket, todayStr)) {
        await bookClass({ user, ticket, course: c, schedule: s, dateStr: ds })
      } else {
        await requestBookingApproval({ user, course: c, schedule: s, dateStr: ds })
        alert('예약 요청이 접수됐어요! 강사님이 확인 후 연락드릴게요 🐾')
      }
      await loadData(user.id)
    } finally {
      setBookingBusy(null)
    }
  }

  // 예약된 슬롯 클릭 → 취소 가능 여부 확인 후 확인 다이얼로그 오픈 (캘린더 handleCancel과 동일 규칙)
  function askCancel(mine, label) {
    if (mine.attended === true) { alert('출석 완료된 수업은 취소할 수 없어요.'); return }
    const gs = (mine.class_time || '00:00').split('~')[0]
    if (new Date() >= new Date(`${mine.class_date}T${gs}:00`)) { alert('지난 수업은 취소할 수 없어요.'); return }
    const diff = (new Date(mine.class_date) - new Date()) / (1000 * 60 * 60)
    if (diff < 4) { alert('수업 4시간 전에는 취소할 수 없어요.'); return }
    setCancelModal({ booking: mine, label })
  }

  // 다이얼로그 '확인' → 실제 취소 실행
  async function confirmCancel() {
    if (!cancelModal || !user) return
    setCancelBusy(true)
    try {
      await cancelBooking({ user, ticket, booking: cancelModal.booking })
      await loadData(user.id)
      setCancelModal(null)
    } finally {
      setCancelBusy(false)
    }
  }

  if (loading) return <LoadingCat />

  const heroSub = user
    ? (nextBooking
        ? `${nextBooking.class_name} · ${ticket ? `수강권 ${ticket.remain}회 남음` : nextBooking.class_date.slice(5).replace('-', '/')}`
        : (ticket ? `수강권 ${ticket.remain}회 남음 · 날짜 고르고 바로 예약` : '커리큘럼 보고 · 날짜 고르고 · 바로 시작 🐾'))
    : '커리큘럼 보고 · 날짜 고르고 · 바로 시작 🐾'

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <LogoMark />
          <span className="p-title">2호선 스튜디오</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {!user && (
            <button onClick={()=>router.push('/login')} className="p-chip p-chip--sm">로그인 / 가입</button>
          )}
          <div onClick={()=>router.push('/student/notification')} style={{ position:'relative', cursor:'pointer', display:'flex' }} title="알림">
            <NavIcon name="bell" color="var(--ac)" size={22} />
            {unread > 0 && (
              <span style={{ position:'absolute', top:-5, right:-7, background:'#e24b4a', color:'#fff', fontSize:9, fontWeight:800, minWidth:15, height:15, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', lineHeight:1, fontFamily:'Nunito,sans-serif', border:'1.5px solid #fff' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ background:'#fff', padding:'8px 16px 90px' }}>

        <div className="p-hero" style={{ marginBottom:14 }}>
          <HeroDeco />
          <div style={{ padding:'14px 16px 16px' }}>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--td)', letterSpacing:'-0.4px' }}>
              {user && nextBooking ? '이번 주 수업 예약' : '수업 예약, 여기서 시작'}
            </div>
            <div style={{ fontSize:12, color:'var(--tm)', margin:'4px 0 12px' }}>{heroSub}</div>
            <div style={{ display:'flex', gap:8 }}>
              {user ? (
                <>
                  <button className="p-chip" onClick={()=>router.push('/student/curriculum')}>자세히 알아보기</button>
                  <button className="p-chip p-chip--fill" onClick={()=>router.push('/student/calendar')}>예약하기</button>
                </>
              ) : (
                <>
                  <button className="p-chip" onClick={()=>router.push('/student/curriculum')}>커리큘럼 보기</button>
                  <button className="p-chip p-chip--fill" onClick={()=>router.push('/signup')}>가입하고 예약</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div ref={stripRef} className="no-scrollbar" style={{ display:'flex', gap:CELL_GAP, overflowX:'auto', marginBottom:14, paddingBottom:2, cursor:'grab', touchAction:'pan-x' }}>
          {stripDates.map(d => {
            const ds = fmtDate(d)
            const isToday = ds === todayStr
            const isSel = selDate === ds
            const isMon = d.getDay() === 1
            const hasBooking = bookedDates.has(ds)
            const label = d.getDate() === 1 ? `${d.getMonth() + 1}월` : ['일','월','화','수','목','금','토'][d.getDay()]
            return (
              <div key={ds} onClick={() => goDate(d)}
                style={{ width:CELL_W, flexShrink:0, textAlign:'center', padding:'9px 0 8px', borderRadius:12, userSelect:'none', cursor:'pointer', position:'relative', opacity:isMon?0.4:1,
                  background: isSel ? 'var(--ac2)' : isToday ? 'var(--acBg)' : 'var(--surf)',
                  border: (isSel || isToday) ? '2px solid var(--ac)' : '1.5px solid var(--g2)',
                  transition: 'background 0.2s ease, border-color 0.2s ease' }}>
                {hasBooking && (
                  <span className="dot-pulse" style={{ position:'absolute', top:4, right:5, width:7, height:7, borderRadius:'50%', background:'var(--ac)', border:'1.5px solid #fff' }} />
                )}
                <div style={{ fontSize:10, fontWeight:700, color: (isSel || isToday) ? 'var(--td)' : 'var(--tmu)' }}>{label}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--td)', marginTop:1 }}>{d.getDate()}</div>
              </div>
            )
          })}
        </div>

        {selDate && (() => {
          const d = new Date(selDate + 'T00:00:00')
          const dowName = ['일','월','화','수','목','금','토'][d.getDay()]
          const list = coursesOn(selDate)
          const past = selDate < todayStr
          return (
            <div key={selDate} style={{ marginBottom:14 }}>
              <div className="pop-in" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 2px 8px' }}>
                <span style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{d.getMonth() + 1}월 {d.getDate()}일 ({dowName}) 수업</span>
                <span onClick={()=>router.push(`/student/calendar?date=${selDate}`)}
                  style={{ fontSize:11, color:'var(--tmu)', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>캘린더에서 보기 →</span>
              </div>
              {list.length === 0 ? (
                <div className="pop-in" style={{ textAlign:'center', padding:'16px 0', color:'var(--tmu)', fontSize:12, border:'1.5px dashed var(--g2)', borderRadius:12, animationDelay:'60ms' }}>
                  이날은 수업이 없어요 🐾
                </div>
              ) : list.map((c, i) => (
                <div key={c.id} className="p-card pop-in" style={{ padding:'11px 13px', marginBottom:8, animationDelay:`${(i + 1) * 70}ms` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: c.category === 'free' ? 0 : 8 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>{c.name}</div>
                      <div style={{ fontSize:10, color:'var(--tmu)', marginTop:1 }}>강사 {c.teacher}</div>
                    </div>
                    {c.category === 'free' && !past && (
                      <button className="p-chip p-chip--sm" onClick={()=>router.push(`/student/free?date=${selDate}`)}>자리 고르기</button>
                    )}
                  </div>
                  {c.category !== 'free' && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {schedulesFor(c, selDate).map(s => {
                        const label = `${s.start_time}~${s.end_time}`
                        const mine = myBookingFor(c, s, selDate)
                        const cnt = seatCount(c, s, selDate)
                        const full = cnt >= (c.max_count || 999)
                        const busy = bookingBusy === `${c.id}-${s.id}-${selDate}`
                        if (mine) return (
                          <button key={s.id} onClick={()=>askCancel(mine, label)} title="눌러서 예약 취소"
                            className="p-badge" style={{ padding:'6px 12px', fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>✓ {label} 예약됨</button>
                        )
                        if (past) return (
                          <span key={s.id} style={{ fontSize:11, color:'var(--tl)', border:'1.5px solid var(--g1)', borderRadius:20, padding:'6px 12px' }}>{label}</span>
                        )
                        if (full) return (
                          <span key={s.id} style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', background:'var(--card)', borderRadius:20, padding:'6px 12px' }}>{label} 마감</span>
                        )
                        return (
                          <button key={s.id} disabled={busy} onClick={()=>quickBook(c, s, selDate)}
                            style={{ fontSize:11, fontWeight:700, color:'#fff', background:'var(--ac)', border:'none', borderRadius:20, padding:'6px 12px', cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity:busy?0.5:1 }}>
                            {busy ? '예약 중…' : `${label} 예약`}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })()}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
          {[
            { label:'커리큘럼', icon:'book', href:'/student/curriculum' },
            { label:'기록', icon:'clipboard', href:'/student/records' },
            { label:'텃밭', icon:'plant', href:'/student/farm' },
            { label:'알림', icon:'bell', href:'/student/notification' },
          ].map(m => (
            <div key={m.label} className="p-tile" style={{ padding:'12px 4px 10px' }} onClick={()=>router.push(m.href)}>
              <NavIcon name={m.icon} color="var(--ac)" size={20} />
              <div style={{ fontSize:11, fontWeight:700, marginTop:4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {pendingBooking && (
          <div className="p-card" style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', marginBottom:12 }}
            onClick={()=>router.push(`/student/calendar?date=${pendingBooking.class_date}`)}>
            <DotPatch size={40} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>입금 안내</div>
              <div style={{ fontSize:11, color:'var(--tm)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {pendingBooking.class_name} · {pendingBooking.class_date.slice(5).replace('-','/')} {pendingBooking.class_time?.split('~')[0] || ''}
                {pendingBooking.amount ? ` · ${Number(pendingBooking.amount).toLocaleString()}원` : ''}
              </div>
            </div>
            <span className="p-badge" style={{ flexShrink:0 }}>입금 대기</span>
          </div>
        )}

        {user && ticket && (
          <div className="p-card" style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700 }}>내 수강권</div>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', margin:'2px 0 6px' }}>{ticket.total}회권 · 잔여 {ticket.remain}회</div>
              <div style={{ width:'100%', height:5, background:'var(--g1)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width:`${(ticket.remain / ticket.total) * 100}%`, height:'100%', background:'var(--ac)', transition:'width 0.3s ease' }}/>
              </div>
            </div>
            <span style={{ fontSize:10, color:'var(--tmu)', flexShrink:0 }}>만료 {ticket.expires_at}</span>
          </div>
        )}
      </div>

      {cancelModal && (
        <div onClick={()=>{ if (!cancelBusy) setCancelModal(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:24 }}>
          <div onClick={e=>e.stopPropagation()} className="pop-in"
            style={{ background:'#fff', borderRadius:18, padding:'22px 20px 18px', width:'100%', maxWidth:320, boxShadow:'0 12px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--td)', marginBottom:8 }}>예약을 취소할까요?</div>
            <div style={{ fontSize:12, color:'var(--tm)', lineHeight:1.6, marginBottom:18 }}>
              {cancelModal.booking.class_name}<br/>
              {cancelModal.booking.class_date.slice(5).replace('-','/')} · {cancelModal.label}<br/>
              취소하면 수강권이 다시 복구돼요 🐾
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button disabled={cancelBusy} onClick={()=>setCancelModal(null)}
                style={{ flex:1, padding:'11px', background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>돌아가기</button>
              <button disabled={cancelBusy} onClick={confirmCancel}
                style={{ flex:1, padding:'11px', background:'var(--ac)', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity:cancelBusy?0.6:1 }}>{cancelBusy?'취소 중…':'확인'}</button>
            </div>
          </div>
        </div>
      )}

      <StudentNav active="home" />
    </>
  )
}
