'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'

// booking_request 알림 본문(고정 템플릿)에서 예약 정보 추출 — 확정 시 예약 생성용.
function parseRequest(body = '') {
  const name = (body.match(/^(.+?)님이/) || [])[1] || ''
  const course = (body.match(/님이\s+(.+?)\s+예약을 요청/) || [])[1] || ''
  const date = (body.match(/일시:\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || ''
  const time = ((body.match(/(\d{2}:\d{2}\s*~\s*\d{2}:\d{2})/) || [])[1] || '').replace(/\s/g, '')
  const phone = (body.match(/연락처:\s*([\d-]+)/) || [])[1] || ''
  return { name, course, date, time, phone }
}

export default function AdminNotificationPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    // 3주 지난 알림은 자동 삭제 (내 알림만)
    const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('notifications').delete().eq('user_id', userId).lt('created_at', cutoff)

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifications(data || [])
    setLoading(false)

    const unread = (data || []).filter(n => !n.is_read).map(n => n.id)
    if (unread.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).in('id', unread)
    }
  }

  async function confirmMeeting(notif) {
    if (!notif.related_id) { alert('예약 정보가 없어요'); return }
    setProcessing(notif.id)
    
    const { data: booking } = await supabase.from('bookings').select('*').eq('id', notif.related_id).single()
    if (!booking) { alert('예약을 찾을 수 없어요'); setProcessing(null); return }

    // 이미 다른 관리자가 확정했으면 알림만 정리하고 종료 (중복 처리 방지)
    if (booking.status === 'confirmed') {
      await supabase.from('notifications')
        .update({ type: 'meeting_confirmed_admin', title: '✓ 모임 참여권 확정 완료' })
        .eq('related_id', notif.related_id).eq('type', notif.type)
      alert('이미 다른 관리자가 확정했어요. 확정 완료로 정리했어요.')
      setProcessing(null); loadData(user.id); return
    }

    // 해당 학생의 pending 모임권 정보 가져오기
const { data: pendingMt } = await supabase.from('meeting_tickets')
  .select('*')
  .eq('user_id', booking.user_id)
  .eq('status', 'pending')
  .single()

// confirmed로 업데이트
await supabase.from('meeting_tickets')
  .update({ status: 'confirmed' })
  .eq('user_id', booking.user_id)
  .eq('status', 'pending')

    // 해당 학생의 pending bookings도 confirmed로
    await supabase.from('bookings')
      .update({ status: 'confirmed' })
      .eq('user_id', booking.user_id)
      .eq('status', 'pending')

    // 학생한테 알림
await supabase.from('notifications').insert({
  user_id: booking.user_id,
  type: 'meeting_confirmed',
  title: '모임 참여권 확정',
  body: `입금이 확인되어 모임 참여권 ${pendingMt?.total || ''}회가 부여되었습니다 🐾`
})

    // 전체 관리자 알림을 확정 완료로 (내 것만이 아니라 같은 예약의 모든 관리자 복사본)
await supabase.from('notifications')
  .update({ type: 'meeting_confirmed_admin', title: '✓ 모임 참여권 확정 완료' })
  .eq('related_id', notif.related_id).eq('type', notif.type)

    setProcessing(null)
    loadData(user.id)
  }

  async function cancelMeeting(notif) {
    if (!confirm('취소하면 학생의 신청과 모임권이 삭제됩니다. 계속할까요?')) return
    if (!notif.related_id) { alert('예약 정보가 없어요'); return }
    setProcessing(notif.id)

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', notif.related_id).single()
    if (!booking) { alert('예약을 찾을 수 없어요'); setProcessing(null); return }

    // pending 모임권 삭제
    await supabase.from('meeting_tickets')
      .delete()
      .eq('user_id', booking.user_id)
      .eq('status', 'pending')

    // pending bookings 삭제
    await supabase.from('bookings')
      .delete()
      .eq('user_id', booking.user_id)
      .eq('status', 'pending')

    // 학생한테 알림
    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      type: 'meeting_cancelled',
      title: '모임 신청 취소',
      body: '모임 신청이 취소되었습니다. 강사에게 문의해 주세요.'
    })

    await supabase.from('notifications')
  .update({ type: 'meeting_cancelled_admin', title: '✗ 모임 신청 취소됨' })
  .eq('related_id', notif.related_id).eq('type', notif.type)

    setProcessing(null)
    loadData(user.id)
  }

  // 수강권 없는 예약 요청 → 계약금 입금 확인 후 예약 확정(예약 행 생성).
  // 본문 파싱으로 오늘 기존 요청 알림도 그대로 처리된다.
  async function approveBookingRequest(notif) {
    setProcessing(notif.id)
    try {
      const { name, course, date, time, phone } = parseRequest(notif.body)
      if (!course || !date || !time) { alert('요청 정보를 읽을 수 없어요. 수동으로 처리해 주세요.'); return }
      const digits = (phone || '').replace(/\D/g, '')

      // 요청 학생 찾기 (연락처 우선, 이름 보조)
      const { data: users } = await supabase.from('users').select('id, name, phone')
      const reqUser = (users || []).find(u => digits && (u.phone || '').replace(/\D/g, '') === digits)
        || (users || []).find(u => u.name === name)
      if (!reqUser) { alert('요청한 학생을 찾을 수 없어요. 수동으로 처리해 주세요.'); return }

      // 수업 찾기
      const { data: courses } = await supabase.from('class_courses').select('id, name, teacher').eq('name', course)
      const c = courses?.[0]
      if (!c) { alert(`"${course}" 수업을 찾을 수 없어요. 수동으로 처리해 주세요.`); return }

      // 스케줄 찾기 (시작시간 + 요일/날짜)
      const start = time.split('~')[0]
      const dow = new Date(date + 'T00:00:00').getDay()
      const { data: schedules } = await supabase.from('class_schedules').select('*').eq('course_id', c.id)
      const sch = (schedules || []).find(s => s.start_time === start && (s.day_of_week === dow || s.specific_date === date))
        || (schedules || []).find(s => s.start_time === start)

      // 이미 다른 관리자가 확정했는지 확인 (중복 예약 방지)
      const { data: exist } = await supabase.from('bookings').select('id')
        .eq('user_id', reqUser.id).eq('course_id', c.id).eq('class_date', date).eq('class_time', time).limit(1)
      if (exist && exist.length) {
        await supabase.from('notifications').update({ type: 'booking_confirmed_admin', title: '✓ 예약 확정 완료' })
          .eq('type', 'booking_request').eq('body', notif.body)
        alert('이미 다른 관리자가 확정한 요청이에요. 확정 완료로 정리했어요.')
        loadData(user.id); return
      }

      // 예약 생성 (수강권 없이 계약금 확정 예약)
      const { error } = await supabase.from('bookings').insert({
        user_id: reqUser.id, course_id: c.id, schedule_id: sch?.id || null,
        class_name: c.name, class_date: date, class_time: time, teacher: c.teacher || '',
        status: 'booked', confirmed: true
      })
      if (error) { alert('예약 생성에 실패했어요: ' + error.message); return }

      // 학생 알림 + 같은 요청의 모든 관리자 알림을 확정 완료로 (booking_request는 related_id 없어 본문으로 매칭)
      await supabase.from('notifications').insert({
        user_id: reqUser.id, type: 'booking_confirmed', title: '예약 확정 🎉',
        body: `계약금 입금이 확인되어 ${c.name} ${date} ${start} 예약이 확정됐어요! 🐾`
      })
      await supabase.from('notifications').update({ type: 'booking_confirmed_admin', title: '✓ 예약 확정 완료' })
        .eq('type', 'booking_request').eq('body', notif.body)
      loadData(user.id)
    } finally {
      setProcessing(null)
    }
  }

  // 요청 무시 (예약 생성 안 함)
  async function dismissRequest(notif) {
    if (!confirm('이 예약 요청을 무시할까요? (예약이 생성되지 않아요)')) return
    setProcessing(notif.id)
    await supabase.from('notifications').update({ type: 'booking_request_dismissed', title: '요청 무시됨' })
      .eq('type', 'booking_request').eq('body', notif.body)
    setProcessing(null)
    loadData(user.id)
  }

  function timeAgo(iso) {
    const diff = (new Date() - new Date(iso)) / 1000
    if (diff < 60) return '방금'
    if (diff < 3600) return `${Math.floor(diff/60)}분 전`
    if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`
    if (diff < 604800) return `${Math.floor(diff/86400)}일 전`
    return new Date(iso).toISOString().split('T')[0]
  }

  function iconFor(type) {
  if (type === 'booking_created') return { emoji:'✅', bg:'var(--g1)', color:'var(--g5)' }
  if (type === 'booking_request') return { emoji:'📩', bg:'#FFF3E0', color:'#E65100' }
  if (type === 'booking_cancelled') return { emoji:'✖', bg:'#ffebee', color:'#c0392b' }
  if (type === 'meeting_pending') return { emoji:'💰', bg:'#FFF3E0', color:'#E65100' }
  if (type === 'meeting_confirmed_admin') return { emoji:'✓', bg:'var(--g1)', color:'var(--g5)' }
  if (type === 'meeting_cancelled_admin') return { emoji:'✗', bg:'#ffebee', color:'#c0392b' }
  if (type === 'booking_confirmed_admin') return { emoji:'✅', bg:'var(--g1)', color:'var(--g5)' }
  if (type === 'booking_request_dismissed') return { emoji:'✖', bg:'var(--bg)', color:'var(--tmu)' }
  return { emoji:'🔔', bg:'var(--bg)', color:'var(--tm)' }
}

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  const todayCnt = notifications.filter(n => {
    const d = new Date(n.created_at)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).length

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="bell" color="#fff" size={20} />
          <span className="header-title">알림</span>
        </div>
        <button onClick={async () => {
          await supabase.auth.signOut()
          router.push('/login')
        }}
          style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
          로그아웃
        </button>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--g4)', marginBottom:14 }}>
          오늘 {todayCnt}건 · 전체 {notifications.length}건
        </div>

        {notifications.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>
            아직 알림이 없어요 🐾
          </div>
        ) : notifications.map(n => {
          const ic = iconFor(n.type)
          const isMeetingPending = n.type === 'meeting_pending'
          const isBookingRequest = n.type === 'booking_request'
          const isActionable = isMeetingPending || isBookingRequest
          const isProc = processing === n.id
          return (
            <div key={n.id} style={{ background: isActionable ? '#FFF8E1' : 'var(--bg)', borderRadius:14, padding:'12px 14px',
              marginBottom:8, border:`1.5px solid ${isActionable ? '#FFE082' : 'var(--g1)'}` }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div style={{ width:32, height:32, borderRadius:10, background:ic.bg,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, color:ic.color, flexShrink:0 }}>
                  {ic.emoji}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{n.title}</span>
                    <span style={{ fontSize:9, color:'var(--tmu)', fontWeight:600, flexShrink:0, marginLeft:8 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--tm)', lineHeight:1.5, wordBreak:'keep-all', whiteSpace:'pre-line' }}>
                    {n.body}
                  </div>
                </div>
              </div>
              
              {isMeetingPending && (
                <div style={{ display:'flex', gap:6, marginTop:10, paddingTop:10, borderTop:'1px solid #FFE082' }}>
                  <button onClick={()=>cancelMeeting(n)} disabled={isProc}
                    style={{ flex:1, padding:'8px', background:'#ffebee', color:'#c0392b',
                      border:'none', borderRadius:10, fontSize:11, fontWeight:700,
                      cursor:isProc?'not-allowed':'pointer', opacity:isProc?0.5:1,
                      fontFamily:'Nunito,sans-serif' }}>
                    취소
                  </button>
                  <button onClick={()=>confirmMeeting(n)} disabled={isProc}
                    style={{ flex:2, padding:'8px', background:'var(--g4)', color:'#fff',
                      border:'none', borderRadius:10, fontSize:11, fontWeight:700,
                      cursor:isProc?'not-allowed':'pointer', opacity:isProc?0.5:1,
                      fontFamily:'Nunito,sans-serif' }}>
                    {isProc ? '처리중...' : '입금 확인 → 확정'}
                  </button>
                </div>
              )}

              {isBookingRequest && (
                <div style={{ display:'flex', gap:6, marginTop:10, paddingTop:10, borderTop:'1px solid #FFE082' }}>
                  <button onClick={()=>dismissRequest(n)} disabled={isProc}
                    style={{ flex:1, padding:'8px', background:'#ffebee', color:'#c0392b', border:'none', borderRadius:10, fontSize:11, fontWeight:700, cursor:isProc?'not-allowed':'pointer', opacity:isProc?0.5:1, fontFamily:'Nunito,sans-serif' }}>
                    무시
                  </button>
                  <button onClick={()=>approveBookingRequest(n)} disabled={isProc}
                    style={{ flex:2, padding:'8px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:10, fontSize:11, fontWeight:700, cursor:isProc?'not-allowed':'pointer', opacity:isProc?0.5:1, fontFamily:'Nunito,sans-serif' }}>
                    {isProc ? '처리중...' : '입금 확인 → 예약 확정'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <AdminNav active="notification" />
    </>
  )
}