'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import { HEADER_BG, PRIMARY, MST } from '../../../lib/adminTheme'

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

export default function AdminMembersPage() {
  const router = useRouter()
  const [user, setUser]   = useState(null)
  const [members, setMembers] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [loading, setLoading] = useState(true)
  const [customInputs, setCustomInputs] = useState({})
  const [meetingInputs, setMeetingInputs] = useState({})
  const [memberMeetingTickets, setMemberMeetingTickets] = useState({})
  const [memberUnlockAll, setMemberUnlockAll] = useState({}) // {userId: bool} — 냥 꾸미기 전체 해금
  const [artists, setArtists] = useState([]) // 참여작가 (하단 별도 목록)
  const [harvestMap, setHarvestMap] = useState({}) // {userId: harvest_count}
  const [deleting, setDeleting] = useState(null) // 삭제 중인 userId
  const [attOpen, setAttOpen] = useState(null)   // 참석기록 펼친 userId
  const [armed, setArmed] = useState(null)       // 삭제 확인(잠금해제)된 userId

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadMembers()
    })
  }, [])

  // 다른 화면 다녀온 뒤 돌아오면 최신 명단 자동 반영(새 가입자 등) — 하드 리로드 불필요
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') loadMembers() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  async function loadMembers() {
    const { data } = await supabase
      .from('users')
      .select('*, tickets(*), bookings(*)')
      .eq('role', 'student')
    setMembers(data || [])
    // 참여작가 — 하단 별도 목록
    const { data: art } = await supabase.from('users').select('*, bookings(*)').eq('role', 'artist')
    setArtists(art || [])
    const { data: mt } = await supabase.from('meeting_tickets').select('*')
    const ticketMap = {}
    mt?.forEach(t => {
      if (!ticketMap[t.user_id]) ticketMap[t.user_id] = []
      ticketMap[t.user_id].push(t)
    })
    setMemberMeetingTickets(ticketMap)
    // 냥 꾸미기 해금 상태 + 수확 개수 — 컬럼이 아직 없으면 전부 꺼진 것으로 표시
    const { data: prefs } = await supabase.from('user_prefs').select('user_id, unlock_all, harvest_count')
    const unlockMap = {}
    const hvMap = {}
    prefs?.forEach(p => { unlockMap[p.user_id] = p.unlock_all === true; if (Number.isFinite(p.harvest_count)) hvMap[p.user_id] = p.harvest_count })
    setMemberUnlockAll(unlockMap)
    setHarvestMap(hvMap)
    setLoading(false)
  }

  // 냥 꾸미기 전체 해금 토글 — 켜면 수확 횟수를 채우지 않아도 프로필냥·농부냥을 모두 쓸 수 있다
  async function toggleUnlockAll(userId, next) {
    setMemberUnlockAll(prev => ({ ...prev, [userId]: next }))
    const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, unlock_all: next })
    if (error) {
      setMemberUnlockAll(prev => ({ ...prev, [userId]: !next }))
      alert(`저장에 실패했어요: ${error.message}\n\n권한 문제라면 migration-user-prefs-admin-policy.sql을 실행해 주세요.`)
    }
  }

  // 수확 작물 부여 — user_prefs.harvest_count 설정(테마·냥이 해금 기준)
  async function setHarvestCount(userId, next) {
    const n = Math.max(0, next)
    const prevN = harvestMap[userId] || 0
    setHarvestMap(prev => ({ ...prev, [userId]: n }))
    const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, harvest_count: n })
    if (error) {
      setHarvestMap(prev => ({ ...prev, [userId]: prevN }))
      alert(`저장에 실패했어요: ${error.message}`)
    }
  }

  // 회원 삭제 — 관리자 전용 서버 라우트로 관련 데이터 정리 후 users+auth 삭제(되돌릴 수 없음)
  async function deleteMember(m) {
    setDeleting(m.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/admin/delete-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: m.id }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert('삭제 실패: ' + (j.error || res.status)); return }
      setArmed(null); setExpanded(null)
      loadMembers()
    } finally {
      setDeleting(null)
    }
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

  const artistList = search
    ? artists.filter(a => (a.name || '').includes(search) || (a.phone || '').includes(search))
    : artists

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()

  let lastStatus = null

  return (
    <>
      {/* Header */}
      <div className="header" style={{ background: HEADER_BG, flexDirection:'column', gap:12, paddingBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <NavIcon name="users" color="#fff" size={20} />
            <span className="header-title">회원 관리</span>
          </div>
          <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.75)' }}>총 {members.length}명</span>
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

                    {/* 냥 꾸미기 전체 해금 — 수확 횟수를 안 채워도 프로필냥·농부냥 전부 사용 가능 */}
                    {(() => {
                      const on = memberUnlockAll[m.id] === true
                      return (
                        <div style={{ background:'#FBFAF5', border:'0.5px solid rgba(0,0,0,0.07)', borderRadius:15, padding:'13px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:11 }}>
                          <span style={{ fontSize:19, flexShrink:0 }}>{on ? '🔓' : '🔒'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:800, color:'#1c2a24' }}>냥 꾸미기 전체 해금</div>
                            <div style={{ fontSize:10, color:'#a2aaa1', fontWeight:600, marginTop:2, lineHeight:1.5 }}>
                              {on ? '수확 횟수 없이 프로필냥·농부냥을 모두 쓸 수 있어요' : '켜면 수확 횟수를 채우지 않아도 모든 냥이가 열려요'}
                            </div>
                          </div>
                          <div onClick={e => { e.stopPropagation(); toggleUnlockAll(m.id, !on) }}
                            style={{ width:46, height:27, borderRadius:14, background: on ? 'var(--ac)' : '#E4E2D9', position:'relative', cursor:'pointer', transition:'background 0.18s ease', flexShrink:0 }}>
                            <span style={{ position:'absolute', top:3, left: on ? 22 : 3, width:21, height:21, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.25)', transition:'left 0.18s ease' }}/>
                          </div>
                        </div>
                      )
                    })()}

                    {/* 통계 */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      <div style={{ background:'#F6F5F1', borderRadius:13, padding:'11px 12px' }}>
                        <div style={{ fontSize:19, fontWeight:800, color:'#1c2a24', fontVariantNumeric:'tabular-nums' }}>{m.bookings?.length || 0}</div>
                        <div style={{ fontSize:10, color:'#a2aaa1', fontWeight:700, marginTop:2 }}>총 예약</div>
                      </div>
                      <div style={{ background:'var(--acBg)', borderRadius:13, padding:'11px 12px' }}>
                        <div style={{ fontSize:19, fontWeight:800, color:'var(--acTx)', fontVariantNumeric:'tabular-nums' }}>{m.bookings?.filter(b => b.attended === true).length || 0}</div>
                        <div style={{ fontSize:10, color:'#7c9a6a', fontWeight:700, marginTop:2 }}>출석</div>
                      </div>
                      <div style={{ background:'#F6E8E6', borderRadius:13, padding:'11px 12px' }}>
                        <div style={{ fontSize:19, fontWeight:800, color:'#94382F', fontVariantNumeric:'tabular-nums' }}>{m.bookings?.filter(b => b.attended !== true && b.status !== 'cancelled' && (b.class_date || '') < todayStr).length || 0}</div>
                        <div style={{ fontSize:10, color:'#b98d86', fontWeight:700, marginTop:2 }}>결석</div>
                      </div>
                    </div>

                    {/* 수업 참석 기록 — 접기/펼치기 · 월별 묶음 · 요일 표시 */}
                    {(() => {
                      const recs = (m.bookings || []).filter(b => b.status !== 'cancelled')
                        .sort((a, b) => (b.class_date || '').localeCompare(a.class_date || '') || (b.class_time || '').localeCompare(a.class_time || ''))
                      const attOpenOn = attOpen === m.id
                      const groups = []
                      for (const b of recs) {
                        const ym = (b.class_date || '').slice(0, 7)
                        let g = groups[groups.length - 1]
                        if (!g || g.ym !== ym) { g = { ym, items: [] }; groups.push(g) }
                        g.items.push(b)
                      }
                      const DOW = ['일', '월', '화', '수', '목', '금', '토']
                      return (
                        <div style={{ marginTop:12 }}>
                          <div onClick={e => { e.stopPropagation(); setAttOpen(attOpenOn ? null : m.id) }}
                            style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'6px 2px' }}>
                            <span style={{ fontSize:11, fontWeight:800, color:'#1c2a24' }}>수업 참석 기록</span>
                            <span style={{ fontSize:10, fontWeight:700, color:'#a2aaa1' }}>{recs.length}</span>
                            <span style={{ flex:1 }}/>
                            <span style={{ fontSize:11, color:'#bcc2ba', transform: attOpenOn ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}>▾</span>
                          </div>
                          {attOpenOn && (recs.length === 0 ? (
                            <div style={{ fontSize:11, color:'#a2aaa1', textAlign:'center', padding:'16px 0', background:'#F8F7F3', borderRadius:12 }}>예약 기록이 없어요 🐾</div>
                          ) : (
                            <div className="no-scrollbar" style={{ display:'flex', flexDirection:'column', gap:12, maxHeight:320, overflowY:'auto' }}>
                              {groups.map(g => {
                                const [gy, gm] = g.ym.split('-')
                                const att = g.items.filter(b => b.attended === true).length
                                return (
                                  <div key={g.ym}>
                                    <div style={{ display:'flex', alignItems:'center', gap:6, margin:'0 2px 6px' }}>
                                      <span style={{ fontSize:11, fontWeight:800, color:'#B5650E', fontVariantNumeric:'tabular-nums' }}>{gy}.{gm}</span>
                                      <span style={{ fontSize:9.5, fontWeight:700, color:'#a2aaa1' }}>출석 {att}/{g.items.length}</span>
                                      <span style={{ flex:1, height:1, background:'rgba(0,0,0,0.05)' }}/>
                                    </div>
                                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                      {g.items.map(b => {
                                        const dt = new Date((b.class_date || '') + 'T00:00:00')
                                        const dow = isNaN(dt.getTime()) ? '' : DOW[dt.getDay()]
                                        const past = (b.class_date || '') < todayStr
                                        const st = b.attended === true ? { t:'출석', c:'#2E7D4F', bg:'#EAF3E4', dot:'#4CA06A' }
                                          : past ? { t:'결석', c:'#94382F', bg:'#F9E9E7', dot:'#C1564D' }
                                          : { t:'예정', c:'#B5650E', bg:'#FBF3E4', dot:'#E8912A' }
                                        return (
                                          <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px', background:'#fff', border:'0.5px solid rgba(0,0,0,0.07)', borderRadius:11 }}>
                                            <span style={{ width:7, height:7, borderRadius:'50%', background:st.dot, flexShrink:0 }}/>
                                            <div style={{ flex:1, minWidth:0 }}>
                                              <div style={{ fontSize:12, fontWeight:800, color:'#1c2a24', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.class_name || '수업'}</div>
                                              <div style={{ fontSize:10, color:'#a2aaa1', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{(b.class_date || '').slice(5).replace('-', '/')}{dow ? ` (${dow})` : ''}{b.class_time ? ` · ${b.class_time.split('~')[0]}` : ''}</div>
                                            </div>
                                            <span style={{ fontSize:10, fontWeight:800, color:st.c, background:st.bg, borderRadius:8, padding:'3px 9px', flexShrink:0 }}>{st.t}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    <div style={{ marginTop:12, borderTop:'1px solid var(--g1)', paddingTop:11 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ flex:1, fontSize:11, fontWeight:700, color:'#a2aaa1' }}>회원 삭제 — 실수 방지 확인</span>
                        <div onClick={e => { e.stopPropagation(); setArmed(armed === m.id ? null : m.id) }}
                          style={{ width:42, height:24, borderRadius:12, background: armed === m.id ? '#c0392b' : '#E4E2D9', position:'relative', cursor:'pointer', transition:'background 0.18s', flexShrink:0 }}>
                          <span style={{ position:'absolute', top:3, left: armed === m.id ? 21 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.25)', transition:'left 0.18s' }}/>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteMember(m) }} disabled={armed !== m.id || deleting === m.id}
                        style={{ width:'100%', marginTop:9, padding:'9px', background: armed === m.id ? '#c0392b' : '#f2efec', color: armed === m.id ? '#fff' : '#bcbcbc', border:'none', borderRadius:11, fontSize:11, fontWeight:800, cursor: (armed === m.id && deleting !== m.id) ? 'pointer' : 'default', opacity: deleting === m.id ? 0.6 : 1, fontFamily:'Nunito,sans-serif' }}>
                        {deleting === m.id ? '삭제 중…' : armed === m.id ? '🗑 정말 삭제하기' : '삭제하려면 확인을 켜세요'}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* ── 참여작가 (하단 별도 목록) — 수확 작물 부여 / 모든 기능 해금 ── */}
        {artistList.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, margin:'0 3px 9px' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#B5650E' }}/>
              <span style={{ fontSize:11, fontWeight:800, color:'#B5650E', letterSpacing:'0.2px' }}>참여작가</span>
              <span style={{ fontSize:10, fontWeight:700, color:'#bcc2ba' }}>{artistList.length}</span>
              <span style={{ flex:1, height:1, background:'rgba(0,0,0,0.05)' }}/>
            </div>
            {artistList.map(a => {
              const on = memberUnlockAll[a.id] === true
              const hv = harvestMap[a.id] || 0
              const isOpen = expanded === a.id
              return (
                <div key={a.id} style={{ border:'0.5px solid rgba(0,0,0,0.06)', borderRadius:16, marginBottom:7, background:'#fff', overflow:'hidden' }}>
                  <div onClick={() => setExpanded(isOpen ? null : a.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 13px', cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#FBEFE7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#B5650E', flexShrink:0 }}>{a.name?.[0] || '?'}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13.5, fontWeight:800, color:'#1c2a24', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name || '작가'}</div>
                      <div style={{ fontSize:11, color:'#a2aaa1', fontWeight:600 }}>{a.phone || a.email || '전시 작가'}</div>
                    </div>
                    <span style={{ fontSize:9, fontWeight:800, color:'#B5650E', background:'#FBEFE7', borderRadius:8, padding:'3px 8px', flexShrink:0 }}>작가</span>
                    <span style={{ fontSize:12, color:'#bcc2ba', flexShrink:0, transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}>▾</span>
                  </div>

                  {isOpen && (
                  <div style={{ padding:'0 13px 12px' }}>
                    {/* 수확 작물 부여 */}
                    <div style={{ background:'#F6F5F1', borderRadius:13, padding:'11px 12px', marginBottom:9, display:'flex', alignItems:'center', gap:9 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:'#1c2a24' }}>🌾 수확 작물 {hv}개</div>
                        <div style={{ fontSize:10, color:'#a2aaa1', fontWeight:600, marginTop:2 }}>수확 개수로 테마·냥이가 열려요</div>
                      </div>
                      <button onClick={() => setHarvestCount(a.id, hv - 1)} disabled={hv <= 0}
                        style={{ width:30, height:30, borderRadius:9, border:'none', background:'#EDEBE4', color:'#6a6a5a', fontSize:15, fontWeight:800, cursor: hv <= 0 ? 'default' : 'pointer', opacity: hv <= 0 ? 0.4 : 1, fontFamily:'Nunito,sans-serif' }}>−</button>
                      <button onClick={() => setHarvestCount(a.id, hv + 1)}
                        style={{ width:30, height:30, borderRadius:9, border:'none', background:'var(--acBg)', color:'var(--acTx)', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>+</button>
                      <button onClick={() => setHarvestCount(a.id, hv + 5)}
                        style={{ height:30, padding:'0 11px', borderRadius:9, border:'none', background:'var(--ac)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif', whiteSpace:'nowrap' }}>+5</button>
                    </div>

                    {/* 모든 기능 해금 (냥 꾸미기·테마 전체) */}
                    <div style={{ background:'#FBFAF5', border:'0.5px solid rgba(0,0,0,0.07)', borderRadius:13, padding:'11px 12px', display:'flex', alignItems:'center', gap:11 }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{on ? '🔓' : '🔒'}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:'#1c2a24' }}>모든 기능 해금</div>
                        <div style={{ fontSize:10, color:'#a2aaa1', fontWeight:600, marginTop:2, lineHeight:1.5 }}>{on ? '수확 없이 테마·프로필냥·농부냥 전부 사용' : '켜면 수확 없이 전부 열려요'}</div>
                      </div>
                      <div onClick={() => toggleUnlockAll(a.id, !on)}
                        style={{ width:46, height:27, borderRadius:14, background: on ? 'var(--ac)' : '#E4E2D9', position:'relative', cursor:'pointer', transition:'background 0.18s ease', flexShrink:0 }}>
                        <span style={{ position:'absolute', top:3, left: on ? 22 : 3, width:21, height:21, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.25)', transition:'left 0.18s ease' }}/>
                      </div>
                    </div>

                    <div style={{ marginTop:9, borderTop:'1px solid var(--g1)', paddingTop:11 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ flex:1, fontSize:11, fontWeight:700, color:'#a2aaa1' }}>작가 삭제 — 실수 방지 확인</span>
                        <div onClick={() => setArmed(armed === a.id ? null : a.id)}
                          style={{ width:42, height:24, borderRadius:12, background: armed === a.id ? '#c0392b' : '#E4E2D9', position:'relative', cursor:'pointer', transition:'background 0.18s', flexShrink:0 }}>
                          <span style={{ position:'absolute', top:3, left: armed === a.id ? 21 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.25)', transition:'left 0.18s' }}/>
                        </div>
                      </div>
                      <button onClick={() => deleteMember(a)} disabled={armed !== a.id || deleting === a.id}
                        style={{ width:'100%', marginTop:9, padding:'9px', background: armed === a.id ? '#c0392b' : '#f2efec', color: armed === a.id ? '#fff' : '#bcbcbc', border:'none', borderRadius:11, fontSize:11, fontWeight:800, cursor: (armed === a.id && deleting !== a.id) ? 'pointer' : 'default', opacity: deleting === a.id ? 0.6 : 1, fontFamily:'Nunito,sans-serif' }}>
                        {deleting === a.id ? '삭제 중…' : armed === a.id ? '🗑 정말 삭제하기' : '삭제하려면 확인을 켜세요'}
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AdminNav active="member" />
    </>
  )
}
