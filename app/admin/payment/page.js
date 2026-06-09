'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'

const ACCENT = '#3B6D11'
const ACCENT_BG = '#EAF3DE'
const ACCENT_TEXT = '#27500A'
const CARD = '#F1EFE8'
const BORDER = 'rgba(0,0,0,0.14)'
const DOW = ['일','월','화','수','목','금','토']

export default function AdminPaymentPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState({})
  const [cancelling, setCancelling] = useState({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      loadAll()
    })
  }, [])

  async function loadAll() {
    const [{ data: bks }, { data: usrs }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('status', 'booked')
        .eq('confirmed', false)
        .order('created_at', { ascending: false }),
      supabase.from('users').select('id, name')
    ])
    setBookings(bks || [])
    const map = {}
    ;(usrs || []).forEach(u => { map[u.id] = u.name })
    setUserMap(map)
    setLoading(false)
  }

  async function handleConfirm(id) {
    setConfirming(prev => ({ ...prev, [id]: true }))
    await supabase.from('bookings').update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    }).eq('id', id)
    setConfirming(prev => { const n = { ...prev }; delete n[id]; return n })
    loadAll()
  }

  async function handleCancel(id) {
    if (!confirm('예약을 취소할까요? 좌석이 풀립니다.')) return
    setCancelling(prev => ({ ...prev, [id]: true }))
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    setCancelling(prev => { const n = { ...prev }; delete n[id]; return n })
    loadAll()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>💳</div>
    </div>
  )

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>💳</span>
          <span className="header-title">입금 확인</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0', minHeight:'80vh' }}>

        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:14 }}>
          입금 대기 {bookings.length}건 — 입금 확인 후 버튼을 눌러주세요
        </div>

        {bookings.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13 }}>입금 대기 건이 없어요 🐾</div>
        ) : bookings.map(b => {
          const d = new Date(b.class_date + 'T00:00:00')
          const dateLabel = `${b.class_date.slice(5).replace('-','/')} (${DOW[d.getDay()]})`
          const created = new Date(b.created_at)
          const createdLabel = `${created.getMonth()+1}/${created.getDate()} ${String(created.getHours()).padStart(2,'0')}:${String(created.getMinutes()).padStart(2,'0')}`
          const expireAt = new Date(created.getTime() + 24 * 60 * 60 * 1000)
          const msLeft = expireAt - new Date()
          const hoursLeft = Math.max(0, Math.floor(msLeft / (1000*60*60)))
          const minLeft = Math.max(0, Math.floor((msLeft % (1000*60*60)) / (1000*60)))
          const timeLeft = msLeft <= 0 ? '만료됨' : hoursLeft > 0 ? `${hoursLeft}시간 ${minLeft}분 남음` : `${minLeft}분 남음`
          const isExpired = msLeft <= 0
          return (
            <div key={b.id} style={{ borderRadius:14, marginBottom:8, padding:'12px 14px', border:`1.5px solid ${isExpired?'#f5c6cb':BORDER}`, background:isExpired?'#fff5f5':CARD }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--td)', marginBottom:2 }}>
                    {userMap[b.user_id] || '학생'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:2 }}>
                    {dateLabel} · {b.class_time}
                    {b.seat && <span style={{ marginLeft:4 }}>{b.seat}자리</span>}
                  </div>
                  <div style={{ fontSize:10, color:isExpired?'#c0392b':'var(--tmu)' }}>
                    신청 {createdLabel} · <span style={{ fontWeight:600 }}>{timeLeft}</span>
                  </div>
                </div>
                <div style={{ fontSize:16, fontWeight:800, color:ACCENT_TEXT, flexShrink:0, marginLeft:8 }}>
                  {(b.amount || 0).toLocaleString()}원
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button
                  onClick={() => handleCancel(b.id)}
                  disabled={!!cancelling[b.id]}
                  style={{ flex:1, padding:'9px', background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity:cancelling[b.id]?0.5:1 }}>
                  취소
                </button>
                <button
                  onClick={() => handleConfirm(b.id)}
                  disabled={!!confirming[b.id]}
                  style={{ flex:2, padding:'9px', background:ACCENT, color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity:confirming[b.id]?0.5:1 }}>
                  {confirming[b.id] ? '처리중...' : '✓ 입금 확인'}
                </button>
              </div>
            </div>
          )
        })}

        <div style={{ height:80 }}/>
      </div>

      <AdminNav active="payment"/>
    </>
  )
}
