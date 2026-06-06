'use client'
import { useTodayWeather } from '../../../components/WeatherBar'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'

const DAYS = ['일','월','화','수','목','금','토']
const CATS = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작', meeting:'모임' }
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
  const [price, setPrice] = useState(initial?.price || 0)
  const [cat, setCat] = useState(initial?.category || 'drawing')
  const [maxCount, setMaxCount] = useState(initial?.max_count || 5)
  const [isUnlimited, setIsUnlimited] = useState(initial?.is_unlimited ?? true)
  const [startDate, setStartDate] = useState(initial?.start_date || '')
  const [endDate, setEndDate] = useState(initial?.end_date || '')
  const [selectedDays, setSelectedDays] = useState(() => [...new Set(initial?.class_schedules?.map(s => s.day_of_week) || [])])
 const [timeSlots, setTimeSlots] = useState(() => {
  const defaultMap = new Map(DEFAULT_SLOTS.map(s => [`${s.start}-${s.end}`, false]))
  const savedSchedules = initial?.class_schedules || []
  savedSchedules.forEach(x => {
    const key = `${x.start_time}-${x.end_time}`
    defaultMap.set(key, true)
  })
  return Array.from(defaultMap.entries()).map(([key, selected]) => {
    const [start, end] = key.split('-')
    return { start, end, selected }
  })
})
  const [exceptions, setExceptions] = useState(initial?.class_exceptions || [])
  const [newExcDay, setNewExcDay] = useState(2)
  const [newExcStart, setNewExcStart] = useState('')
  const [newExcEnd, setNewExcEnd] = useState('')
  const [saving, setSaving] = useState(false)

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
    if (!name||selectedDays.length===0||!timeSlots.some(s=>s.selected)) {
      alert('수업 이름, 요일, 시간을 선택해 주세요'); return
    }
    setSaving(true)
    const courseData = {
      name, category:cat, max_count:maxCount, price,
      is_unlimited:isUnlimited, start_date:startDate||null, end_date:endDate||null
    }
    const todayStr = new Date().toISOString().split('T')[0]
    let courseId = initial?.id

    try {
      if (courseId) {
        await supabase.from('class_courses').update(courseData).eq('id', courseId)

        const oldSchedules = initial?.class_schedules || []
        const newSet = []
        selectedDays.forEach(day => {
          timeSlots.filter(s=>s.selected).forEach(slot => {
            newSet.push({ day_of_week:day, start_time:slot.start, end_time:slot.end })
          })
        })

        const match = (a, b) => a.day_of_week===b.day_of_week && a.start_time===b.start_time && a.end_time===b.end_time
        const removed = oldSchedules.filter(old => !newSet.some(n => match(n, old)))
        const toAdd   = newSet.filter(n => !oldSchedules.some(old => match(old, n)))

        // 삭제된 스케줄의 미진행 예약 → 수강권 환급 후 삭제
        for (const s of removed) {
          const { data: orphans } = await supabase
            .from('bookings').select('*')
            .eq('course_id', courseId).eq('schedule_id', s.id)
            .gte('class_date', todayStr).neq('status', 'attended')
          for (const b of (orphans || [])) {
            if (cat === 'meeting') {
              const { data: mt } = await supabase.from('meeting_tickets').select('*')
                .eq('user_id', b.user_id).eq('status','confirmed')
                .gte('expires_at', todayStr).order('expires_at',{ascending:true}).limit(1)
              if (mt?.[0]) await supabase.from('meeting_tickets').update({ remain: mt[0].remain+1 }).eq('id', mt[0].id)
            } else {
              const { data: tickets } = await supabase.from('tickets').select('*').eq('user_id', b.user_id).limit(1)
              const t = tickets?.[0]
              if (t) await supabase.from('tickets').update({ remain: t.remain+1 }).eq('id', t.id)
            }
            await supabase.from('bookings').delete().eq('id', b.id)
          }
          await supabase.from('class_schedules').delete().eq('id', s.id)
        }

        // 날짜 범위 축소로 범위 밖이 된 예약 → 환급 후 삭제
        if (!isUnlimited && (endDate || startDate)) {
          let rangeQuery = supabase.from('bookings').select('*')
            .eq('course_id', courseId).gte('class_date', todayStr).neq('status','attended')
          if (endDate) rangeQuery = rangeQuery.gt('class_date', endDate)
          else rangeQuery = rangeQuery.lt('class_date', startDate)
          const { data: outOfRange } = await rangeQuery
          for (const b of (outOfRange || [])) {
            if (cat === 'meeting') {
              const { data: mt } = await supabase.from('meeting_tickets').select('*')
                .eq('user_id', b.user_id).eq('status','confirmed')
                .gte('expires_at', todayStr).order('expires_at',{ascending:true}).limit(1)
              if (mt?.[0]) await supabase.from('meeting_tickets').update({ remain: mt[0].remain+1 }).eq('id', mt[0].id)
            } else {
              const { data: tickets } = await supabase.from('tickets').select('*').eq('user_id', b.user_id).limit(1)
              const t = tickets?.[0]
              if (t) await supabase.from('tickets').update({ remain: t.remain+1 }).eq('id', t.id)
            }
            await supabase.from('bookings').delete().eq('id', b.id)
          }
        }

        if (toAdd.length) {
          await supabase.from('class_schedules').insert(toAdd.map(s => ({...s, course_id:courseId})))
        }
        await supabase.from('class_exceptions').delete().eq('course_id', courseId)
        if (exceptions.length) await supabase.from('class_exceptions').insert(exceptions.map(e => ({...e, course_id:courseId})))

      } else {
        const { data } = await supabase.from('class_courses').insert({
          ...courseData, teacher:teacherName, teacher_id:teacherId
        }).select().single()
        courseId = data?.id
        if (courseId) {
          const schedules = []
          selectedDays.forEach(day => {
            timeSlots.filter(s=>s.selected).forEach(slot => {
              schedules.push({ course_id:courseId, day_of_week:day, start_time:slot.start, end_time:slot.end })
            })
          })
          if (schedules.length) await supabase.from('class_schedules').insert(schedules)
          if (exceptions.length) await supabase.from('class_exceptions').insert(exceptions.map(e => ({...e, course_id:courseId})))
        }
      }
      onSave()
    } catch (err) {
      console.error('수업 저장 오류:', err)
      alert('저장 중 오류가 발생했어요. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background:'var(--surf)', borderRadius:16, border:'1.5px solid var(--g2)', padding:'16px 14px', marginBottom:14 }}>
      <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:14 }}>{initial?'수업 수정':'새 수업 개설'}</div>
      <div className="field"><label>수업 이름</label>
        <input placeholder="예: 기초 드로잉" value={name} onChange={e=>setName(e.target.value)}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
       <div className="field"><label>카테고리</label>
  <select value={cat} onChange={e=>setCat(e.target.value)}>
    {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
  </select>
</div>
{cat === 'meeting' && (
  <div className="field"><label>참여비 (원)</label>
    <input type="number" value={price} onChange={e=>setPrice(Number(e.target.value))} placeholder="예: 30000"/>
  </div>
)}
        <div className="field"><label>정원</label>
          <input type="number" value={maxCount} min={1} max={10} onChange={e=>setMaxCount(Number(e.target.value))}/>
        </div>
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

      <div style={{ display:'flex', gap:8 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'저장 중...':initial?'수정 완료':'수업 개설'}</button>
        <button className="btn-secondary" style={{ marginTop:0 }} onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}

export default function AdminSchedulePage() {
    const todayWeather = useTodayWeather()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCourse, setEditCourse] = useState(null)
  const [view, setView] = useState('calendar') // calendar | list
  const [selDay, setSelDay] = useState(new Date().getDate())
  const [expanded, setExpanded] = useState(null)
  const [adminCats, setAdminCats] = useState([])
  const [showInactive, setShowInactive] = useState(false)
 const now = new Date()
const todayY = now.getFullYear()
const todayM = now.getMonth()
const todayD = now.getDate()
const [year, setYear] = useState(todayY)
const [month, setMonth] = useState(todayM)
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

  async function toggleCourse(id, active) {
    await supabase.from('class_courses').update({ is_active:!active }).eq('id', id)
    loadData()
  }async function deleteCourse(courseId, courseName, isMeeting) {
  const label = isMeeting ? '회의' : '수업'
  const { data: bookingCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
  
  const msg = `"${courseName}" ${label}을(를) 완전히 삭제할까요?\n\n예약된 사람이 있으면 함께 삭제됩니다.\n이 작업은 되돌릴 수 없어요.`
  if (!confirm(msg)) return
  
  // 예약, 스케줄, 예외, 수업 순서로 삭제
  await supabase.from('bookings').delete().eq('course_id', courseId)
  await supabase.from('class_schedules').delete().eq('course_id', courseId)
  await supabase.from('class_exceptions').delete().eq('course_id', courseId)
  await supabase.from('class_courses').delete().eq('id', courseId)
  setExpanded(null)
  loadData()
}

  async function markAttendance(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId)
    loadData()
  }
  async function deleteBooking(bookingId, studentName, className) {
  if (!confirm(`${studentName}님의 ${className} 예약을 삭제할까요?`)) return
  await supabase.from('bookings').delete().eq('id', bookingId)
  loadData()
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
const myCourses = courses.filter(c => c.category === 'meeting' || adminCats.includes(c.category))

  // 특정 날짜에 열리는 수업
  function getCoursesForDay(day) {
    const dow = new Date(year, month, day).getDay()
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return myCourses.filter(c => {
      if (!c.is_active) return false
      const hasSchedule = c.class_schedules?.some(s => s.day_of_week === dow)
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

  // 특정 날짜 수업의 예약 현황
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
          <button onClick={async () => {
  await supabase.auth.signOut()
  router.push('/login')
}}
  style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
  로그아웃
</button>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>

        {/* 폼 */}
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
            {/* 달력 헤더 */}
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

            {/* 달력 그리드 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:14 }}>
              {Array(firstDow).fill(null).map((_,i) => <div key={`e${i}`} style={{ height:52 }}/>)}
              {Array(daysInMonth).fill(null).map((_,i) => {
                const d = i+1
                const dow = new Date(year,month,d).getDay()
                const isMon = dow===1
                const isSel = d===selDay
                const isT = d===today
                const dayCourses = getCoursesForDay(d)
                return (
                  <div key={d} onClick={() => !isMon && setSelDay(d)}
                    style={{ height:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start',
                      paddingTop:4, cursor:isMon?'default':'pointer', borderRadius:10, opacity:isMon?0.3:1, position:'relative',
                      background:isSel?'#e8f5e0':'transparent', border:isSel?'1.5px solid var(--g3)':'1.5px solid transparent' }}>
                    {isT && todayWeather && (
  <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', fontSize:13, zIndex:1 }}>
    {todayWeather.icon}
  </div>
)}
                    {isT ? (
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--g4)', color:'#fff',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>{d}</div>
                    ) : (
                      <div style={{ fontSize:11, fontWeight:700, color:dow===0?'#b05050':dow===6?'#5070a0':'var(--td)' }}>{d}</div>
                    )}
                 {(() => {
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const cnt = bookings.filter(b => b.class_date === dateStr).length
  return cnt > 0 ? (
    <div style={{ fontSize:9, fontWeight:700, color:'var(--g4)', marginTop:2 }}>
      {cnt}
    </div>
  ) : null
})()}
                  </div>
                )
              })}
            </div>

            {/* 선택한 날 수업 */}
            <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>
              {month+1}월 {selDay}일 ({DAYS[new Date(year,month,selDay).getDay()]}) 수업
            </div>

            {/* 자율창작 예약 현황 */}
            {(() => {
              const freeBookings = bookings.filter(b => b.class_name === '자율창작' && b.class_date === selDateStr)
              if (freeBookings.length === 0) return null
              const isExp = expanded === '__free__'
              return (
                <div style={{ background:'#FBF8F2', borderRadius:14, border:`1.5px solid ${isExp?'#C9B894':'#E8DCC4'}`, marginBottom:8, overflow:'hidden' }}>
                  <div onClick={() => setExpanded(isExp?null:'__free__')}
                    style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'#F4EDE0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🎨</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#5C5247', marginBottom:2 }}>자율창작</div>
                      <div style={{ fontSize:10, color:'#8B7355' }}>자유 이용</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#8B7355' }}>{freeBookings.length}명</div>
                      <div style={{ fontSize:10, color:'#8B7355' }}>{isExp?'▲':'▼'}</div>
                    </div>
                  </div>
                  {isExp && (
                    <div style={{ borderTop:'1px solid #E8DCC4', padding:'10px 14px' }}>
                      {freeBookings.sort((a,b) => (a.class_time||'').localeCompare(b.class_time||'')).map(b => (
                        <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F0EAE0' }}>
                          <div>
                            <span style={{ fontSize:12, fontWeight:700, color:'#5C5247' }}>{b.users?.name || '학생'}</span>
                            {b.seat && <span style={{ fontSize:10, color:'#8B7355', marginLeft:6, background:'#F4EDE0', padding:'1px 6px', borderRadius:6 }}>{b.seat}자리</span>}
                          </div>
                          <span style={{ fontSize:11, color:'#8B7355', fontWeight:600 }}>{b.class_time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {selCourses.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 수업이 없어요 🐾</div>
            ) : selCourses.map(c => {
              const dayBookings = getBookingsForDayCourse(selDay, c.id)
              const schedules = c.class_schedules?.filter(s => s.day_of_week === new Date(year,month,selDay).getDay())
              const isExp = expanded === c.id
              const isMeeting = c.category === 'meeting'
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
                        {c.class_schedules
  ?.filter((s,i,arr) => arr.findIndex(x => x.start_time===s.start_time && x.end_time===s.end_time)===i)
  .sort((a,b) => a.start_time.localeCompare(b.start_time))
  .map(s=>`${s.start_time}~${s.end_time}`)
  .join(' / ')}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:dayBookings.length>=c.max_count?'#c0392b':'var(--g4)' }}>
                        {dayBookings.length}/{c.max_count}명
                      </div>
                      <div style={{ fontSize:10, color:'var(--tmu)' }}>{isExp?'▲':'▼'}</div>
                    </div>
                  </div>

                  {isExp && (
                    <div style={{ borderTop:'1px solid var(--g1)', padding:'10px 14px' }}>
                      {schedules?.filter((s,i,arr) => arr.findIndex(x => x.start_time===s.start_time && x.end_time===s.end_time)===i).sort((a,b)=>a.start_time.localeCompare(b.start_time)).map(s => {
                        const slotBookings = dayBookings.filter(b => b.class_time === `${s.start_time}~${s.end_time}`)
                        return (
                          <div key={`${s.start_time}-${s.end_time}`} style={{ marginBottom:10 }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                              <span style={{ fontSize:11, fontWeight:800, color:'var(--td)' }}>
                                {s.start_time}~{s.end_time}
                              </span>
                              <span style={{ fontSize:10, fontWeight:700, color:slotBookings.length>=c.max_count?'#c0392b':'var(--g4)' }}>
                                {slotBookings.length}/{c.max_count}명
                              </span>
                            </div>
                            {slotBookings.length === 0 ? (
                              <div style={{ fontSize:10, color:'var(--tmu)', padding:'4px 0 6px', borderBottom:'1px solid var(--g1)' }}>
                                예약 없음
                              </div>
                            ) : slotBookings.map(b => (
                              <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', borderBottom:'1px solid var(--g1)' }}>
                                <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--g2)',
                                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'var(--g5)', flexShrink:0 }}>
                                  {b.users?.name?.[0]||'?'}
                                </div>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:11, fontWeight:700, color:'var(--td)' }}>{b.users?.name||'수강생'}</div>
                                  {b.status === 'pending' && (
                                    <div style={{ fontSize:9, color:'#E65100', fontWeight:700 }}>입금 대기중</div>
                                  )}
                                </div>
                                <button onClick={() => deleteBooking(b.id, b.users?.name || '수강생', c.name)}
                                  style={{ fontSize:9, padding:'3px 10px', borderRadius:8, border:'1px solid #f5c0c0',
                                    background:'#ffebee', color:'#c0392b', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                                  예약삭제
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                     <div style={{ display:'flex', gap:6, marginTop:8 }}>
  <button onClick={() => setEditCourse(c)}
    style={{ flex:1, padding:'7px', background:'var(--g1)', color:'var(--g5)', border:'none',
      borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
    {isMeeting?'회의 수정':'수업 수정'}
  </button>
  <button onClick={() => toggleCourse(c.id, c.is_active)}
    style={{ flex:1, padding:'7px', background:c.is_active?'#fff3e0':'var(--g1)',
      color:c.is_active?'#E65100':'var(--g5)', border:'none',
      borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
    {c.is_active?'중단':'재개'}
  </button>
  <button onClick={() => deleteCourse(c.id, c.name, isMeeting)}
    style={{ flex:1, padding:'7px', background:'#ffebee', color:'#c0392b', border:'none',
      borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
    삭제
  </button>
</div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* 목록 뷰 */}
        {!showForm && !editCourse && view === 'list' && (
          <>
            {(() => {
              const activeCourses = myCourses.filter(c => c.is_active)
              const inactiveCourses = myCourses.filter(c => !c.is_active)
              const listCourses = showInactive ? myCourses : activeCourses
              return (
                <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>운영중 수업 ({activeCourses.length})</div>
                    {inactiveCourses.length > 0 && (
                      <button onClick={() => setShowInactive(p => !p)}
                        style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:10, border:'1px solid var(--g2)',
                          background:showInactive?'#ffebee':'var(--g1)', color:showInactive?'#c0392b':'var(--tm)', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        {showInactive ? '중단 숨기기' : `중단된 수업 ${inactiveCourses.length}개`}
                      </button>
                    )}
                  </div>
                  {listCourses.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>등록된 수업이 없어요 🐾</div>
                  ) : listCourses.map(c => (
              <div key={c.id} style={{ background:'var(--bg)', borderRadius:14, padding:'12px 14px', marginBottom:8, border:'1.5px solid var(--g1)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:CAT_COLORS[c.category]||'var(--g1)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {EMOJI[c.category]||'🎨'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:2 }}>{c.name}</div>
                    <div style={{ fontSize:10, color:'var(--tmu)' }}>
                      {c.class_schedules?.map(s=>DAYS[s.day_of_week]).filter((v,i,a)=>a.indexOf(v)===i).join('·')}요일
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
                          background:'var(--surf)', color:'var(--tm)', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>수정</button>
                      <button onClick={() => toggleCourse(c.id, c.is_active)}
                        style={{ fontSize:9, padding:'3px 8px', borderRadius:8, border:'1px solid var(--g2)',
                          background:'var(--surf)', color:c.is_active?'#c0392b':'var(--g4)', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                        {c.is_active?'중단':'재개'}
                      </button>
                    </div>
                  </div>
                </div>
                {c.class_schedules?.length>0 && (
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--g1)', display:'flex', gap:4, flexWrap:'wrap' }}>
                    {[...c.class_schedules].sort((a,b)=>a.start_time.localeCompare(b.start_time)||(a.day_of_week-b.day_of_week)).map((s,i) => (
                      <span key={i} style={{ fontSize:9, padding:'2px 7px', borderRadius:6, background:'var(--g1)', color:'var(--g5)', fontWeight:700 }}>
                        {DAYS[s.day_of_week]} {s.start_time}~{s.end_time}
                      </span>
                    ))}
                  </div>
                )}
              </div>
                  ))}
                </>
              )
            })()}
          </>
        )}
      </div>

      <AdminNav active="schedule" />
    </>
  )
}