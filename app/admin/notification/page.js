'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '../../../components/AdminNav'

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

    // 해당 학생의 pending 모임권 confirmed로
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
      body: '입금이 확인되어 모임 참여권이 확정되었습니다 🐾'
    })

    // 강사 알림 삭제
    await supabase.from('notifications').delete().eq('id', notif.id)
    
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

    await supabase.from('notifications').delete().eq('id', notif.id)
    
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
    if (type === 'booking_cancelled') return { emoji:'✖', bg:'#ffebee', color:'#c0392b' }
    if (type === 'meeting_pending') return { emoji:'💰', bg:'#FFF3E0', color:'#E65100' }
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
          <span style={{ fontSize:20 }}>✏️</span>
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
          const isProc = processing === n.id
          return (
            <div key={n.id} style={{ background: isMeetingPending ? '#FFF8E1' : 'var(--bg)', borderRadius:14, padding:'12px 14px',
              marginBottom:8, border:`1.5px solid ${isMeetingPending ? '#FFE082' : 'var(--g1)'}` }}>
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
                  <div style={{ fontSize:11, color:'var(--tm)', lineHeight:1.5, wordBreak:'keep-all' }}>
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
            </div>
          )
        })}
      </div>

      <AdminNav active="notification" />
    </>
  )
}