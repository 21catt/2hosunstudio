'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/AdminNav'
import { NavIcon } from '../../components/NavIcons'
import { registerPush } from '../../lib/pushNotify'
import { HEADER_BG, PRIMARY, T, OK, WARN, BAD } from '../../lib/adminTheme'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

// 관리자 홈 — 수강생 홈처럼 오늘 현황 요약 + 전체 메뉴 바로가기 타일
export default function AdminHomePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [todayBookings, setTodayBookings] = useState([])
  const [pendingCnt, setPendingCnt] = useState(0)   // 입금 대기
  const [refundCnt, setRefundCnt] = useState(0)     // 환불 필요
  const [unread, setUnread] = useState(0)
  const [memberCnt, setMemberCnt] = useState(0)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted')
  }, [])

  async function loadData(adminId) {
    const [{ data: tb }, { count: pc }, { count: rc }, { count: uc }, { count: mc }] = await Promise.all([
      supabase.from('bookings').select('id, class_name, class_time, attended, status').eq('class_date', todayStr).neq('status', 'cancelled'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'booked').eq('confirmed', false),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled').eq('refund_status', 'required'),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', adminId).eq('is_read', false),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    ])
    setTodayBookings(tb || [])
    setPendingCnt(pc || 0)
    setRefundCnt(rc || 0)
    setUnread(uc || 0)
    setMemberCnt(mc || 0)
    setLoading(false)
  }

  async function handleEnablePush() {
    const { data } = await supabase.auth.getUser()
    const ok = await registerPush(data.user.id)
    if (ok) { setPushEnabled(true); alert('예약 알림이 설정됐어요! 🐾') }
    else alert('알림 허용을 눌러주세요.')
  }

  // 오늘 수업: 시간+수업명으로 그룹
  const groupMap = new Map()
  for (const b of todayBookings) {
    const key = `${b.class_time || ''}||${b.class_name || ''}`
    if (!groupMap.has(key)) groupMap.set(key, { class_name: b.class_name, class_time: b.class_time, items: [] })
    groupMap.get(key).items.push(b)
  }
  const todayGroups = [...groupMap.values()].sort((a, b) => (a.class_time || '').localeCompare(b.class_time || ''))
  const attendedCnt = todayBookings.filter(b => b.attended).length
  const paymentBadge = pendingCnt + refundCnt

  const MENUS = [
    { label: '회원', icon: 'users', href: '/admin/members' },
    { label: '수업현황', icon: 'calendar', href: '/admin/schedule' },
    { label: '출석', icon: 'check', href: '/admin/attendance' },
    { label: '입금', icon: 'card', href: '/admin/payment', badge: paymentBadge },
    { label: '알림', icon: 'bell', href: '/admin/notification', badge: unread },
    { label: '자리사진', icon: 'photo', href: '/admin/seats' },
    { label: '커리큘럼', icon: 'book', href: '/admin/curriculum' },
    { label: '라운지', icon: 'chat', href: '/lounge' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ fontSize: 32 }}>🐱</div>
    </div>
  )

  return (
    <>
      {/* Header */}
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavIcon name="home" color="#fff" size={20} />
          <span className="header-title">관리자 홈</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={handleEnablePush}
            style={{ background: pushEnabled ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '5px 10px', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {pushEnabled ? '🔔 알림ON' : '🔕 알림설정'}
          </button>
          <button onClick={() => window.location.href = '/api/kakao/login'}
            style={{ background: 'rgba(255,232,120,0.26)', border: 'none', borderRadius: 10, padding: '5px 10px', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            💬 카톡연동
          </button>
          <button onClick={() => router.push('/admin/settings')} title="개인 설정"
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '5px 9px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>
            ⚙️
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '5px 10px', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', marginTop: -8, padding: '16px 14px 90px', minHeight: '80vh' }}>

        {/* 오늘 요약 */}
        <div style={{ background: OK.soft, border: '1.5px solid rgb(var(--ac-rgb) / 0.3)', borderRadius: 16, padding: '14px 15px', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: '-0.3px' }}>
            {now.getMonth() + 1}월 {now.getDate()}일 ({DOW[now.getDay()]}) 오늘
          </div>
          <div style={{ fontSize: 11.5, color: T.mut, fontWeight: 600, margin: '4px 0 11px' }}>
            예약 {todayBookings.length}명 · 출석 {attendedCnt}명 · 회원 {memberCnt}명
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/admin/attendance')}
              style={{ padding: '8px 15px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 12, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>
              출석 체크하기
            </button>
            <button onClick={() => router.push('/admin/schedule')}
              style={{ padding: '8px 15px', background: '#fff', color: OK.tx, border: '1.5px solid rgb(var(--ac-rgb) / 0.4)', borderRadius: 12, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>
              수업 현황 보기
            </button>
          </div>
        </div>

        {/* 메뉴 타일 — 회원·수업현황·출석·입금·알림·자리사진·커리큘럼·라운지 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
          {MENUS.map(m => (
            <div key={m.label} onClick={() => router.push(m.href)}
              style={{ position: 'relative', border: '1.5px solid var(--ac)', borderRadius: 12, background: 'var(--surf)', textAlign: 'center', cursor: 'pointer', padding: '12px 4px 10px' }}>
              <NavIcon name={m.icon} color="var(--ac)" size={20} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: T.text }}>{m.label}</div>
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
            style={{ display: 'flex', alignItems: 'center', gap: 11, background: WARN.soft, border: `1.5px solid ${WARN.main}`, borderRadius: 14, padding: '12px 14px', marginBottom: 14, cursor: 'pointer' }}>
            <NavIcon name="card" color={WARN.tx} size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: WARN.tx }}>
                {pendingCnt > 0 && `입금 대기 ${pendingCnt}건`}
                {pendingCnt > 0 && refundCnt > 0 && ' · '}
                {refundCnt > 0 && `환불 필요 ${refundCnt}건`}
              </div>
              <div style={{ fontSize: 10.5, color: WARN.tx, opacity: 0.8, fontWeight: 600, marginTop: 1 }}>눌러서 바로 처리하기</div>
            </div>
            <span style={{ fontSize: 16, color: WARN.tx }}>›</span>
          </div>
        )}

        {/* 오늘 수업 목록 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: T.text, margin: '0 2px 9px' }}>오늘 수업</div>
        {todayGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '22px 0', color: T.mut, fontSize: 12, border: '1.5px dashed var(--g2)', borderRadius: 12 }}>
            오늘은 예약된 수업이 없어요 🐾
          </div>
        ) : todayGroups.map(g => {
          const done = g.items.filter(b => b.attended).length
          const allDone = done === g.items.length
          return (
            <div key={`${g.class_time}||${g.class_name}`} onClick={() => router.push('/admin/attendance')}
              style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '11px 13px', marginBottom: 7, cursor: 'pointer' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: OK.tx, background: OK.soft, borderRadius: 9, padding: '5px 9px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {(g.class_time || '').split('~')[0] || '-'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.class_name}</div>
                <div style={{ fontSize: 10, color: T.mut, marginTop: 1 }}>{g.class_time}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, flexShrink: 0, color: allDone ? OK.tx : T.mut }}>
                출석 {done}/{g.items.length}
              </span>
            </div>
          )
        })}
      </div>

      <AdminNav active="home" />
    </>
  )
}
