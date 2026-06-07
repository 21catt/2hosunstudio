'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import AdminNav from '../../components/AdminNav'
import { registerPush } from '../../lib/pushNotify'

const ACCENT      = '#3B6D11'
const ACCENT_BG   = '#EAF3DE'
const ACCENT_TEXT = '#27500A'
const EXP_COLOR   = '#9B2F2F'
const EXP_BG      = '#FFEBEE'
const WARN_COLOR  = '#E65100'
const WARN_BG     = '#FFF3E0'
const BORDER      = 'rgba(0,0,0,0.10)'

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

const STATUS_STYLE = {
  '수강중':  { color: ACCENT_TEXT, bg: ACCENT_BG },
  '만료임박': { color: WARN_COLOR,  bg: WARN_BG   },
  '만료':    { color: EXP_COLOR,   bg: EXP_BG    },
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

  const filtered = members
    .filter(m => !search || m.name?.includes(search) || m.phone?.includes(search))
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

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      {/* Header */}
      <div className="header" style={{ flexDirection:'column', gap:10, paddingBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>👥</span>
            <span className="header-title">회원 관리</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={handleEnablePush}
              style={{ background: pushEnabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              {pushEnabled ? '🔔 알림ON' : '🔕 알림설정'}
            </button>
            <button onClick={() => window.location.href = '/api/kakao/login'}
              style={{ background:'rgba(255,235,0,0.3)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              💬 카톡연동
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              로그아웃
            </button>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'8px 14px', width:'100%', boxSizing:'border-box' }}>
          <span style={{ color:'rgba(255,255,255,0.8)', fontSize:14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 휴대폰 번호 검색"
            style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:12, fontFamily:'Nunito,sans-serif', fontWeight:600, width:'100%' }}/>
        </div>
      </div>

      {/* Content */}
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'14px 14px 80px' }}>

        {/* Filter chips */}
        <div style={{ display:'flex', gap:6, marginBottom:12, alignItems:'center' }}>
          {[['all','전체'],['expiring','만료·임박'],['zero','잔여 0']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${filter===val ? ACCENT : BORDER}`, background: filter===val ? ACCENT_BG : 'var(--g1)', color: filter===val ? ACCENT_TEXT : 'var(--tmu)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
              {label}
            </button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--tmu)', fontWeight:600 }}>{filtered.length}명</span>
        </div>

        {/* Accordion list */}
        {filtered.map(m => {
          const ticket   = m.tickets?.[0]
          const isOpen   = expanded === m.id
          const daysLeft = getDaysLeft(ticket)
          const status   = getStatus(ticket)
          const sStyle   = STATUS_STYLE[status]
          const remainColor = !ticket || ticket.remain === 0 ? EXP_COLOR : ticket.remain <= 2 ? WARN_COLOR : ACCENT_TEXT
          const daysColor   = daysLeft <= 0 ? EXP_COLOR : daysLeft <= 7 ? WARN_COLOR : 'var(--tmu)'

          return (
            <div key={m.id}
              style={{ borderRadius:14, border:`0.5px solid ${isOpen ? ACCENT : BORDER}`, marginBottom:8, background: isOpen ? '#FAFAF8' : '#fff', overflow:'hidden' }}>

              {/* ── Collapsed row ── */}
              <div onClick={() => setExpanded(isOpen ? null : m.id)}
                style={{ padding:'11px 12px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>

                <div style={{ width:36, height:36, borderRadius:'50%', background: sStyle.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color: sStyle.color, flexShrink:0 }}>
                  {m.name?.[0] || '?'}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'var(--td)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:6, background: sStyle.bg, color: sStyle.color, flexShrink:0 }}>{status}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--tmu)' }}>{m.phone}</div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:1, flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:800, color: remainColor }}>
                    {ticket ? `${ticket.remain}/${ticket.total}회` : '—'}
                  </span>
                  <span style={{ fontSize:10, fontWeight:600, color: daysColor }}>
                    {daysLeft <= 0 ? '만료됨' : `${daysLeft}일 남음`}
                  </span>
                </div>

                <span style={{ fontSize:15, color: isOpen ? ACCENT : 'var(--tmu)', display:'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition:'transform 0.18s', flexShrink:0 }}>›</span>
              </div>

              {/* ── Expanded panel ── */}
              {isOpen && (
                <div style={{ padding:'2px 14px 16px', borderTop:`1px solid ${ACCENT}1A` }}>

                  {/* 수강권 */}
                  <div style={{ marginTop:12, marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수강권</div>

                    {/* 빠른 부여 칩 */}
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                      {QUICK_PRESETS.map(([total, days, label]) => (
                        <button key={label}
                          onClick={e => { e.stopPropagation(); grantTicket(m.id, label, total, days) }}
                          style={{ padding:'6px 10px', background: ACCENT_BG, color: ACCENT_TEXT, border:`1px solid ${ACCENT}44`, borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* 직접 입력 부여 */}
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8 }}>
                      <input type="number" placeholder="횟수"
                        value={customInputs[m.id]?.total || ''}
                        onChange={e => setCustomInputs(prev => ({ ...prev, [m.id]: { ...prev[m.id], total: e.target.value } }))}
                        onClick={e => e.stopPropagation()}
                        style={{ flex:1, padding:'7px 10px', background:'var(--g1)', border:`1px solid ${BORDER}`, borderRadius:10, fontSize:12, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
                      <input type="number" placeholder="일수"
                        value={customInputs[m.id]?.days || ''}
                        onChange={e => setCustomInputs(prev => ({ ...prev, [m.id]: { ...prev[m.id], days: e.target.value } }))}
                        onClick={e => e.stopPropagation()}
                        style={{ flex:1, padding:'7px 10px', background:'var(--g1)', border:`1px solid ${BORDER}`, borderRadius:10, fontSize:12, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
                      <button onClick={e => {
                        e.stopPropagation()
                        const t = parseInt(customInputs[m.id]?.total)
                        const d = parseInt(customInputs[m.id]?.days)
                        if (!t || !d) { alert('횟수와 일수를 입력해 주세요'); return }
                        grantTicket(m.id, `${t}회권`, t, d)
                        setCustomInputs(prev => ({ ...prev, [m.id]: { total: '', days: '' } }))
                      }}
                        style={{ padding:'7px 14px', background: ACCENT, color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        부여
                      </button>
                    </div>

                    {/* 잔여 조정 */}
                    {ticket && (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:11, color:'var(--tmu)', flex:1 }}>잔여 조정 · 현재 {ticket.remain}회</span>
                        <button onClick={e => { e.stopPropagation(); adjustTicket(ticket.id, ticket.remain, -1) }}
                          style={{ padding:'5px 16px', background: EXP_BG, color: EXP_COLOR, border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                          −1
                        </button>
                        <button onClick={e => { e.stopPropagation(); adjustTicket(ticket.id, ticket.remain, 1) }}
                          style={{ padding:'5px 16px', background: ACCENT_BG, color: ACCENT_TEXT, border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                          +1
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 모임 참여권 */}
                  <div style={{ background:'#FFFBF0', borderRadius:12, padding:'12px 12px', border:'1px solid #FFE082', marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#B8860B', marginBottom:8 }}>👥 모임 참여권</div>
                    {memberMeetingTickets[m.id]?.filter(mt => mt.remain > 0).length > 0 ? (
                      memberMeetingTickets[m.id].filter(mt => mt.remain > 0).map(mt => (
                        <div key={mt.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                          <div style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--td)' }}>
                            {mt.remain}/{mt.total}회 · {mt.expires_at}까지
                          </div>
                          <button onClick={e => { e.stopPropagation(); adjustMeetingTicket(mt.id, mt.remain, -1) }}
                            style={{ padding:'4px 10px', background: EXP_BG, color: EXP_COLOR, border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>−1</button>
                          <button onClick={e => { e.stopPropagation(); adjustMeetingTicket(mt.id, mt.remain, 1) }}
                            style={{ padding:'4px 10px', background: ACCENT_BG, color: ACCENT_TEXT, border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>+1</button>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize:10, color:'var(--tmu)', marginBottom:8 }}>모임권 없음</div>
                    )}
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" placeholder="횟수 (기본 4)"
                        value={meetingInputs[m.id] || ''}
                        onChange={e => setMeetingInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        style={{ flex:1, padding:'7px 10px', background:'#fff', border:'1px solid #FFE082', borderRadius:10, fontSize:12, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
                      <button onClick={e => {
                        e.stopPropagation()
                        const t = parseInt(meetingInputs[m.id]) || 4
                        grantMeetingTicket(m.id, t)
                        setMeetingInputs(prev => ({ ...prev, [m.id]: '' }))
                      }}
                        style={{ padding:'7px 12px', background:'#F57F17', color:'#fff', border:'none', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', whiteSpace:'nowrap' }}>
                        모임권 부여
                      </button>
                    </div>
                  </div>

                  {/* 통계 */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7 }}>
                    <div style={{ background:'var(--g1)', borderRadius:10, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:3 }}>총 예약</div>
                      <div style={{ fontSize:14, fontWeight:800, color:'var(--td)' }}>{m.bookings?.length || 0}회</div>
                    </div>
                    <div style={{ background:'var(--g1)', borderRadius:10, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:3 }}>출석</div>
                      <div style={{ fontSize:14, fontWeight:800, color: ACCENT_TEXT }}>
                        {m.bookings?.filter(b => b.status === 'attended').length || 0}회
                      </div>
                    </div>
                    <div style={{ background:'var(--g1)', borderRadius:10, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:3 }}>결석</div>
                      <div style={{ fontSize:14, fontWeight:800, color: EXP_COLOR }}>
                        {m.bookings?.filter(b => b.status === 'absent').length || 0}회
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )
        })}
      </div>

      <AdminNav active="member" />
    </>
  )
}
