'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { HEADER_BG, PRIMARY, T, OK, WARN, BAD } from '../../../lib/adminTheme'

const DOW = ['일','월','화','수','목','금','토']

function fmt(b) {
  const d = new Date(b.class_date + 'T00:00:00')
  return `${b.class_date.slice(5).replace('-','/')} (${DOW[d.getDay()]}) ${b.class_time}`
}
function fmtTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function SectionHead({ dot, tx, label, count }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, margin:'0 3px 9px' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: dot }}/>
      <span style={{ fontSize:11, fontWeight:800, color: tx, letterSpacing:'0.2px' }}>{label}</span>
      <span style={{ fontSize:10, fontWeight:700, color: T.faint }}>{count}</span>
      <span style={{ flex:1, height:1, background:'rgba(0,0,0,0.05)' }}/>
    </div>
  )
}

export default function AdminPaymentPage() {
  const router = useRouter()
  const [pending, setPending]   = useState([])   // 입금 대기
  const [refunds, setRefunds]   = useState([])   // 환불 필요
  const [history, setHistory]   = useState([])   // 환불 불필요 (히스토리)
  const [userMap, setUserMap]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [confirming, setConfirming] = useState({})
  const [cancelling, setCancelling] = useState({})
  const [refunding, setRefunding]   = useState({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      loadAll()
    })
  }, [])

  async function loadAll() {
    const [{ data: p }, { data: r }, { data: h }, { data: usrs }] = await Promise.all([
      supabase.from('bookings').select('*').eq('status', 'booked').eq('confirmed', false)
        .order('created_at', { ascending: true }),
      supabase.from('bookings').select('*').eq('status', 'cancelled').eq('refund_status', 'required')
        .order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').eq('status', 'cancelled').eq('refund_status', 'not_required')
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('users').select('id, name'),
    ])
    setPending(p || [])
    setRefunds(r || [])
    setHistory(h || [])
    const map = {}
    ;(usrs || []).forEach(u => { map[u.id] = u.name })
    setUserMap(map)
    setLoading(false)
  }

  async function handleConfirm(id) {
    setConfirming(prev => ({ ...prev, [id]: true }))
    await supabase.from('bookings').update({ confirmed: true, confirmed_at: new Date().toISOString() }).eq('id', id)
    setConfirming(prev => { const n = { ...prev }; delete n[id]; return n })
    loadAll()
  }

  async function handleCancelPending(id) {
    if (!confirm('예약을 취소할까요? 좌석이 풀립니다.')) return
    setCancelling(prev => ({ ...prev, [id]: true }))
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    setCancelling(prev => { const n = { ...prev }; delete n[id]; return n })
    loadAll()
  }

  async function handleRefundDone(id) {
    if (!confirm('환불 처리를 완료로 표시할까요?')) return
    setRefunding(prev => ({ ...prev, [id]: true }))
    await supabase.from('bookings').update({ refund_status: 'done' }).eq('id', id)
    setRefunding(prev => { const n = { ...prev }; delete n[id]; return n })
    loadAll()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>💳</div>
    </div>
  )

  return (
    <>
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>💳</span>
          <span className="header-title">입금·환불</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0', minHeight:'80vh' }}>

        {/* ── 입금 대기 ─────────────────────────────────────────── */}
        <SectionHead dot={OK.dot} tx={OK.tx} label="입금 대기" count={pending.length} />

        {pending.length === 0 ? (
          <div style={{ textAlign:'center', padding:'12px 0 20px', color: T.mut, fontSize:12 }}>입금 대기 없음</div>
        ) : pending.map(b => {
          const expireAt = new Date(new Date(b.created_at).getTime() + 24*60*60*1000)
          const msLeft = expireAt - new Date()
          const hl = Math.max(0, Math.floor(msLeft / (1000*60*60)))
          const ml = Math.max(0, Math.floor((msLeft % (1000*60*60)) / (1000*60)))
          const timeLeft = msLeft <= 0 ? '만료됨' : hl > 0 ? `${hl}시간 ${ml}분 남음` : `${ml}분 남음`
          const isExp = msLeft <= 0
          return (
            <div key={b.id} style={{ borderRadius:15, marginBottom:8, padding:'13px 14px', border:`0.5px solid ${isExp ? 'rgba(193,86,77,0.35)' : T.card}`, background: isExp ? BAD.soft : '#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:11 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color: T.text, marginBottom:3, letterSpacing:'-0.2px' }}>{userMap[b.user_id] || '학생'}</div>
                  <div style={{ fontSize:11, color: T.mut, marginBottom:3 }}>{fmt(b)}{b.seat ? ` · ${b.seat}자리` : ''}</div>
                  <div style={{ fontSize:10, color: T.mut }}>신청 {fmtTs(b.created_at)} · <span style={{ fontWeight:700, color: isExp ? BAD.tx : WARN.tx }}>{timeLeft}</span></div>
                </div>
                <div style={{ fontSize:16, fontWeight:800, color: OK.tx, flexShrink:0, marginLeft:8, fontVariantNumeric:'tabular-nums' }}>{(b.amount||0).toLocaleString()}원</div>
              </div>
              <div style={{ display:'flex', gap:7 }}>
                <button onClick={() => handleCancelPending(b.id)} disabled={!!cancelling[b.id]}
                  style={{ flex:1, padding:'9px', background: T.fieldBg, color:'#5c6b5f', border:'none', borderRadius:11, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: cancelling[b.id] ? 0.5 : 1 }}>
                  취소
                </button>
                <button onClick={() => handleConfirm(b.id)} disabled={!!confirming[b.id]}
                  style={{ flex:2, padding:'9px', background: PRIMARY, color:'#fff', border:'none', borderRadius:11, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: confirming[b.id] ? 0.5 : 1 }}>
                  {confirming[b.id] ? '처리중...' : '✓ 입금 확인'}
                </button>
              </div>
            </div>
          )
        })}

        {/* ── 환불 필요 ─────────────────────────────────────────── */}
        <div style={{ marginTop:18 }}>
          <SectionHead dot={BAD.dot} tx={BAD.tx} label="환불 필요" count={refunds.length} />
        </div>

        {refunds.length === 0 ? (
          <div style={{ textAlign:'center', padding:'12px 0 20px', color: T.mut, fontSize:12 }}>환불 대기 없음</div>
        ) : (
          <>
            <div style={{ fontSize:11, color: T.mut, marginBottom:8, lineHeight:1.5 }}>
              학생 계좌를 확인 후 직접 송금하세요. 완료 후 [환불 완료]를 눌러주세요.
            </div>
            {refunds.map(b => (
              <div key={b.id} style={{ borderRadius:15, marginBottom:8, padding:'13px 14px', border:'0.5px solid rgba(193,86,77,0.35)', background: BAD.soft }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:11 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color: T.text, marginBottom:3, letterSpacing:'-0.2px' }}>{userMap[b.user_id] || '학생'}</div>
                    <div style={{ fontSize:11, color: T.mut, marginBottom:3 }}>{fmt(b)}{b.seat ? ` · ${b.seat}자리` : ''}</div>
                    <div style={{ fontSize:10, color: T.mut }}>예약 {fmtTs(b.created_at)}</div>
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color: BAD.tx, flexShrink:0, marginLeft:8, fontVariantNumeric:'tabular-nums' }}>{(b.amount||0).toLocaleString()}원</div>
                </div>
                <button onClick={() => handleRefundDone(b.id)} disabled={!!refunding[b.id]}
                  style={{ width:'100%', padding:'9px', background: BAD.main, color:'#fff', border:'none', borderRadius:11, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: refunding[b.id] ? 0.5 : 1 }}>
                  {refunding[b.id] ? '처리중...' : '✓ 환불 완료'}
                </button>
              </div>
            ))}
          </>
        )}

        {/* ── 취소·환불 불필요 (히스토리) ──────────────────────── */}
        {history.length > 0 && (
          <>
            <div style={{ marginTop:18 }}>
              <SectionHead dot={T.faint} tx={T.mut} label="환불 불필요" count={`6시간 이내 취소 · 최근 ${history.length}건`} />
            </div>
            {history.map(b => (
              <div key={b.id} style={{ borderRadius:13, marginBottom:6, padding:'10px 14px', background: T.tileBg, opacity:0.85 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color: T.text }}>{userMap[b.user_id] || '학생'}</div>
                    <div style={{ fontSize:10, color: T.mut }}>{fmt(b)}</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color: T.mut, fontVariantNumeric:'tabular-nums' }}>{(b.amount||0).toLocaleString()}원</div>
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ height:80 }}/>
      </div>

      <AdminNav active="payment"/>
    </>
  )
}
