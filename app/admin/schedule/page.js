'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminSchedulePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState(0)
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [adminCats, setAdminCats] = useState([])

  // 새 수업 슬롯 추가
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState('drawing')
  const [newDow, setNewDow] = useState(2)
  const [newTime, setNewTime] = useState('')
  const [newMax, setNewMax] = useState(5)

  const DAYS = ['일','월','화','수','목','금','토']
  const CATS = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작' }
  const EMOJI = { drawing:'✏️', painting:'🎨', sculpture:'🗿', free:'🖼️' }
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
    const { data: s } = await supabase.from('class_slots').select('*').eq('is_active', true).order('day_of_week')
    setSlots(s || [])
    // 오늘 이후 예약
    const { data: b } = await supabase
      .from('bookings')
      .select('*, users(name)')
      .gte('class_date', today)
      .order('class_date')
    setBookings(b || [])
    setLoading(false)
  }

  async function addSlot() {
    if (!newName || !newTime) return
    await supabase.from('class_slots').insert({
      name: newName, category: newCat, day_of_week: newDow,
      time: newTime, teacher: user.user_metadata?.name || '강사',
      max_count: newMax, current_count: 0, is_active: true
    })
    setShowAdd(false)
    setNewName(''); setNewTime('')
    loadData()
  }

  async function toggleSlot(id, active) {
    await supabase.from('class_slots').update({ is_active: !active }).eq('id', id)
    loadData()
  }

  async function markAttendance(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId)
    loadData()
  }

  // 담당 수업만 필터
  const mySlots = slots.filter(s => adminCats.includes(s.category))
  const myBookings = bookings.filter(b => {
    const slot = slots.find(s => s.id === b.class_slot_id)
    return slot && adminCats.includes(slot.category)
  })

  // 날짜별 그룹
  const grouped = myBookings.reduce((acc, b) => {
    if (!acc[b.class_date]) acc[b.class_date] = []
    acc[b.class_date].push(b)
    return acc
  }, {})

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>📅</span>
          <span className="header-title">수업 현황</span>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 12px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>
          + 수업 추가
        </button>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>

        {/* 수업 추가 폼 */}
        {showAdd && (
          <div style={{ background:'var(--g1)', borderRadius:16, padding:'14px', marginBottom:14, border:'1.5px solid var(--g2)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>새 수업 등록</div>
            <div className="field">
              <label>수업 이름</label>
              <input placeholder="예: 드로잉 기초" value={newName} onChange={e=>setNewName(e.target.value)}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="field">
                <label>카테고리</label>
                <select value={newCat} onChange={e=>setNewCat(e.target.value)}>
                  {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field">
                <label>요일</label>
                <select value={newDow} onChange={e=>setNewDow(Number(e.target.value))}>
                  {DAYS.map((d,i)=>i!==1&&<option key={i} value={i}>{d}요일</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="field">
                <label>시간</label>
                <input placeholder="예: 14:00~16:00" value={newTime} onChange={e=>setNewTime(e.target.value)}/>
              </div>
              <div className="field">
                <label>정원</label>
                <input type="number" value={newMax} onChange={e=>setNewMax(Number(e.target.value))} min={1} max={10}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-primary" onClick={addSlot}>등록</button>
              <button className="btn-secondary" style={{ marginTop:0 }} onClick={()=>setShowAdd(false)}>취소</button>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--g1)', marginBottom:14 }}>
          {['수업 목록','예약 현황'].map((t,i) => (
            <div key={t} onClick={() => setTab(i)}
              style={{ flex:1, textAlign:'center', padding:'9px 0', fontSize:12, fontWeight:700,
                color:tab===i?'var(--g4)':'var(--tmu)', cursor:'pointer',
                borderBottom:tab===i?'2.5px solid var(--g4)':'2.5px solid transparent', marginBottom:-2 }}>
              {t}
            </div>
          ))}
        </div>

        {/* 수업 목록 */}
        {tab === 0 && (
          <>
            {mySlots.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>
                등록된 수업이 없어요 🐾<br/>
                <span style={{ fontSize:11 }}>우측 상단 + 수업 추가로 등록해봐요</span>
              </div>
            ) : mySlots.map(s => (
              <div key={s.id} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 14px',
                marginBottom:8, border:'1.5px solid var(--g1)', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'var(--g1)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  {EMOJI[s.category]||'🎨'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:2 }}>{s.name}</div>
                  <div style={{ fontSize:10, color:'var(--tmu)' }}>{DAYS[s.day_of_week]}요일 · {s.time}</div>
                  <div style={{ fontSize:10, color:'var(--tm)', fontWeight:600 }}>정원 {s.max_count}명</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                  <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:8,
                    background:s.is_active?'var(--g1)':'#ffebee',
                    color:s.is_active?'var(--g5)':'#c0392b' }}>
                    {s.is_active?'운영중':'중단'}
                  </span>
                  <button onClick={() => toggleSlot(s.id, s.is_active)}
                    style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'1px solid var(--g2)',
                      background:'var(--surf)', color:'var(--tm)', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                    {s.is_active?'중단':'재개'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* 예약 현황 */}
        {tab === 1 && (
          <>
            {Object.keys(grouped).length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>예약된 수업이 없어요 🐾</div>
            ) : Object.entries(grouped).map(([date, bks]) => (
              <div key={date} style={{ background:'var(--bg)', borderRadius:14, border:'1.5px solid var(--g1)', marginBottom:10, overflow:'hidden' }}>
                <div onClick={() => setExpanded(expanded===date?null:date)}
                  style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>{date}</div>
                    <div style={{ fontSize:10, color:'var(--tmu)' }}>예약 {bks.length}명</div>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <nav className="bottom-nav">
        {[
          { href:'/admin', label:'회원', icon:'👥' },
          { href:'/admin/schedule', label:'수업현황', icon:'📅', active:true },
          { href:'/admin/notification', label:'알림', icon:'🔔' },
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