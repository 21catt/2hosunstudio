'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const DAYS = ['일','월','화','수','목','금','토']
const CATS = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작', meeting:'회의' }
const EMOJI = { drawing:'✏️', painting:'🎨', sculpture:'🗿', free:'🖼️', meeting:'⭐' }
const CAT_COLORS = { drawing:'#e8f5e0', painting:'#EDE7F6', sculpture:'#FFF3E0', free:'#E3F2FD', meeting:'#FFF8E1' }
const CAT_TEXT = { drawing:'var(--g5)', painting:'#4A148C', sculpture:'#E65100', free:'#0D47A1', meeting:'#F57F17' }
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
  const [selectedDays, setSelectedDays] = useState(initial?.class_schedules?.filter(s=>!s.specific_date).map(s => s.day_of_week) || [])
  const [timeSlots, setTimeSlots] = useState(DEFAULT_SLOTS.map(s => ({
    ...s, selected: initial?.class_schedules?.some(x => x.start_time === s.start && x.end_time === s.end) || false
  })))
  const [exceptions, setExceptions] = useState(initial?.class_exceptions || [])
  const [newExcDay, setNewExcDay] = useState(2)
  const [newExcStart, setNewExcStart] = useState('')
  const [newExcEnd, setNewExcEnd] = useState('')
  // 회의용 (특정 날짜 1회)
  const [meetingDate, setMeetingDate] = useState(initial?.class_schedules?.[0]?.specific_date || '')
  const [meetingStart, setMeetingStart] = useState(initial?.class_schedules?.[0]?.start_time || '19:00')
  const [meetingEnd, setMeetingEnd] = useState(initial?.class_schedules?.[0]?.end_time || '21:00')
  const [saving, setSaving] = useState(false)

  const isMeeting = cat === 'meeting'

  function toggleDay(d) {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }
  function toggleSlot(i) {
    setTimeSlots(prev => prev.map((s,idx) => idx===i ? {...s,selected:!s.selected} : s))
  }
  function updateSlotTime(i, field, val) {
    setTimeSlots(prev => prev.map((s,idx) => idx===i ? {...s,[field]:val} : s))
  }
  function addException() {
    if (!newExcStart||!newExcEnd) return
    setExceptions(prev => [...prev, { day_of_week:newExcDay, start_time:newExcStart, end_time:newExcEnd }])
    setNewExcStart(''); setNewExcEnd('')
  }
  function removeException(i) { setExceptions(prev => prev.filter((_,idx) => idx!==i)) }

  async function handleSave() {
    if (!name) { alert('이름을 입력해 주세요'); return }
    if (isMeeting) {
      if (!meetingDate || !meetingStart || !meetingEnd) { alert('회의 날짜와 시간을 입력해 주세요'); return }
    } else {
      if (selectedDays.length===0||!timeSlots.some(s=>s.selected)) {
        alert('요일과 시간을 선택해 주세요'); return
      }
    }
    setSaving(true)
    const courseData = {
      name, category:cat,
      max_count: isMeeting ? 999 : maxCount,
      is_unlimited: isMeeting ? true : isUnlimited,
      start_date: isMeeting ? null : (startDate || null),
      end_date: isMeeting ? null : (endDate || null)
    }
    let courseId = initial?.id
    if (courseId) {
      await supabase.from('class_courses').update(courseData).eq('id', courseId)
      await supabase.from('class_schedules').delete().eq('course_id', courseId)
      await supabase.from('class_exceptions').delete().eq('course_id', courseId)
    } else {
      const { data } = await supabase.from('class_courses').insert({
        ...courseData, teacher:teacherName, teacher_id:teacherId
      }).select().single()
      courseId = data?.id
    }
    if (courseId) {
      if (isMeeting) {
        // 회의: 특정 날짜 1회
        const dow = new Date(meetingDate).getDay()
        await supabase.from('class_schedules').insert([{
          course_id: courseId,
          day_of_week: dow,
          start_time: meetingStart,
          end_time: meetingEnd,
          specific_date: meetingDate
        }])
      } else {
        // 수업: 반복 요일
        const schedules = []
        selectedDays.forEach(day => {
          timeSlots.filter(s=>s.selected).forEach(slot => {
            schedules.push({ course_id:courseId, day_of_week:day, start_time:slot.start, end_time:slot.end })
          })
        })
        if (schedules.length) await supabase.from('class_schedules').insert(schedules)
        if (exceptions.length) await supabase.from('class_exceptions').insert(
          exceptions.map(e => ({...e, course_id:courseId}))
        )
      }
    }
    setSaving(false); onSave()
  }

  return (
    <div style={{ background:'var(--surf)', borderRadius:16, border:'1.5px solid var(--g2)', padding:'16px 14px', marginBottom:14 }}>
      <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:14 }}>
        {initial?(isMeeting?'회의 수정':'수업 수정'):(isMeeting?'새 회의 개설':'새 수업 개설')}
      </div>

      <div className="field"><label>{isMeeting?'회의 이름':'수업 이름'}</label>
        <input placeholder={isMeeting?'예: 전시 작가 회의':'예: 기초 드로잉'} value={name} onChange={e=>setName(e.target.value)}/>
      </div>

      <div className="field"><label>카테고리</label>
        <select value={cat} onChange={e=>setCat(e.target.value)}>
          {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* 회의: 특정 날짜 + 시간 */}
      {isMeeting && (
        <>
          <div className="field"><label>회의 날짜</label>
            <input type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="field"><label>시작 시간</label>
              <input value={meetingStart} onChange={e=>setMeetingStart(e.target.value)} placeholder="19:00"/>
            </div>
            <div className="field"><label>종료 시간</label>
              <input value={meetingEnd} onChange={e=>setMeetingEnd(e.target.value)} placeholder="21:00"/>
            </div>
          </div>
        </>
      )}

      {/* 수업: 정원 + 요일 + 시간 + 예외 + 운영 기간 */}
      {!isMeeting && (
        <>
          <div className="field"><label>정원</label>
            <input type="number" value={maxCount} min={1} max={10} onChange={e=>setMaxCount(Number(e.target.value))}/>
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>운영 요일</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {DAYS.map((d,i) => i!==1 && (
                <div key={i} onClick={()=>toggleDay(i)}
                  style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:700, cursor:'pointer',
                    background:selectedDays.includes(i)?'var(--g4)':'var(--g1)',
                    color:selectedDays.includes(i)?'#fff':'var(--tm)',
                    border:`1.5px solid ${selectedDays.includes(i)?'var(--g4)':'var(--g2)'}` }}>{d}</div>
              ))}
              <div onClick={()=>setSelectedDays([2,3,4,5,6,0])}
                style={{ padding:'0 10px', height:36, borderRadius:10, display:'flex', alignItems:'center',
                  fontSize:11, fontWeight:700, cursor:'pointer', background:'var(--g1)', color:'var(--tm)', border:'1.5px solid var(--g2)' }}>
                전체
              </div>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>운영 시간</div>
            {timeSlots.map((slot,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div onClick={()=>toggleSlot(i)}
                  style={{ width:20, height:20, borderRadius:6, border:`2px solid ${slot.selected?'var(--g4)':'var(--g2)'}`,
                    background:slot.selected?'var(--g4)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                  {slot.selected&&<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 3.5,7 9,1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
                </div>
                <input value={slot.start} onChange={e=>updateSlotTime(i,'start',e.target.value)}
                  style={{ width:70, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:12, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
                <span style={{ fontSize:11, color:'var(--tmu)' }}>~</span>
                <input value={slot.end} onChange={e=>updateSlotTime(i,'end',e.target.value)}
                  style={{ width:70, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:12, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>예외 설정</div>
            {exceptions.map((e,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, background:'#FFF3E0', borderRadius:8, padding:'6px 10px' }}>
                <span style={{ fontSize:11, color:'#E65100', fontWeight:600, flex:1 }}>{DAYS[e.day_of_week]}요일 {e.start_time}~{e.end_time} 제외</span>
                <button onClick={()=>removeException(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#E65100', fontSize:14, fontWeight:700 }}>✕</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              <select value={newExcDay} onChange={e=>setNewExcDay(Number(e.target.value))}
                style={{ background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:11, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}>
                {DAYS.map((d,i)=>i!==1&&<option key={i} value={i}>{d}요일</option>)}
              </select>
              <input placeholder="18:00" value={newExcStart} onChange={e=>setNewExcStart(e.target.value)}
                style={{ width:64, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:11, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
              <span style={{ fontSize:11, color:'var(--tmu)' }}>~</span>
              <input placeholder="20:00" value={newExcEnd} onChange={e=>setNewExcEnd(e.target.value)}
                style={{ width:64, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:8, padding:'5px 8px', fontSize:11, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none' }}/>
              <button onClick={addException}
                style={{ background:'var(--g4)', color:'#fff', border:'none', borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>+ 추가</button>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>운영 기간</div>
            <div style={{ display:'flex', gap:10, marginBottom:8 }}>
              {[true,false].map(v=>(
                <div key={String(v)} onClick={()=>setIsUnlimited(v)} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${isUnlimited===v?'var(--g4)':'var(--g2)'}`,
                    background:isUnlimited===v?'var(--g4)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {isUnlimited===v&&<div style={{ width:6, height:6, borderRadius:'50%', background:'#fff' }}/>}
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--td)' }}>{v?'무기한 운영':'기간 설정'}</span>
                </div>
              ))}
            </div>
            {!isUnlimited&&(
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="field"><label>시작일</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
                <div className="field"><label>종료일</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div>
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ display:'flex', gap:8 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'저장 중...':initial?'수정 완료':(isMeeting?'회의 개설':'수업 개설')}</button>
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
  const [view, setView] = useState('calendar')
  const [expanded, setExpanded] = useState(null)
  const [adminCats, setAdminCats] = useState([])
  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayD = now.getDate()
  const [year, setYear] = useState(todayY)
  const [month, setMonth] = useState(todayM)
  const [selDay, setSelDay] = useState(todayD)
  const today = (year === todayY && month === todayM) ? todayD : -1
  const todayStr = `${todayY}-${String(todayM+1).padStart(2,'0')}-${String(todayD).padStart(2,'0')}`

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
      .order('created_at', { ascending:false })
    setCourses(c || [])
    const { data: b } = await supabase
      .from('bookings')
      .select('*, users(name)')
      .order('class_date')
    setBookings(b || [])
    setLoading(false)
  }

  function monthDiff() {
    return (year - todayY) * 12 + (month - todayM)
  }

  function changeMonth(delta) {
    const newDate = new Date(year, month + delta, 1)
    const diff = (newDate.getFullYear() - todayY) * 12 + (newDate.getMonth() - todayM)
    if (diff < -3 || diff > 3) return
    setYear(newDate.getFullYear())
    setMonth(newDate.getMonth())
    setSelDay(1)
    setExpanded(null)
  }

  async function toggleCourse(id, active) {
    await supabase.from('class_courses').update({ is_active:!active }).eq('id', id)
    loadData()
  }

  async function markAttendance(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId)
    loadData()
  }

  const myCourses = courses.filter(c => adminCats.includes(c.category))

  function getCoursesForDay(day) {
    const dow = new Date(year, month, day).getDay()
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return myCourses.filter(c => {
      if (!c.is_active) return false
      // 회의 (specific_date 있는 일정만)
      const meetingMatch = c.class_schedules?.some(s => s.specific_date === dateStr)
      if (meetingMatch) return true
      // 반복 수업
      const hasSchedule = c.class_schedules?.some(s => !s.specific_date && s.day_of_week === dow)
      if (!hasSchedule) return false
      const hasException = c.class_exceptions?.some(e => e.day_of_week === dow)
      if (hasException) return false
      if (!c.is_unlimited) {
        if (c.start_date && dateStr < c.start_date) return false
        if (c.end_date && dateStr > c.end_date) return false
      }
      return true
    })
  }

  function getBookingsForDayCourse(day, courseId) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.filter(b => b.course_id === courseId && b.class_date === dateStr)
  }

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const selCourses = getCoursesForDay(selDay)
  const selDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selDay).padStart(2,'0')}`

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
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setView(view==='calendar'?'list':'calendar')}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
            {view==='calendar'?'목록':'캘린더'}
          </button>
          {!showForm && !editCourse && (
            <button onClick={() => setShowForm(true)}
              style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              + 개설
            </button>
          )}
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>

        {(showForm||editCourse) && (
          <CourseForm
            initial={editCourse}
            teacherName={user?.user_metadata?.name}
            teacherId={user?.id}
            onSave={() => { setShowForm(false); setEditCourse(null); loadData() }}
            onCancel={() => { setShowForm(false); setEditCourse(null) }}
          />
        )}

        {!showForm && !editCourse && view === 'calendar' && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <button onClick={() => changeMonth(-1)}
                disabled={monthDiff() <= -3}
                style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() <= -3 ? 0.3 : 1 }}>‹</button>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18, fontWeight:800, color:'var(--td)' }}>
                  {year}.{String(month+1).padStart(2,'0')}
                </span>
                {(year !== todayY || month !== todayM) && (
                  <button onClick={() => { setYear(todayY); setMonth(todayM); setSelDay(todayD) }}
                    style={{ background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                    오늘
                  </button>
                )}
              </div>
              <button onClick={() => changeMonth(1)}
                disabled={monthDiff() >= 3}
                style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() >= 3 ? 0.3 : 1 }}>›</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
              {DAYS.map((d,i) => (
                <div key={d} style={{ fontSize:10, fontWeight:700, padding:'3px 0',
                  color:i===0?'#b05050':i===6?'#5070a0':'var(--tmu)' }}>{d}</div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:14 }}>
              {Array(firstDow).fill(null).map((_,i) => <div key={`e${i}`} style={{ height:52 }}/>)}
              {Array(daysInMonth).fill(null).map((_,i) => {
                const d = i+1
                const dow = new Date(year,month,d).getDay()
                const isMon = dow===1
                const isSel = d===selDay
                const isT = d===today
                const dayCourses = getCoursesForDay(d)
                const hasMeeting = dayCourses.some(c => c.category === 'meeting')
                return (
                  <div key={d} onClick={() => !isMon && setSelDay(d)}
                    style={{ height:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start',
                      paddingTop:4, cursor:isMon?'default':'pointer', borderRadius:10, opacity:isMon?0.3:1, position:'relative',
                      background:isSel?'#e8f5e0':'transparent', border:isSel?'1.5px solid var(--g3)':'1.5px solid transparent' }}>
                    {isT ? (
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--g4)', color:'#fff',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>{d}</div>
                    ) : (
                      <div style={{ fontSize:11, fontWeight:700, color:dow===0?'#b05050':dow===6?'#5070a0':'var(--td)' }}>{d}</div>
                    )}
                    {hasMeeting && (
                      <div style={{ position:'absolute', top:2, right:4, fontSize:11 }}>⭐</div>
                    )}
                    <div style={{ display:'flex', gap:2, marginTop:3, flexWrap:'wrap', justifyContent:'center', padding:'0 2px' }}>
                      {dayCourses.filter(c=>c.category!=='meeting').slice(0,3).map(c => (
                        <div key={c.id} style={{ width:6, height:6, borderRadius:'50%',
                          background:CAT_TEXT[c.category]||'var(--g4)' }}/>
                      ))}
                      {dayCourses.filter(c=>c.category!=='meeting').length>3 && <div style={{ fontSize:8, color:'var(--tmu)', fontWeight:700 }}>+{dayCourses.filter(c=>c.category!=='meeting').length-3}</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>
              {month+1}월 {selDay}일 ({DAYS[new Date(year,month,selDay).getDay()]}) 일정
            </div>

            {selCourses.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 일정이 없어요 🐾</div>
            ) : selCourses.map(c => {
              const dayBookings = getBookingsForDayCourse(selDay, c.id)
              const isExp = expanded === c.id
              const isMeeting = c.category === 'meeting'
              const schedule = isMeeting
                ? c.class_schedules?.find(s => s.specific_date === selDateStr)
                : c.class_schedules?.filter(s => !s.specific_date && s.day_of_week === new Date(year,month,selDay).getDay())?.[0]
              return (
                <div key={c.id} style={{ background:'var(--bg)', borderRadius:14, border:`1.5px solid ${isExp?'var(--g3)':'var(--g1)'}`,
                  marginBottom:8, overflow:'hidden' }}>
                  <div onClick={() => setExpanded(isExp?null:c.id)}
                    style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:CAT_COLORS[c.category]||'var(--g1)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {EMOJI[c.category]||'🎨'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:2 }}>{c.name}</div>
                      <div style={{ fontSize:10, color:'var(--tmu)' }}>
                        {schedule?`${schedule.start_time}~${schedule.end_time}`:''}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:isMeeting?'var(--g4)':(dayBookings.length>=c.max_count?'#c0392b':'var(--g4)') }}>
                        {isMeeting?`${dayBookings.length}명`:`${dayBookings.length}/${c.max_count}명`}
                      </div>
                      <div style={{ fontSize:10, color:'var(--tmu)' }}>{isExp?'▲':'▼'}</div>
                    </div>
                  </div>

                  {isExp && (
                    <div style={{ borderTop:'1px solid var(--g1)', padding:'10px 14px' }}>
                      {dayBookings.length === 0 ? (
                        <div style={{ fontSize:11, color:'var(--tmu)', textAlign:'center', padding:'8px 0' }}>참여자가 없어요</div>
                      ) : dayBookings.map(b => (
                        <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--g1)' }}>
                          <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--g2)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'var(--g5)', flexShrink:0 }}>
                            {b.users?.name?.[0]||'?'}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--td)' }}>{b.users?.name||'참여자'}</div>
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
                      <div style={{ display:'flex', gap:6, marginTop:8 }}>
                        <button onClick={() => setEditCourse(c)}
                          style={{ flex:1, padding:'7px', background:'var(--g1)', color:'var(--g5)', border:'none',
                            borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                          {isMeeting?'회의 수정':'수업 수정'}
                        </button>
                        <button onClick={() => toggleCourse(c.id, c.is_active)}
                          style={{ flex:1, padding:'7px', background:c.is_active?'#ffebee':'var(--g1)',
                            color:c.is_active?'#c0392b':'var(--g5)', border:'none',
                            borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                          {c.is_active?'중단':'재개'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {!showForm && !editCourse && view === 'list' && (
          <>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:12 }}>전체 일정 목록</div>
            {myCourses.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>등록된 일정이 없어요 🐾</div>
            ) : myCourses.map(c => (
              <div key={c.id} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 14px', marginBottom:8, border:'1.5px solid var(--g1)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:CAT_COLORS[c.category]||'var(--g1)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {EMOJI[c.category]||'🎨'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:2 }}>{c.name}</div>
                    <div style={{ fontSize:10, color:'var(--tmu)' }}>
                      {c.category==='meeting'
                        ? c.class_schedules?.[0]?.specific_date
                        : (c.class_schedules?.map(s=>DAYS[s.day_of_week]).filter((v,i,a)=>a.indexOf(v)===i).join('·')+'요일')}
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
                          background:'var(--surf)', color:'var(--tm)', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>수정</button>
                      <button onClick={() => toggleCourse(c.id, c.is_active)}
                        style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'1px solid var(--g2)',
                          background:'var(--surf)', color:c.is_active?'#c0392b':'var(--g4)', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                        {c.is_active?'중단':'재개'}
                      </button>
                    </div>
                  </div>
                </div>
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