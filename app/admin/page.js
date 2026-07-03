'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/AdminNav'
import { registerPush } from '../../lib/pushNotify'
import { HEADER_BG, PRIMARY, MST } from '../../lib/adminTheme'

const STATUS_ORDER = { '만료': 0, '만료임박': 1, '수강중': 2 }

function getStatus(ticket) {
  if (!ticket) return '만료'
  const days = Math.ceil((new Date(ticket.expires_at) - new Date()) / 864e5)
  if (ticket.remain === 0 || days <= 0) return '만료'
  if (days <= 7) return '만료임박'
  return '수강중'
}

function getDaysLeft(ticket) {
  if (!ticket) return -999
  return Math.ceil((new Date(ticket.expires_at) - new Date()) / 864e5)
}

const QUICK_PRESETS = [[3,28,'4주3회'],[4,30,'4회권'],[7,56,'8주7회'],[8,60,'8회권'],[12,90,'12회권']]

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser]   = useState(null)
  const [members, setMembers] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [loading, setLoading] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [customInputs, setCustomInputs] = useState({})
  const [meetingInputs, setMeetingInputs] = useState({})
  const [memberMeetingTickets, setMemberMeetingTickets] = useState({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadMembers()
    })
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted')
  }, [])

  async function handleEnablePush() {
    const { data } = await supabase.auth.getUser()
    const ok = await registerPush(data.user.id)
    if (ok) { setPushEnabled(true); alert('예약 알림이 설정됐어요! 🐾') }
    else alert('알림 허용을 눌러주세요.')
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('users')
      .select('*, tickets(*), bookings(*)')
      .eq('role', 'student')
    setMembers(data || [])
    const { data: mt } = await supabase.from('meeting_tickets').select('*')
    const ticketMap = {}
    mt?.forEach(t => {
      if (!ticketMap[t.user_id]) ticketMap[t.user_id] = []
      ticketMap[t.user_id].push(t)
    })
    setMemberMeetingTickets(ticketMap)
    setLoading(false)
  }

  async function grantTicket(userId, type, total, days) {
    const expires = new Date()
    expires.setDate(expires.getDate() + days)
    await supabase.from('tickets').delete().eq('user_id', userId)
    await supabase.from('tickets').insert({
      user_id: userId, type, total, remain: total,
      expires_at: expires.toISOString().split('T')[0]
    })
    alert('수강권이 부여됐어요!')
    loadMembers()
  }

  // 횟수 입력 없이 일수(만료일)만 갱신 — 기존 수강권의 잔여·총 횟수는 유지
  async function updateTicketExpiry(ticket, days) {
    const expires = new Date()
    expires.setDate(expires.getDate() + days)
    await supabase.from('tickets').update({ expires_at: expires.toISOString().split('T')[0] }).eq('id', ticket.id)
    alert(`만료일이 오늘부터 ${days}일 뒤로 변경됐어요!`)
    loadMembers()
  }

  async function adjustTicket(ticketId, currentRemain, delta) {
    const next = currentRemain + delta
    if (next < 0) { alert('잔여 횟수가 0보다 작아질 수 없어요'); return }
    await supabase.from('tickets').update({ remain: next }).eq('id', ticketId)
    loadMembers()
  }

  async function grantMeetingTicket(userId, total) {
    const expires = new Date()
    expires.setMonth(expires.getMonth() + 1)
    await supabase.from('meeting_tickets').delete().eq('user_id', userId).eq('status', 'confirmed')
    await supabase.from('meeting_tickets').insert({
      user_id: userId, total, remain: total,
      status: 'confirmed',
      expires_at: expires.toISOString().split('T')[0]
    })
    alert('모임 참여권이 부여됐어요!')
    loadMembers()
  }

  async function adjustMeetingTicket(ticketId, currentRemain, delta) {
    const next = currentRemain + delta
    if (next < 0) { alert('잔여 횟수가 0보다 작아질 수 없어요'); return }
    await supabase.from('meeting_tickets').update({ remain: next }).eq('id', ticketId)
    loadMembers()
  }

  const searched = members
    .filter(m => !search || m.name?.includes(search) || m.phone?.includes(search))

  const countAll      = searched.length
  const countExpiring = searched.filter(m => { const s = getStatus(m.tickets?.[0]); return s === '만료' || s === '만료임박' }).length
  const countZero     = searched.filter(m => { const t = m.tickets?.[0]; return !t || t.remain === 0 }).length

  const filtered = searched
    .filter(m => {
      const t = m.tickets?.[0]
      if (filter === 'expiring') { const s = getStatus(t); return s === '만료' || s === '만료임박' }
      if (filter === 'zero')     return !t || t.remain === 0
      return true
    })
    .sort((a, b) => {
      const sa = getStatus(a.tickets?.[0]), sb = getStatus(b.tickets?.[0])
      if (STATUS_ORDER[sa] !== STATUS_ORDER[sb]) return STATUS_ORDER[sa] - STATUS_ORDER[sb]
      return (a.name || '').localeCompare(b.name || '')
    })

  const statusCounts = filtered.reduce((acc, m) => {
    const s = getStatus(m.tickets?.[0])
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  let lastStatus = null

  return (
    <>
      {/* Header */}
      <div className="header" style={{ background: HEADER_BG, flexDirection:'column', gap:12, paddingBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>👥</span>
            <span className="header-title">회원 관리</span>
          </div>
          <div style={{ display:'flex', gap:5 }}>
            <button onClick={handleEnablePush}
              style={{ background: pushEnabled ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.15)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              {pushEnabled ? '🔔 알림ON' : '🔕 알림설정'}
            </button>
            <button onClick={() => window.location.href = '/api/kakao/login'}
              style={{ background:'rgba(255,232,120,0.26)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              💬 카톡연동
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              로그아웃
            </button>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:9, background:'rgba(255,255,255,0.16)', borderRadius:14, padding:'9px 14px', width:'100%', boxSizing:'border-box' }}>
          <span style={{ color:'rgba(255,255,255,0.8)', fontSize:14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 휴대폰 번호 검색"
            style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:12, fontFamily:'Nunito,sans-serif', fontWeight:600, width:'100%' }}/>
        </div>
      </div>

      {/* Content */}
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'14px 14px 80px' }}>

        {/* Segmented filter */}
        <div style={{ display:'flex', background:'var(--g1)', borderRadius:13, padding:3, marginBottom:4 }}>
          {[['all','전체',countAll],['expiring','만료·임박',countExpiring],['zero','잔여 0',countZero]].map(([val, label, cnt]) => {
            const on = filter === val
            return (
              <button key={val} onClick={() => setFilter(val)}
                style={{ flex:1, textAlign:'center', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif',
                  background: on ? '#fff' : 'transparent', color: on ? 'var(--acTx)' : 'var(--tmu)',
                  borderRadius:10, padding:'7px 0', fontSize:11, fontWeight: on ? 800 : 700,
                  boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                {label} {cnt}
              </button>
            )
          })}
        </div>

        {/* Member list — grouped by status */}
        {filtered.map(m => {
          const ticket   = m.tickets?.[0]
          const isOpen   = expanded === m.id
          const daysLeft = getDaysLeft(ticket)
          const status   = getStatus(ticket)
          const st       = MST[status]
          const remainColor = !ticket || ticket.remain === 0 ? '#9B453D' : ticket.remain <= 2 ? '#B5650E' : 'var(--acTx)'
          const pct      = ticket && ticket.total ? Math.min(1, ticket.remain / ticket.total) : 0
          const R = 17.5, CIRC = 2 * Math.PI * R

          const showHead = status !== lastStatus
          lastStatus = status

          return (
            <div key={m.id}>

              {/* Section header */}
              {showHead && (
                <div style={{ display:'flex', alignItems:'center', gap:7, margin:'12px 3px 7px' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background: st.dot }}/>
                  <span style={{ fontSize:11, fontWeight:800, color: st.tx, letterSpacing:'0.2px' }}>{status}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:'#bcc2ba' }}>{statusCounts[status]}</span>
                  <span style={{ flex:1, height:1, background:'rgba(0,0,0,0.05)' }}/>
                </div>
              )}

              <div style={{ border:`0.5px solid ${isOpen ? 'rgba(76,139,41,0.45)' : 'rgba(0,0,0,0.06)'}`, borderRadius:16, marginBottom:7, background: isOpen ? '#FBFCF9' : '#fff', overflow:'hidden' }}>

                {/* ── Collapsed row ── */}
                <div onClick={() => setExpanded(isOpen ? null : m.id)}
                  style={{ padding:'11px 13px', display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>

                  {/* Ring avatar */}
                  <div style={{ position:'relative', width:40, height:40, flexShrink:0 }}>
                    <svg width={40} height={40} viewBox="0 0 40 40">
                      <circle cx={20} cy={20} r={R} fill="none" stroke="#ECEAE2" strokeWidth={2.5}/>
                      {pct > 0 && (
                        <circle cx={20} cy={20} r={R} fill="none" stroke={st.main} strokeWidth={2.5} strokeLinecap="round"
                          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)} transform="rotate(-90 20 20)"/>
                      )}
                    </svg>
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13.5, fontWeight:800, color: st.tx }}>
                      {m.name?.[0] || '?'}
                    </div>
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:800, color:'#1c2a24', marginBottom:2, letterSpacing:'-0.2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize:11, color:'#a2aaa1', fontWeight:600 }}>{m.phone}</div>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                    <span style={{ fontSize:13, fontWeight:800, color: remainColor, fontVariantNumeric:'tabular-nums' }}>
                      {ticket ? `${ticket.remain}/${ticket.total}회` : '—'}
                    </span>
                    {status !== '수강중' ? (
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:8, background: st.soft, color: st.tx }}>
                        {daysLeft <= 0 ? '만료됨' : `${daysLeft}일`}
                      </span>
                    ) : (
                      <span style={{ fontSize:10, fontWeight:600, color:'#a2aaa1' }}>{daysLeft}일 남음</span>
                    )}
                  </div>

                  <span style={{ fontSize:17, color: isOpen ? 'var(--ac)' : 'var(--tl)', display:'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition:'transform 0.18s', flexShrink:0 }}>›</span>
                </div>

                {/* ── Expanded panel ── */}
                {isOpen && (
                  <div style={{ padding:'0 13px 15px' }}>

                    {/* 수강권 */}
                    <div style={{ background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:15, padding:14, marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom: ticket ? 11 : 0 }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#a2aaa1', marginBottom:4 }}>수강권</div>
                          {ticket ? (
                            <>
                              <div style={{ fontSize:17, fontWeight:800, color:'#1c2a24', fontVariantNumeric:'tabular-nums' }}>
                                {ticket.remain}<span style={{ fontSize:13, color:'#a2aaa1' }}>/{ticket.total}회</span>
                              </div>
                              <div style={{ fontSize:10, fontWeight:600, color:'#a2aaa1', marginTop:3 }}>
                                {daysLeft <= 0 ? '만료됨' : `만료 ${ticket.expires_at} · ${daysLeft}일`}
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize:13, fontWeight:800, color:'#a2aaa1' }}>수강권 없음</div>
                          )}
                        </div>
                        {ticket && (
                          <div style={{ display:'inline-flex', alignItems:'stretch', border:'1px solid rgba(0,0,0,0.12)', borderRadius:11, overflow:'hidden', flexShrink:0 }}>
                            <button onClick={e => { e.stopPropagation(); adjustTicket(ticket.id, ticket.remain, -1) }}
                              style={{ padding:'7px 14px', background:'transparent', border:'none', color:'#9B453D', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>−</button>
                            <span style={{ padding:'7px 12px', fontSize:13, fontWeight:800, color:'#1c2a24', borderLeft:'1px solid rgba(0,0,0,0.1)', borderRight:'1px solid rgba(0,0,0,0.1)', display:'flex', alignItems:'center', fontVariantNumeric:'tabular-nums' }}>{ticket.remain}</span>
                            <button onClick={e => { e.stopPropagation(); adjustTicket(ticket.id, ticket.remain, 1) }}
                              style={{ padding:'7px 14px', background:'transparent', border:'none', color:'var(--ac)', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>+</button>
                          </div>
                        )}
                      </div>

                      {ticket && (
                        <div style={{ height:6, borderRadius:4, background:'#EFEDE6', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(100, Math.round(ticket.remain / ticket.total * 100))}%`, background:'var(--ac)', borderRadius:4, transition:'width 0.3s ease' }}/>
                        </div>
                      )}

                      <div style={{ borderTop:'0.5px solid rgba(0,0,0,0.07)', marginTop: ticket ? 13 : 10, paddingTop:12 }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#a2aaa1', marginBottom:8, letterSpacing:'0.3px' }}>빠른 부여</div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                          {QUICK_PRESETS.map(([total, days, label]) => (
                            <button key={label}
                              onClick={e => { e.stopPropagation(); grantTicket(m.id, label, total, days) }}
                              style={{ padding:'7px 12px', background:'#fff', color:'var(--acTx)', border:'1px solid rgb(var(--ac-rgb) / 0.3)', borderRadius:11, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                          <input type="number" placeholder="횟수"
                            value={customInputs[m.id]?.total || ''}
                            onChange={e => setCustomInputs(prev => ({ ...prev, [m.id]: { ...prev[m.id], total: e.target.value } }))}
                            onClick={e => e.stopPropagation()}
                            style={{ flex:1, minWidth:0, padding:'8px 11px', background:'#F5F4EF', border:'none', borderRadius:11, fontSize:12, fontFamily:'Nunito,sans-serif', color:'#1c2a24', outline:'none' }}/>
                          <input type="number" placeholder="일수(만료일)"
                            value={customInputs[m.id]?.days || ''}
                            onChange={e => setCustomInputs(prev => ({ ...prev, [m.id]: { ...prev[m.id], days: e.target.value } }))}
                            onClick={e => e.stopPropagation()}
                            style={{ flex:1, minWidth:0, padding:'8px 11px', background:'#F5F4EF', border:'none', borderRadius:11, fontSize:12, fontFamily:'Nunito,sans-serif', color:'#1c2a24', outline:'none' }}/>
                          <button onClick={e => {
                            e.stopPropagation()
                            const t = parseInt(customInputs[m.id]?.total)
                            const d = parseInt(customInputs[m.id]?.days)
                            if (!t && !d) { alert('횟수 또는 일수를 입력해 주세요'); return }
                            if (!t) {
                              // 일수만 입력 → 기존 수강권 만료일만 갱신(횟수 유지)
                              if (!ticket) { alert('수강권이 없어요. 횟수도 함께 입력해 새로 부여해 주세요'); return }
                              updateTicketExpiry(ticket, d)
                            } else {
                              // 횟수 입력 → 새 수강권 부여(일수 미입력 시 기본 30일)
                              grantTicket(m.id, `${t}회권`, t, d || 30)
                            }
                            setCustomInputs(prev => ({ ...prev, [m.id]: { total: '', days: '' } }))
                          }}
                            style={{ padding:'8px 18px', background: PRIMARY, color:'#fff', border:'none', borderRadius:11, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                            {ticket && !customInputs[m.id]?.total && customInputs[m.id]?.days ? '만료일 변경' : '부여'}
                          </button>
                        </div>
                        {ticket && (
                          <div style={{ fontSize:9, color:'#a2aaa1', marginTop:6, lineHeight:1.4 }}>
                            일수만 입력하면 잔여 횟수는 그대로 두고 만료일만 바뀌어요
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 모임 참여권 */}
                    <div style={{ background:'#FBFAF5', border:'0.5px solid rgba(0,0,0,0.07)', borderRadius:15, padding:14, marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:700, color:'#B5650E', marginBottom:10 }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:'#E8912A' }}/> 모임 참여권
                      </div>
                      {memberMeetingTickets[m.id]?.filter(mt => mt.remain > 0).length > 0 ? (
                        memberMeetingTickets[m.id].filter(mt => mt.remain > 0).map(mt => (
                          <div key={mt.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                            <div style={{ flex:1, fontSize:11, fontWeight:700, color:'#1c2a24' }}>
                              {mt.remain}/{mt.total}회 · {mt.expires_at}까지
                            </div>
                            <button onClick={e => { e.stopPropagation(); adjustMeetingTicket(mt.id, mt.remain, -1) }}
                              style={{ padding:'4px 11px', background:'#F7ECEA', color:'#9B453D', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>−1</button>
                            <button onClick={e => { e.stopPropagation(); adjustMeetingTicket(mt.id, mt.remain, 1) }}
                              style={{ padding:'4px 11px', background:'var(--acBg)', color:'var(--acTx)', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>+1</button>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize:11, color:'#a2aaa1', marginBottom:10 }}>모임권 없음</div>
                      )}
                      <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                        <input type="number" placeholder="횟수 (기본 4)"
                          value={meetingInputs[m.id] || ''}
                          onChange={e => setMeetingInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                          onClick={e => e.stopPropagation()}
                          style={{ flex:1, minWidth:0, padding:'8px 11px', background:'#fff', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:11, fontSize:12, fontFamily:'Nunito,sans-serif', color:'#1c2a24', outline:'none' }}/>
                        <button onClick={e => {
                          e.stopPropagation()
                          const t = parseInt(meetingInputs[m.id]) || 4
                          grantMeetingTicket(m.id, t)
                          setMeetingInputs(prev => ({ ...prev, [m.id]: '' }))
                        }}
                          style={{ padding:'8px 14px', background:'#D98A2B', color:'#fff', border:'none', borderRadius:11, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', whiteSpace:'nowrap' }}>
                          모임권 부여
                        </button>
                      </div>
                    </div>

                    {/* 통계 */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      <div style={{ background:'#F6F5F1', borderRadius:13, padding:'11px 12px' }}>
                        <div style={{ fontSize:19, fontWeight:800, color:'#1c2a24', fontVariantNumeric:'tabular-nums' }}>{m.bookings?.length || 0}</div>
                        <div style={{ fontSize:10, color:'#a2aaa1', fontWeight:700, marginTop:2 }}>총 예약</div>
                      </div>
                      <div style={{ background:'var(--acBg)', borderRadius:13, padding:'11px 12px' }}>
                        <div style={{ fontSize:19, fontWeight:800, color:'var(--acTx)', fontVariantNumeric:'tabular-nums' }}>{m.bookings?.filter(b => b.status === 'attended').length || 0}</div>
                        <div style={{ fontSize:10, color:'#7c9a6a', fontWeight:700, marginTop:2 }}>출석</div>
                      </div>
                      <div style={{ background:'#F6E8E6', borderRadius:13, padding:'11px 12px' }}>
                        <div style={{ fontSize:19, fontWeight:800, color:'#94382F', fontVariantNumeric:'tabular-nums' }}>{m.bookings?.filter(b => b.status === 'absent').length || 0}</div>
                        <div style={{ fontSize:10, color:'#b98d86', fontWeight:700, marginTop:2 }}>결석</div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <AdminNav active="member" />
    </>
  )
}
