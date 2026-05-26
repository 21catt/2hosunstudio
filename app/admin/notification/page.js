'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminNotificationPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

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

    // 안 읽은 것 읽음 처리
    const unread = (data || []).filter(n => !n.is_read).map(n => n.id)
    if (unread.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).in('id', unread)
    }
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
          return (
            <div key={n.id} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 14px',
              marginBottom:8, border:'1.5px solid var(--g1)', display:'flex', gap:10, alignItems:'flex-start' }}>
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
          )
        })}
      </div>

      <nav className="bottom-nav">
        {[
          { href:'/admin', label:'회원', icon:'👥' },
          { href:'/admin/schedule', label:'수업현황', icon:'📅' },
          { href:'/admin/notification', label:'알림', icon:'🔔', active:true },
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