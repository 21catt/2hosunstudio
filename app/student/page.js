'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import StudentNav from '../../components/StudentNav'
import { NavIcon } from '../../components/NavIcons'
import { LogoMark, HeroDeco, DotPatch } from '../../components/Deco'
import { applyTheme, isValidTheme } from '../../lib/theme'
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
    setLoading(false)
  }

  function goDate(d) {
    if (dragMoved.current) return
    router.push(`/student/calendar?date=${fmtDate(d)}`)
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
            const isMon = d.getDay() === 1
            const label = d.getDate() === 1 ? `${d.getMonth() + 1}월` : ['일','월','화','수','목','금','토'][d.getDay()]
            return (
              <div key={ds} onClick={() => goDate(d)}
                style={{ width:CELL_W, flexShrink:0, textAlign:'center', padding:'9px 0 8px', borderRadius:12, userSelect:'none', cursor:'pointer', opacity:isMon?0.4:1,
                  background: isToday ? 'var(--ac2)' : 'var(--surf)',
                  border: isToday ? '2px solid var(--ac)' : '1.5px solid var(--g2)' }}>
                <div style={{ fontSize:10, fontWeight:700, color: isToday ? 'var(--td)' : 'var(--tmu)' }}>{label}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--td)', marginTop:1 }}>{d.getDate()}</div>
              </div>
            )
          })}
        </div>

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

      <StudentNav active="home" />
    </>
  )
}
