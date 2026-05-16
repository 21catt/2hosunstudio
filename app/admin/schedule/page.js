'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const DAYS = ['일','월','화','수','목','금','토']
const CATS = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작' }
const EMOJI = { drawing:'✏️', painting:'🎨', sculpture:'🗿', free:'🖼️' }
const DEFAULT_SLOTS = [
  { start:'10:00', end:'12:00' },
  { start:'12:00', end:'14:00' },
  { start:'14:00', end:'16:00' },
  { start:'16:00', end:'18:00' },
  { start:'18:00', end:'20:00' },
  { start:'19:00', end:'21:00' },
]

function CourseForm({ initial, onSave, onCancel, teacherName, teacherId }) {
  const [name, setName] = useState(initial?.name || '')
  const [cat, setCat] = useState(initial?.category || 'drawing')
  const [maxCount, setMaxCount] = useState(initial?.max_count || 5)
  const [isUnlimited, setIsUnlimited] = useState(initial?.is_unlimited ?? true)
  const [startDate, setStartDate] = useState(initial?.start_date || '')
  const [endDate, setEndDate] = useState(initial?.end_date || '')
  const [selectedDays, setSelectedDays] = useState(initial?.schedules?.map(s => s.day_of_week) || [])
  const [timeSlots, setTimeSlots] = useState(initial?.schedules?.length > 0
    ? initial.schedules.map(s => ({ start: s.start_time, end: s.end_time, selected: true }))
    : DEFAULT_SLOTS.map(s => ({ ...s, selected: false }))
  )
  const [exceptions, setExceptions] = useState(initial?.exceptions || [])
  const [newExcDay, setNewExcDay] = useState(2)
  const [newExcStart, setNewExcStart] = useState('')
  const [newExcEnd, setNewExcEnd] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleDay(d) {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function toggleSlot(i) {
    setTimeSlots(prev => prev.map((s, idx) => idx === i ? { ...s, selected: !s.selected } : s))
  }

  function updateSlotTime(i, field, val) {
    setTimeSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }

  function addException() {
    if (!newExcStart || !newExcEnd) return
    setExceptions(prev => [...prev, { day_of_week: newExcDay, start_time: newExcStart, end_time: newExcEnd }])
    setNewExcStart(''); setNewExcEnd('')
  }

  function removeException(i) {
    setExceptions(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!name || selectedDays.length === 0 || !timeSlots.some(s => s.selected)) {
      alert('수업 이름, 요일, 시간을 선택해 주세요')
      return
    }
    setSaving(true)

    if (initial?.id) {
      // 수정
      await supabase.from('class_courses').update({
        name, category: cat, max_count: maxCount,
        is_unlimited: isUnlimited, start_date: startDate || null, end_date: endDate || null
      }).eq('id', initial.id)
      await supabase.from('class_schedules').delete().eq('course_id', initial.id)
      await supabase.from('class_exceptions').delete().eq('course_id', initial.id)
      const courseId = initial.id
      const schedules = []
      selectedDays.forEach(day => {
        timeSlots.filter(s => s.selected).forEach(slot => {
          schedules.push({ course_id: courseId, day_of_week: day, start_time: slot.start, end_time: slot.end })
        })
      })
      if (schedules.length) await supabase.from('class_schedules').insert(schedules)
      if (exceptions.length) await supabase.from('class_exceptions').insert(exceptions.map(e => ({ ...e, course_id: courseId })))
    } else {
      // 신규
      const { data: course } = await supabase.from('class_courses').insert({
        name, category: cat, max_count: maxCount,
        teacher: teacherName, teacher_id: teacherId,
        is_unlimited: isUnlimited,
        start_date: startDate || null, end_date: endDate || null
      }).select().single()

      if (course) {
        const schedules = []
        selectedDays.forEach(day => {
          timeSlots.filter(s => s.selected).forEach(slot => {
            schedules.push({ course_id: course.id, day_of_week: day, start_time: slot.start, end_time: slot.end })
          })
        })
        if (schedules.length) await supabase.from('class_schedules').insert(schedules)
        if (exceptions.length) await supabase.from('class_exceptions').insert(exceptions.map(e => ({ ...e, course_id: course.id })))
      }
    }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ background:'var(--surf)', borderRadius:16, border:'1.5px solid var(--g2)', padding:'16px 14px', marginBottom:14 }}>
      <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:14 }}>
        {initial ? '수업 수정' : '새 수업 개설'}
      </div>

      {/* 기본 정보 */}
      <div className="field"><label>수업 이름</label>
        <input placeholder="예: 기초 드로잉" value={name} onChange={e => setName(e.target.value)}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div className="field"><label>카테고리</label>
          <select value={cat} onChange={e => setCat(e.target.value)}>
            {Object.entries(CATS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>정원</label>
          <input type="number" value={maxCount} min={1} max={10} onChange={e => setMaxCount(Number(e.target.value))}/>
        </div>
      </div>

      {/* 운영 요일 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>운영 요일</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {DAYS.map((d,i) => i !== 1 && (
            <div key={i} onClick={() => toggleDay(i)}
              style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, cursor:'pointer',
                background: selectedDays.includes(i) ? 'var(--g4)' : 'var(--g1)',
                color: selectedDays.includes(i) ? '#fff' : 'var(--tm)',
                border: `1.5px solid ${selectedDays.includes(i) ? 'var(--g4)' : 'var(--g2)'}` }}>
              {d}
            </div>
          ))}
          <div onClick={() => setSelectedDays([2,3,4,5,6,0])}
            style={{ padding:'0 10px', height:36, borderRadius:10, display:'flex', alignItems:'center',
              fontSize:11, fontWeight:700, cursor:'pointer', background:'var(--g1)', color:'var(--tm)', border:'1.5px solid var(--g2)' }}>
            전체
          </div>
        </div>
      </div>

      {/* 시간 슬롯 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>운영 시간</div>
        {timeSlots.map((slot, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <div onClick={() => toggleSlot(i)}
              style={{ width:20, height:20, borderRadius:6, border:`2px solid ${slot.selected?'var(--g4)':'var(--g2)'}`,
                background:slot.selected?'var(--g4)':'transparent', display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', flexShrink:0 }}>
              {slot.selected && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 3.5,7 9,1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
            </div>
            <input value={slot.start} onChange={e => updateSlotTime(i, 'start', e.target.value)}
              style={{ width:72, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:12, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
            <span style={{ fontSize:11, color:'var(--tmu)' }}>~</span>
            <input value={slot.end} onChange={e => updateSlotTime(i, 'end', e.target.value)}
              style={{ width:72, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:12, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
            <span style={{ fontSize:10, color:'var(--tmu)' }}>시간 조절 가능</span>
          </div>
        ))}
      </div>

      {/* 예외 설정 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>예외 설정 (특정 요일+시간 제외)</div>
        {exceptions.map((e, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, background:'#FFF3E0', borderRadius:8, padding:'6px 10px' }}>
            <span style={{ fontSize:11, color:'#E65100', fontWeight:600, flex:1 }}>
              {DAYS[e.day_of_week]}요일 {e.start_time}~{e.end_time} 제외
            </span>
            <button onClick={() => removeException(i)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#E65100', fontSize:14, fontWeight:700 }}>✕</button>
          </div>
        ))}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <select value={newExcDay} onChange={e => setNewExcDay(Number(e.target.value))}
            style={{ background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:11, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}>
            {DAYS.map((d,i) => i!==1 && <option key={i} value={i}>{d}요일</option>)}
          </select>
          <input placeholder="18:00" value={newExcStart} onChange={e => setNewExcStart(e.target.value)}
            style={{ width:64, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:11, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
          <span style={{ fontSize:11, color:'var(--tmu)' }}>~</span>
          <input placeholder="20:00" value={newExcEnd} onChange={e => setNewExcEnd(e.target.value)}
            style={{ width:64, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:11, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
          <button onClick={addException}
            style={{ background:'var(--g4)', color:'#fff', border:'none', borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
            + 추가
          </button>
        </div>
      </div>

      {/* 운영 기간 */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>운영 기간</div>
        <div style={{ display:'flex', gap:10, marginBottom:8 }}>
          {[true, false].map(v => (
            <div key={String(v)} onClick={() => setIsUnlimited(v)}
              style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${isUnlimited===v?'var(--g4)':'var(--g2)'}`,
                background:isUnlimited===v?'var(--g4)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {isUnlimited===v && <div style={{ width:6, height:6, borderRadius:'50%', background:'#fff' }}/>}
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--td)' }}>{v ? '무기한 운영' : '기간 설정'}</span>
            </div>
          ))}
        </div>
        {!isUnlimited && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="field"><label>시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/>
            </div>
            <div className="field"><label>종료일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/>
            </div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : initial ? '수정 완료' : '수업 개설'}
        </button>
        <button className="btn-secondary" style={{ marginTop:0 }} onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}

export default function AdminSchedulePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCourse, setEditCourse] = useState(null)
  const [tab, setTab] = useState(0)
  const [expanded, setExpanded] = useState(null)
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
    const { data: c } = await supabase
      .from('class_courses')
      .select('*, class_schedules(*), class_exceptions(*)')
      .order('created_at', { ascending: false })
    setCourses(c || [])
    const { data: b } = await supabase
      .from('bookings')
      .select('*, users(name)')
      .gte('class_date', today)
      .order('class_date')
    setBookings(b || [])
    setLoading(false)
  }

  async function toggleCourse(id, active) {
    await supabase.from('class_courses').update({ is_active: !active }).eq('id', id)
    loadData()
  }

  async function markAttendance(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId)
    loadData()
  }

  const myCourses = courses.filter(c => adminCats.includes(c.category))
  const myBookings = bookings.filter(b => {
    const course = courses.find(c => c.id === b.course_id)
    return course && adminCats.includes(course.category)
  })

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
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditCourse(null) }}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 12px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            + 수업 개설
          </button>
        )}
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>

        {/* 수업 개설/수정 폼 */}
        {(showForm || editCourse) && (
          <CourseForm
            initial={editCourse}
            teacherName={user?.user_metadata?.name}
            teacherId={user?.id}
            onSave={() => { setShowForm(false); setEditCourse(null); loadData() }}
            onCancel={() => { setShowForm(false); setEditCourse(null) }}
          />
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
          myCourses.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>
              등록된 수업이 없어요 🐾<br/>
              <span style={{ fontSize:11 }}>우측 상단 + 수업 개설로 등록해봐요</span>
            </div>
          ) : myCourses.map(c => (
            <div key={c.id} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 14px', marginBottom:8, border:'1.5px solid var(--g1)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'var(--g1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  {EMOJI[c.category]||'🎨'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:2 }}>{c.name}</div>
                  <div style={{ fontSize:10, color:'var(--tmu)' }}>
                    {c.class_schedules?.map(s => DAYS[s.day_of_week]).filter((v,i,a)=>a.indexOf(v)===i).join('·')}요일
                  </div>
                  <div style={{ fontSize:10, color:'var(--tm)', fontWeight:600 }}>
                    정원 {c.max_count}명 · {c.is_unlimited?'무기한':c.end_date+' 까지'}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                  <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:8,
                    background:c.is_active?'var(--g1)':'#ffebee', color:c.is_active?'var(--g5)':'#c0392b' }}>
                    {c.is_active?'운영중':'중단'}
                  </span>
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => { setEditCourse(c); setShowForm(false) }}
                      style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'1px solid var(--g2)',
                        background:'var(--surf)', color:'var(--tm)', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                      수정
                    </button>
                    <button onClick={() => toggleCourse(c.id, c.is_active)}
                      style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'1px solid var(--g2)',
                        background:'var(--surf)', color:c.is_active?'#c0392b':'var(--g4)', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                      {c.is_active?'중단':'재개'}
                    </button>
                  </div>
                </div>
              </div>
              {/* 시간표 */}
              {c.class_schedules?.length > 0 && (
                <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--g1)' }}>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {c.class_schedules.map((s,i) => (
                      <span key={i} style={{ fontSize:9, padding:'2px 7px', borderRadius:6, background:'var(--g1)', color:'var(--g5)', fontWeight:700 }}>
                        {DAYS[s.day_of_week]} {s.start_time}~{s.end_time}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* 예외 */}
              {c.class_exceptions?.length > 0 && (
                <div style={{ marginTop:6 }}>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {c.class_exceptions.map((e,i) => (
                      <span key={i} style={{ fontSize:9, padding:'2px 7px', borderRadius:6, background:'#FFF3E0', color:'#E65100', fontWeight:700 }}>
                        ✕ {DAYS[e.day_of_week]} {e.start_time}~{e.end_time}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* 예약 현황 */}
        {tab === 1 && (
          Object.keys(grouped).length === 0 ? (
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
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'var(--g5)', flexShrink:0 }}>
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
                            cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>출석</button>
                        <button onClick={() => markAttendance(b.id,'absent')}
                          style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'none',
                            background:b.status==='absent'?'#c0392b':'#ffebee',
                            color:b.status==='absent'?'#fff':'#c0392b',
                            cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>결석</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
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