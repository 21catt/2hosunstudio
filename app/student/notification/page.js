'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import ProfileHeaderIcon from '../../../components/ProfileHeaderIcon'
import LoadingCat from '../../../components/LoadingCat'

export default function StudentNotificationPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState(0)
  const [bookings, setBookings] = useState([])
  const [doneClasses, setDoneClasses] = useState([])
  const [loading, setLoading] = useState(true)
 const [notifs, setNotifs] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    const today = new Date().toISOString().split('T')[0]
    const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
    // 예약(예정)·수업 종료(과거)·3주 지난 알림 삭제를 병렬 발사 — 서로 독립. 알림 목록은 삭제 완료 후 조회
    const [{ data: b }, { data: d }] = await Promise.all([
      supabase.from('bookings').select('*').eq('user_id', userId).eq('status', 'booked').gte('class_date', today).order('class_date', { ascending: true }),
      supabase.from('bookings').select('*').eq('user_id', userId).lt('class_date', today).order('class_date', { ascending: false }),
      // 3주 지난 알림은 자동 삭제 (내 알림만)
      supabase.from('notifications').delete().eq('user_id', userId).lt('created_at', cutoff),
    ])
    setBookings(b || [])
    setDoneClasses(d || [])

    const { data: n } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs(n || [])
    setLoading(false)

    // 읽음 처리는 렌더 이후 백그라운드로 — 초기 로딩을 막지 않음(뱃지는 다음 로드에 반영)
    const unread = (n || []).filter(x => !x.is_read).map(x => x.id)
    if (unread.length > 0) {
      supabase.from('notifications').update({ is_read: true }).in('id', unread).then(() => {})
    }
  }

  async function handleCancel(booking) {
  const classDateTime = new Date(`${booking.class_date}T${booking.class_time?.split('~')[0]}`)
  const diff = (classDateTime - new Date()) / (1000*60*60)
  if (diff < 4) { alert('수업 4시간 전에는 취소할 수 없어요'); return }
  if (!confirm('예약을 취소할까요?')) return
  
  // 강사 id 찾기
  const { data: course } = await supabase.from('class_courses').select('teacher_id').eq('id', booking.course_id).single()
  
  await supabase.from('bookings').delete().eq('id', booking.id)
  const { data: ticket } = await supabase.from('tickets').select('*').eq('user_id', user.id).single()
  if (ticket) await supabase.from('tickets').update({ remain: ticket.remain+1 }).eq('id', ticket.id)
  
  // 강사에게 취소 알림
  const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
  if (course?.teacher_id) {
    await supabase.from('notifications').insert({
      user_id: course.teacher_id,
      type: 'booking_cancelled',
      title: '예약 취소',
      body: `${profile?.name || '학생'}님이 ${booking.class_name} ${booking.class_date} ${booking.class_time} 취소`
    })
  }
  
  loadData(user.id)
}

  const attended = doneClasses.filter(d => d.status === 'attended').length
  const absent = doneClasses.filter(d => d.status === 'absent').length

  if (loading) return <LoadingCat />

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="bell" color="var(--ac)" size={20} />
          <span className="p-title">알림</span>
        </div>
        <ProfileHeaderIcon />
      </div>

      <div style={{ background:'#fff', padding:'8px 14px 80px' }}>
        {/* 탭 */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--g1)', marginBottom:14 }}>
          {['내 예약 현황','수업 종료 현황'].map((t,i) => (
            <div key={t} onClick={() => setTab(i)}
              style={{ flex:1, textAlign:'center', padding:'9px 0', fontSize:12, fontWeight:700,
                color:tab===i?'var(--g4)':'var(--tmu)', cursor:'pointer',
                borderBottom:tab===i?'2.5px solid var(--g4)':'2.5px solid transparent',
                marginBottom:-2 }}>
              {t}
            </div>
          ))}
        </div>
{/* 알림 메시지 */}
        {notifs.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:10 }}>최근 알림</div>
            {notifs.slice(0, 5).map(n => (
              <div key={n.id} style={{
                background: n.type === 'meeting_confirmed' ? '#FFF8E1' : 'var(--bg)',
                borderRadius:12, padding:'10px 12px', marginBottom:6,
                border:`1.5px solid ${n.type === 'meeting_confirmed' ? '#FFE082' : 'var(--g1)'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--td)' }}>{n.title}</span>
                  <span style={{ fontSize:9, color:'var(--tmu)' }}>
                    {new Date(n.created_at).toLocaleDateString('ko-KR', { month:'numeric', day:'numeric' })}
                  </span>
                </div>
                <div style={{ fontSize:10, color:'var(--tm)', lineHeight:1.5 }}>{n.body}</div>
              </div>
            ))}
          </div>
        )}
        {/* 내 예약 현황 */}
        {tab === 0 && (
          <>
            <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:12, fontWeight:600 }}>
              예약 확정된 수업이에요
            </div>
            {bookings.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>
                예약된 수업이 없어요 🐾
              </div>
            ) : bookings.map(b => (
              <div key={b.id} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 14px',
                marginBottom:8, border:'1.5px solid var(--g1)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--td)' }}>{b.class_date}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:8,
                    background:'var(--g1)', color:'var(--g5)' }}>예약확정</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--g3)', flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{b.class_name}</div>
                    <div style={{ fontSize:10, color:'var(--tmu)' }}>{b.class_time} · 강사 {b.teacher}</div>
                  </div>
                </div>
                <div style={{ borderTop:'1px solid var(--g1)', paddingTop:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:10, color:'#c0392b', fontWeight:600 }}>
                    수업 4시간 전까지 취소 가능
                  </span>
                  <button onClick={() => handleCancel(b)}
                    style={{ fontSize:10, padding:'4px 12px', borderRadius:20,
                      background:'var(--g1)', color:'var(--tm)', border:'none',
                      cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                    예약취소
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* 수업 종료 현황 */}
        {tab === 1 && (
          <>
            {/* 통계 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
              {[
                { label:'총 수업', val:`${doneClasses.length}회`, color:'var(--td)' },
                { label:'출석', val:`${attended}회`, color:'var(--g4)' },
                { label:'결석', val:`${absent}회`, color:'#c0392b' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--bg)', borderRadius:12, padding:'10px', textAlign:'center', border:'1.5px solid var(--g1)' }}>
                  <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10, fontWeight:600 }}>
              종료된 수업 이력이에요
            </div>

            {doneClasses.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>
                종료된 수업이 없어요 🐾
              </div>
            ) : doneClasses.map(b => (
              <div key={b.id} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 14px',
                marginBottom:8, border:'1.5px solid var(--g1)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--td)' }}>{b.class_date}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:8,
                    background:b.status==='attended'?'#e8f5e0':'#ffebee',
                    color:b.status==='attended'?'var(--g5)':'#c0392b' }}>
                    {b.status==='attended'?'✓ 출석':'✗ 결석'}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--g3)', flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--td)' }}>{b.class_name}</div>
                    <div style={{ fontSize:10, color:'var(--tmu)' }}>{b.class_time} · 강사 {b.teacher}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <StudentNav active="notification" />
    </>
  )
}