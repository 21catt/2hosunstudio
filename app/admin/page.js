'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [members, setMembers] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadMembers()
    })
  }, [])

  async function loadMembers() {
    const { data } = await supabase
      .from('users')
      .select('*, tickets(*), bookings(*)')
      .eq('role', 'student')
    setMembers(data || [])
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
  const newRemain = currentRemain + delta
  if (newRemain < 0) { alert('잔여 횟수가 0보다 작아질 수 없어요'); return }
  await supabase.from('tickets').update({ remain: newRemain }).eq('id', ticketId)
  loadMembers()
}
  const filtered = members.filter(m =>
    !search || m.name?.includes(search) || m.phone?.includes(search)
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <div className="header" style={{ flexDirection:'column', gap:10, paddingBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>✏️</span>
            <span className="header-title">회원 관리</span>
          </div>
          <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
            로그아웃
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'8px 14px', width:'100%' }}>
          <span style={{ color:'rgba(255,255,255,0.8)', fontSize:14 }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="이름 또는 휴대폰 번호 검색"
            style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:12, fontFamily:'Nunito,sans-serif', fontWeight:600, width:'100%' }}/>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--g4)', marginBottom:12 }}>총 {filtered.length}명</div>

        {filtered.map(m => {
          const ticket = m.tickets?.[0]
          const isExp = expanded === m.id
          const daysLeft = ticket ? Math.ceil((new Date(ticket.expires_at)-new Date())/(1000*60*60*24)) : 0
          const status = !ticket||ticket.remain===0||daysLeft<0 ? '만료' : daysLeft<=7 ? '만료임박' : '수강중'
          const stColor = {'수강중':'var(--g4)','만료임박':'#E65100','만료':'#C62828'}[status]
          const stBg = {'수강중':'var(--g1)','만료임박':'#FFF3E0','만료':'#FFEBEE'}[status]

          return (
            <div key={m.id} onClick={()=>setExpanded(isExp?null:m.id)}
              style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${isExp?'var(--g3)':'var(--g1)'}`,
                padding:14, marginBottom:10, cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--g2)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:800, color:'var(--g5)', flexShrink:0 }}>
                  {m.name?.[0]}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>{m.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, background:stBg, color:stColor }}>{status}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--tmu)' }}>{m.phone}</div>
                  {ticket && (
                    <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ flex:1, height:5, background:'#e0f0d8', borderRadius:5, overflow:'hidden' }}>
                        <div style={{ width:`${Math.round((ticket.remain/ticket.total)*100)}%`, height:'100%',
                          background:ticket.remain<=1?'#ef5350':'var(--g3)', borderRadius:5 }}/>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, color:'var(--tm)' }}>{ticket.remain}/{ticket.total}회</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:daysLeft<0?'#C62828':daysLeft<=7?'#E65100':'var(--tmu)' }}>
                  {daysLeft<0?'만료됨':`${daysLeft}일 남음`}
                </div>
              </div>

              {isExp && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--g1)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수강권 부여</div>
                  <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                    {[[3,28,'4주 3회'],[4,30,'4회권'],[7,56,'8주 7회'],[8,60,'8회권'],[12,90,'12회권']].map(([total,days,label])=>(
                      <button key={label}
                        onClick={e=>{e.stopPropagation();grantTicket(m.id,label,total,days)}}
                        style={{ flex:1, padding:'8px 4px', background:'var(--g4)', color:'#fff',
                          border:'none', borderRadius:10, fontSize:10, fontWeight:700,
                          cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {ticket && (
  <div style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center' }}>
    <span style={{ fontSize:10, fontWeight:700, color:'var(--tm)', flex:1 }}>잔여 조정</span>
    <button onClick={e=>{e.stopPropagation();adjustTicket(ticket.id,ticket.remain,-1)}}
      style={{ padding:'6px 12px', background:'#ffebee', color:'#c0392b',
        border:'none', borderRadius:10, fontSize:11, fontWeight:700,
        cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
      −1
    </button>
    <button onClick={e=>{e.stopPropagation();adjustTicket(ticket.id,ticket.remain,1)}}
      style={{ padding:'6px 12px', background:'var(--g1)', color:'var(--g5)',
        border:'none', borderRadius:10, fontSize:11, fontWeight:700,
        cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
      +1
    </button>
  </div>
)}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    <div style={{ background:'var(--bg)', borderRadius:10, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:2 }}>총 예약</div>
                      <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>{m.bookings?.length||0}회</div>
                    </div>
                    <div style={{ background:'var(--bg)', borderRadius:10, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:2 }}>출석</div>
                      <div style={{ fontSize:13, fontWeight:800, color:'var(--g4)' }}>
                        {m.bookings?.filter(b=>b.status==='attended').length||0}회
                      </div>
                    </div>
                    <div style={{ background:'var(--bg)', borderRadius:10, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:2 }}>결석</div>
                      <div style={{ fontSize:13, fontWeight:800, color:'#c0392b' }}>
                        {m.bookings?.filter(b=>b.status==='absent').length||0}회
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <nav className="bottom-nav">
        {[
          { href:'/admin', label:'회원', icon:'👥', active:true },
          { href:'/admin/schedule', label:'수업현황', icon:'📅' },
          { href:'/admin/notification', label:'알림', icon:'🔔' },
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