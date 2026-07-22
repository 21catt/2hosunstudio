'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/AdminNav'
import { NavIcon } from '../../components/NavIcons'
import { registerPush } from '../../lib/pushNotify'
import { applyTheme, getSavedTheme, isValidTheme } from '../../lib/theme'
import { LogoMark, HeroDeco } from '../../components/Deco'
import HeroWeatherFX from '../../components/HeroWeatherFX'
import { useTodayWeather, WeatherGlyph } from '../../components/WeatherBar'
import LoadingCat from '../../components/LoadingCat'
import GlassAdminHome from '../../components/GlassAdminHome'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

// 관리자 홈 — 학생 홈과 같은 디자인 언어(p-header·p-hero·p-tile·p-card + --ac 강조색).
// 8색 테마·여름 글래스 스킨(fresh)을 그대로 따라간다.
export default function AdminHomePage() {
  const router = useRouter()
  const weather = useTodayWeather()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTheme, setActiveTheme] = useState('ultra')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [todayBookings, setTodayBookings] = useState([])
  const [pendingCnt, setPendingCnt] = useState(0)   // 입금 대기
  const [refundCnt, setRefundCnt] = useState(0)     // 환불 필요
  const [unread, setUnread] = useState(0)
  const [memberCnt, setMemberCnt] = useState(0)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  useEffect(() => {
    // 저장된 테마 즉시 적용(로그인 전에도 반영) — 이후 계정 pref로 동기화
    setActiveTheme(applyTheme(getSavedTheme()))
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted')
  }, [])

  async function loadData(adminId) {
    const [{ data: tb }, { count: pc }, { count: rc }, { count: uc }, { count: mc }, { data: pref }] = await Promise.all([
      supabase.from('bookings').select('id, class_name, class_time, attended, status, users(name)').eq('class_date', todayStr).neq('status', 'cancelled'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'booked').eq('confirmed', false),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled').eq('refund_status', 'required'),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', adminId).eq('is_read', false),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('user_prefs').select('theme').eq('user_id', adminId).single(),
    ])
    setTodayBookings(tb || [])
    setPendingCnt(pc || 0)
    setRefundCnt(rc || 0)
    setUnread(uc || 0)
    setMemberCnt(mc || 0)
    // 계정에 저장된 테마가 있으면 기기 저장값보다 우선 (기기 간 동기화)
    if (isValidTheme(pref?.theme)) setActiveTheme(applyTheme(pref.theme))
    setLoading(false)
  }

  async function handleEnablePush() {
    const { data } = await supabase.auth.getUser()
    const ok = await registerPush(data.user.id)
    if (ok) { setPushEnabled(true); alert('예약 알림이 설정됐어요! 🐾') }
    else alert('알림 허용을 눌러주세요.')
  }

  // 오늘 수업: 시간대별로 묶고, 그 안에서 수업명별 학생 목록
  const timeMap = new Map()
  for (const b of todayBookings) {
    const t = b.class_time || ''
    if (!timeMap.has(t)) timeMap.set(t, { class_time: t, items: [], classes: new Map() })
    const g = timeMap.get(t)
    g.items.push(b)
    const cn = b.class_name || '기타'
    if (!g.classes.has(cn)) g.classes.set(cn, [])
    g.classes.get(cn).push(b)
  }
  const todayGroups = [...timeMap.values()].sort((a, b) => (a.class_time || '').localeCompare(b.class_time || ''))
  const attendedCnt = todayBookings.filter(b => b.attended).length
  const paymentBadge = pendingCnt + refundCnt

  const MENUS = [
    { label: '회원', icon: 'users', href: '/admin/members' },
    { label: '수업현황', icon: 'calendar', href: '/admin/schedule' },
    { label: '출석', icon: 'check', href: '/admin/attendance' },
    { label: '기록', icon: 'clipboard', href: '/admin/records' },
    { label: '입금', icon: 'card', href: '/admin/payment', badge: paymentBadge },
    { label: '알림', icon: 'bell', href: '/admin/notification', badge: unread },
    { label: '자리사진', icon: 'photo', href: '/admin/seats' },
    { label: '커리큘럼', icon: 'book', href: '/admin/curriculum' },
    { label: '라운지', icon: 'chat', href: '/lounge' },
  ]

  if (loading) return <LoadingCat />

  const isFresh = activeTheme === 'fresh'

  // fresh(싱그러운) = 학생 홈처럼 전용 글래스 스킨 컴포넌트로 렌더(깊은 그림자·글래스 카드·글래스 네비)
  if (isFresh) {
    const glassGroups = todayGroups.map(g => ({
      time: g.class_time,
      start: (g.class_time || '').split('~')[0] || '-',
      done: g.items.filter(b => b.attended).length,
      total: g.items.length,
      classes: [...g.classes.entries()].map(([cn, list]) => ({ cn, names: list.map(b => b.users?.name || '학생').join(', ') })),
    }))
    return (
      <GlassAdminHome
        now={now} weather={weather} todayCount={todayBookings.length} attendedCnt={attendedCnt} memberCnt={memberCnt}
        todayGroups={glassGroups} menus={MENUS} paymentBadge={paymentBadge} pendingCnt={pendingCnt} refundCnt={refundCnt} unread={unread}
        pushEnabled={pushEnabled}
        onEnablePush={handleEnablePush}
        onKakao={() => window.location.href = '/api/kakao/login'}
        onSettings={() => router.push('/admin/settings')}
        onLogout={() => supabase.auth.signOut().then(() => router.push('/login'))}
        go={(href) => router.push(href)}
      />
    )
  }

  // 헤더 아이콘 칩 공통 스타일 (기본 테마)
  const chip = (fill) => ({
    width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, background: fill ? 'var(--ac)' : 'var(--surf)',
    border: `1.5px solid ${fill ? 'var(--ac)' : 'rgb(var(--ac-rgb) / 0.28)'}`,
    color: fill ? '#fff' : 'var(--ac)',
  })

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#fff' }}>
      {/* 헤더 */}
      <div className="p-header" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark />
          <span className="p-title">관리자 홈</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="tap" onClick={handleEnablePush} title={pushEnabled ? '예약 알림 켜짐' : '예약 알림 설정'} style={chip(pushEnabled)}>
            <NavIcon name="bell" color={pushEnabled ? '#fff' : 'var(--ac)'} size={17} />
          </div>
          <div className="tap" onClick={() => window.location.href = '/api/kakao/login'} title="카카오톡 연동" style={chip(false)}>
            <NavIcon name="chat" color="var(--ac)" size={17} />
          </div>
          <div className="tap" onClick={() => router.push('/admin/settings')} title="개인 설정" style={chip(false)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div className="tap" onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} title="로그아웃" style={chip(false)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '8px 14px 90px' }}>

        {/* 오늘 요약 — 히어로 카드 */}
        <div className="p-hero" style={{ marginBottom: 14, position: 'relative' }}>
          <HeroDeco />
          <HeroWeatherFX code={weather?.code} />
          <div style={{ padding: '14px 16px 16px', position: 'relative', zIndex: 1 }}>
            {weather && (
              <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--acTx)' }}>
                <WeatherGlyph code={weather.code} size={20} />
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>{weather.temp}°</span>
              </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--td)', letterSpacing: '-0.3px' }}>
              {now.getMonth() + 1}월 {now.getDate()}일 ({DOW[now.getDay()]}) · 오늘
            </div>
            <div style={{ fontSize: 12, color: 'var(--tm)', fontWeight: 600, margin: '4px 0 12px' }}>
              예약 {todayBookings.length}명 · 출석 {attendedCnt}명 · 회원 {memberCnt}명 🐾
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="p-chip p-chip--fill" onClick={() => router.push('/admin/attendance')}>출석 체크하기</button>
              <button className="p-chip" onClick={() => router.push('/admin/schedule')}>수업 현황</button>
            </div>
          </div>
        </div>

        {/* 메뉴 타일 — 회원·수업현황·출석·입금·알림·자리사진·커리큘럼·라운지 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
          {MENUS.map(m => (
            <div key={m.label} className="p-tile" style={{ position: 'relative', padding: '12px 4px 10px' }} onClick={() => router.push(m.href)}>
              <NavIcon name={m.icon} color="var(--ac)" size={20} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: 'var(--td)' }}>{m.label}</div>
              {m.badge > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 8, background: '#e24b4a', color: '#fff', fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1, fontFamily: 'Nunito,sans-serif' }}>
                  {m.badge > 99 ? '99+' : m.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 입금·환불 처리 대기 */}
        {paymentBadge > 0 && (
          <div onClick={() => router.push('/admin/payment')}
            style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fef3e2', border: '2px solid #e8a33d', borderRadius: 16, padding: '12px 14px', marginBottom: 14, cursor: 'pointer' }}>
            <NavIcon name="card" color="#8a5a12" size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8a5a12' }}>
                {pendingCnt > 0 && `입금 대기 ${pendingCnt}건`}
                {pendingCnt > 0 && refundCnt > 0 && ' · '}
                {refundCnt > 0 && `환불 필요 ${refundCnt}건`}
              </div>
              <div style={{ fontSize: 10.5, color: '#a0741f', fontWeight: 700, marginTop: 1 }}>눌러서 바로 처리하기</div>
            </div>
            <span style={{ fontSize: 17, color: '#8a5a12' }}>›</span>
          </div>
        )}

        {/* 오늘 수업 목록 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--td)', margin: '0 2px 9px' }}>오늘 수업</div>
        {todayGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '22px 0', color: 'var(--tmu)', fontSize: 12, border: '1.5px dashed var(--g2)', borderRadius: 16 }}>
            오늘은 예약된 수업이 없어요 🐾
          </div>
        ) : todayGroups.map(g => {
          const done = g.items.filter(b => b.attended).length
          const allDone = g.items.length > 0 && done === g.items.length
          return (
            <div key={g.class_time} className="p-card" onClick={() => router.push('/admin/attendance')}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 13px', marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--acTx)', background: 'var(--acBg)', borderRadius: 9, padding: '5px 9px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {(g.class_time || '').split('~')[0] || '-'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--tmu)', marginBottom: 3 }}>{g.class_time}</div>
                {[...g.classes.entries()].map(([cn, list]) => (
                  <div key={cn} style={{ marginBottom: 2, lineHeight: 1.45 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--td)' }}>{cn}</span>
                    <span style={{ fontSize: 11, color: 'var(--tm)' }}> · {list.map(b => b.users?.name || '학생').join(', ')}</span>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0, color: allDone ? '#2b7a3f' : 'var(--tmu)' }}>
                출석 {done}/{g.items.length}
              </span>
            </div>
          )
        })}
      </div>

      <AdminNav active="home" />
    </div>
  )
}
