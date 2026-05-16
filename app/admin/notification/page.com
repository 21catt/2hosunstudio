'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminNotificationPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState(0)
  const [bookings, setBookings] = useState([])
  const [slots, setSlots] = useState([])
  const [members, setMembers] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adminCats, setAdminCats] = useState([])

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      setAdminCats(data.user.user_metadata?.categories || [])
      loadData()
    })
  }, [])

  async function loadData() {
    const { data: s } = await supabase.from('class_slots').select('*')
    setSlots(s || [])
    const { data: b } = await supabase
      .from('bookings')
      .select('*, users(name, phone)')
      .order('created_at', { ascending: false })
    setBookings(b || [])
    const { data: m } = await supabase
      .from('users')
      .select('*, tickets(*)')
      .eq('role', 'student')
    setMembers(m || [])
    setLoading(false)
  }

  async function markAttendance(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId)
    loadData()
  }

  // 담당 수업 필터
  const mySlots = slots.filter(s => adminCats.includes(s.category))
  const mySlotIds = mySlots.map(s => s.id)
  const myBookings = bookings.filter(b => mySlotIds.includes(b.class_slot_id))

  // 오늘 이후 예약
  const upcomingBookings = myBookings.filter(b => b.class_date >= today)
  // 오늘 이전 종료
  const doneBookings = myBookings.filter(b => b.class_date < today)

  // 날짜별 그룹
  function groupByDate(bks) {
    return bks.reduce((acc, b) => {
      if (!acc[b.class_date]) acc[b.class_date] = []
      acc[b.class_date].push(b)
      return acc
    }, {})
  }

  // 만료 임박 수강생
  const expiringSoon = members.filter(m => {
    const t = m.tickets?.[0]
    if (!t) return false
    const days = Math.ceil((new Date(t.expires_at) - new Date()) / (1000*60*60*24))
    return days >= 0 && days <= 7
  })

  const upcomingGrouped = groupByDate(upcomingBookings)
  const doneGrouped = groupByDate(doneBookings)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  function BookingGroup({ grouped, showAttendance }) {
    return Object.keys(grouped).length === 0 ? (
      <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>해당 내역이 없어요 🐾</div>
    ) : Object.entries(grouped).map(([date, bks]) => (
      <div key={date} style={{ background:'var(--bg)', borderRadius:14, border:'1.5px solid var(--g1)', marginBottom:10, overflow:'hidden' }}>
        <div onClick={() => setExpanded(expanded===date?null:date)}
          style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>{date}</div>
            <div style={{ fontSize:10, color:'var(--tmu)' }}>
              {bks.length}명 · 출석 {bks.filter(b=>b.status==='attended').length} / 결석 {bks.filter(b=>b.status==='absent').length}
            </div>
          </div>
          <span style={{ fontSize:16, color:'var(--tmu)' }}>{expanded===date?'▲':'▼'}</span>
        </div>
        {expanded === date && (
          <div style={{ borderTop:'1px solid var(--g1)', padding:'10px 14px' }}>
            {bks.map(b => (
              <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--g1)' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--g2)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:800, color:'var(--g5)', flexShrink:0 }}>
                  {b.users?.name?.[0]||'?'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--td)' }}>{b.users?.name||'수강생'}</div>
                  <div style={{ fontSize:10, color:'var(--tmu)' }}>{b.class_name} · {b.class_time}</div>
                </div>
                {showAttendance ? (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => markAttendance(b.id,'attended')}
                      style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'none',
                        background:b.status==='attended'?'var(--g4)':'var(--g1)',
                        color:b.status==='attended'?'#fff':'var(--g5)',
                        cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                      출석
                    </button>
                    <button onClick={() => markAttendance(b.id,'absent')}
                      style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'none',
                        background:b.status==='absent'?'#c0392b':'#ffebee',
                        color:b.status==='absent'?'#fff':'#c0392b',
                        cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                      결석
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:8,
                    background:b.status==='attended'?'#e8f5e0':b.status==='absent'?'#ffebee':'var(--g1)',
                    color:b.status==='attended'?'var(--g5)':b.status==='absent'?'#c0392b':'var(--tmu)' }}>
                    {b.status==='attended'?'✓ 출석':b.status==='absent'?'✗ 결석':'예약'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    ))
  }

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>🔔</span>
          <span className="header-title">알림</span>
        </div>
        {expiringSoon.length > 0 && (
          <span style={{ background:'#c0392b', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>
            만료임박 {expiringSoon.length}명
          </span>
        )}
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>

        {/* 만료 임박 알림 */}
        {expiringSoon.length > 0 && (
          <div style={{ background:'#FFF3E0', borderRadius:14, padding:'12px 14px', marginBottom:14, border:'1.5px solid #FFE0B2' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#E65100', marginBottom:8 }}>⚠️ 수강권 만료 임박</div>
            {expiringSoon.map(m => {
              const t = m.tickets?.[0]
              const days = Math.ceil((new Date(t.expires_at) - new Date()) / (1000*60*60*24))
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #FFE0B2' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--td)' }}>{m.name}</div>
                  <div style={{ fontSize:10, color:'#E65100', fontWeight:700 }}>{days}일 남음 · {t.remain}회 잔여</div>
                </div>
              )
            })}
          </div>
        )}

        {/* 탭 */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--g1)', marginBottom:14 }}>
          {['예약 현황','수업 종료 현황'].map((t,i) => (
            <div key={t} onClick={() => { setTab(i); setExpanded(null) }}
              style={{ flex:1, textAlign:'center', padding:'9px 0', fontSize:12, fontWeight:700,
                color:tab===i?'var(--g4)':'var(--tmu)', cursor:'pointer',
                borderBottom:tab===i?'2.5px solid var(--g4)':'2.5px solid transparent', marginBottom:-2 }}>
              {t}
            </div>
          ))}
        </div>

        {tab === 0 && <BookingGroup grouped={upcomingGrouped} showAttendance={false}/>}
        {tab === 1 && <BookingGroup grouped={doneGrouped} showAttendance={true}/>}
      </div>

      <nav className="bottom-nav">
        {[
          { href:'/admin', label:'회원', icon:'👥' },
          { href:'/admin/schedule', label:'수업현황', icon:'📅' },
          { href:'/admin/notification', label:'알림', icon:'🔔', active:true },
          { href:'/lounge', label:'라운지', icon:'💬' },
        ].map(t => (
          <a key={t.label} href={t.href} className={`nav-item ${t.active?'active':''}`}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  )
}