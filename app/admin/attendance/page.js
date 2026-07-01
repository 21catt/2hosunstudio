'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { HEADER_BG, PRIMARY, T, OK } from '../../../lib/adminTheme'

const DOW = ['일','월','화','수','목','금','토']

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function AdminAttendancePage() {
  const router = useRouter()
  const [user,        setUser]        = useState(null)
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [bookings,    setBookings]    = useState([])
  const [userNames,   setUserNames]   = useState({})
  const [loading,     setLoading]     = useState(true)
  const [toggling,    setToggling]    = useState({})

  async function load(date) {
    setLoading(true)
    const { data: bks } = await supabase
      .from('bookings')
      .select('id, user_id, class_name, class_time, attended, attended_at, status')
      .eq('class_date', date)
      .neq('status', 'cancelled')
      .order('class_time')

    const list = bks || []
    setBookings(list)

    const ids = [...new Set(list.map(b => b.user_id))]
    if (ids.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids)
      const map = {}
      ;(users || []).forEach(u => { map[u.id] = u.name })
      setUserNames(map)
    } else {
      setUserNames({})
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
    })
  }, [])

  useEffect(() => {
    if (user) load(selectedDate)
  }, [user, selectedDate])

  async function toggleAttended(b) {
    const next = !b.attended
    setToggling(prev => ({ ...prev, [b.id]: true }))
    const update = { attended: next, attended_at: next ? new Date().toISOString() : null }
    await supabase.from('bookings').update(update).eq('id', b.id)
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...update } : x))
    setToggling(prev => { const n = { ...prev }; delete n[b.id]; return n })
  }

  async function markAllAttended(grp) {
    const pending = grp.filter(b => !b.attended)
    if (!pending.length) return
    const now = new Date().toISOString()
    await Promise.all(pending.map(b =>
      supabase.from('bookings').update({ attended: true, attended_at: now }).eq('id', b.id)
    ))
    setBookings(prev => prev.map(b =>
      pending.some(p => p.id === b.id) ? { ...b, attended: true, attended_at: now } : b
    ))
  }

  function shift(delta) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(toDateStr(d))
  }

  // Group by class_name + class_time, preserve time order
  const groupMap = new Map()
  for (const b of bookings) {
    const key = `${b.class_time || ''}||${b.class_name || ''}`
    if (!groupMap.has(key)) groupMap.set(key, { class_name: b.class_name, class_time: b.class_time, items: [] })
    groupMap.get(key).items.push(b)
  }
  const groups = [...groupMap.values()].sort((a, b) => (a.class_time || '').localeCompare(b.class_time || ''))

  const d = new Date(selectedDate + 'T00:00:00')
  const todayStr = toDateStr(new Date())
  const isToday = selectedDate === todayStr
  const dateLabel = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}(${DOW[d.getDay()]})`

  if (!user) return null

  return (
    <>
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>✅</span>
          <span className="header-title">출석 체크</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px', minHeight:'80vh' }}>

        {/* Date nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:18, marginBottom:20 }}>
          <button onClick={() => shift(-1)}
            style={{ width:36, height:36, borderRadius:'50%', background: T.navBg, border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#5c6b5f', fontFamily:'Nunito,sans-serif' }}>
            ‹
          </button>
          <div style={{ textAlign:'center', minWidth:96 }}>
            <div style={{ fontSize:16, fontWeight:800, color: T.text }}>{dateLabel}</div>
            {isToday && <div style={{ fontSize:10, color: OK.main, fontWeight:700, marginTop:1 }}>오늘</div>}
          </div>
          <button onClick={() => shift(1)}
            style={{ width:36, height:36, borderRadius:'50%', background: T.navBg, border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#5c6b5f', fontFamily:'Nunito,sans-serif' }}>
            ›
          </button>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
            <span style={{ fontSize:30 }}>🐱</span>
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign:'center', padding:56, color: T.mut, fontSize:13 }}>
            이 날 예약이 없어요 🐾
          </div>
        ) : (
          groups.map(({ class_name, class_time, items: grp }) => {
            const key = `${class_time}||${class_name}`
            const attendedCnt = grp.filter(b => b.attended).length
            const allDone = attendedCnt === grp.length

            return (
              <div key={key} style={{ marginBottom:22 }}>
                {/* Group header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, padding:'0 2px' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color: T.text, letterSpacing:'-0.2px' }}>{class_name}</div>
                    <div style={{ fontSize:11, color: T.mut, marginTop:1 }}>
                      {class_time} &nbsp;·&nbsp;
                      <span style={{ color: attendedCnt > 0 ? OK.tx : T.mut, fontWeight:700 }}>
                        {attendedCnt}/{grp.length}명 출석
                      </span>
                    </div>
                  </div>
                  <button onClick={() => markAllAttended(grp)} disabled={allDone}
                    style={{ padding:'7px 14px', background: allDone ? T.navBg : PRIMARY, color: allDone ? T.mut : '#fff', border:'none', borderRadius:11, fontSize:11, fontWeight:700, cursor: allDone ? 'default' : 'pointer', fontFamily:'Nunito,sans-serif', opacity: allDone ? 0.7 : 1 }}>
                    {allDone ? '전원 ✓' : '전원 출석'}
                  </button>
                </div>

                {/* Student rows */}
                <div style={{ borderRadius:16, border:`0.5px solid ${T.card}`, overflow:'hidden', background:'#fff' }}>
                  {grp.map((b, idx) => {
                    const name = userNames[b.user_id] || '학생'
                    const attended = !!b.attended
                    const busy = !!toggling[b.id]

                    return (
                      <div key={b.id} onClick={() => !busy && toggleAttended(b)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', cursor:'pointer', background: attended ? '#F1F8EC' : '#fff', borderTop: idx === 0 ? 'none' : `0.5px solid ${T.line}`, opacity: busy ? 0.55 : 1, transition:'background 0.12s' }}>

                        {/* Avatar */}
                        <div style={{ width:38, height:38, borderRadius:'50%', background: attended ? OK.soft : T.navBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color: attended ? OK.tx : T.mut, flexShrink:0, transition:'all 0.12s' }}>
                          {name[0] || '?'}
                        </div>

                        {/* Name */}
                        <div style={{ flex:1, fontSize:14, fontWeight:700, color: attended ? OK.tx : T.text }}>
                          {name}
                        </div>

                        {/* Toggle circle */}
                        <div style={{ width:34, height:34, borderRadius:'50%', background: attended ? OK.main : '#fff', border: `2px solid ${attended ? OK.main : 'rgba(0,0,0,0.12)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                          {attended
                            ? <span style={{ color:'#fff', fontSize:17, lineHeight:1 }}>✓</span>
                            : <div style={{ width:11, height:11, borderRadius:'50%', background:'#d5d3ca' }}/>
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      <AdminNav active="attendance" />
    </>
  )
}
