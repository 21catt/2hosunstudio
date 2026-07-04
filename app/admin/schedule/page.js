'use client'
import { useTodayWeather } from '../../../components/WeatherBar'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import { HEADER_BG, PRIMARY, T, OK, WARN, BAD } from '../../../lib/adminTheme'

const DAYS = ['일','월','화','수','목','금','토']
const CATS = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작', meeting:'모임' }
const CAT_ICON = { drawing:'pencil', painting:'palette', sculpture:'box', free:'photo', meeting:'users' }
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

async function refundAndDeleteBookings(bookings, todayStr) {
  if (!bookings.length) return
  // 유저별 환급 횟수 집계
  const refundMap = {}
  for (const b of bookings) {
    if (!refundMap[b.user_id]) refundMap[b.user_id] = { count: 0, isMeeting: b.class_name === '모임' }
    refundMap[b.user_id].count++
  }
  // 유저별 환급 (개별 UPDATE이지만 유저 수만큼만 실행)
  await Promise.all(Object.entries(refundMap).map(async ([userId, { count, isMeeting }]) => {
    if (isMeeting) {
      const { data: mt } = await supabase.from('meeting_tickets').select('id,remain')
        .eq('user_id', userId).eq('status','confirmed')
        .gte('expires_at', todayStr).order('expires_at',{ascending:true}).limit(1)
      if (mt?.[0]) await supabase.from('meeting_tickets').update({ remain: mt[0].remain + count }).eq('id', mt[0].id)
    } else {
      const { data: tks } = await supabase.from('tickets').select('id,remain').eq('user_id', userId).limit(1)
      if (tks?.[0]) await supabase.from('tickets').update({ remain: tks[0].remain + count }).eq('id', tks[0].id)
    }
  }))
  // 예약 일괄 삭제
  const ids = bookings.map(b => b.id)
  await supabase.from('bookings').delete().in('id', ids)
}

function CourseForm({ initial, onSave, onCancel, teacherName, teacherId }) {
  const [name, setName] = useState(initial?.name || '')
  const [price, setPrice] = useState(initial?.price || 0)
  const [cat, setCat] = useState(initial?.category || 'drawing')
  const [maxCount, setMaxCount] = useState(initial?.max_count || 5)
  const [isUnlimited, setIsUnlimited] = useState(initial?.is_unlimited ?? true)
  const [startDate, setStartDate] = useState(initial?.start_date || '')
  const [endDate, setEndDate] = useState(initial?.end_date || '')
  const [selectedDays, setSelectedDays] = useState(() => [...new Set(initial?.class_schedules?.map(s => s.day_of_week) || [])])
  const [daySlots, setDaySlots] = useState(() => {
    const result = {}
    const saved = initial?.class_schedules || []
    const days = [...new Set(saved.map(s => s.day_of_week))]
    days.forEach(day => {
      const m = new Map(DEFAULT_SLOTS.map(s => [`${s.start}-${s.end}`, false]))
      saved.filter(s => s.day_of_week === day).forEach(x => m.set(`${x.start_time}-${x.end_time}`, true))
      result[day] = Array.from(m.entries()).map(([key, sel]) => {
        const [start, end] = key.split('-')
        return { start, end, selected: sel }
      })
    })
    return result
  })
  const [exceptions, setExceptions] = useState(initial?.class_exceptions || [])
  const [newExcDay, setNewExcDay] = useState(2)
  const [newExcStart, setNewExcStart] = useState('')
  const [newExcEnd, setNewExcEnd] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleDay(d) {
    if (selectedDays.includes(d)) {
      setSelectedDays(prev => prev.filter(x => x !== d))
      setDaySlots(prev => { const n = {...prev}; delete n[d]; return n })
    } else {
      setSelectedDays(prev => [...prev, d])
      setDaySlots(prev => prev[d] ? prev : {
        ...prev,
        [d]: DEFAULT_SLOTS.map(s => ({ start:s.start, end:s.end, selected:false }))
      })
    }
  }
  function selectAllDays() {
    const all = [2,3,4,5,6,0]
    setSelectedDays(all)
    setDaySlots(prev => {
      const n = {...prev}
      all.forEach(d => { if (!n[d]) n[d] = DEFAULT_SLOTS.map(s => ({ start:s.start, end:s.end, selected:false })) })
      return n
    })
  }
  function toggleDaySlot(day, i) {
    setDaySlots(prev => ({...prev, [day]: prev[day].map((s,idx) => idx===i ? {...s,selected:!s.selected} : s)}))
  }
  function addException() {
    if (!newExcStart||!newExcEnd) return
    setExceptions(prev => [...prev, { day_of_week:newExcDay, start_time:newExcStart, end_time:newExcEnd }])
    setNewExcStart(''); setNewExcEnd('')
  }
  function removeException(i) { setExceptions(prev => prev.filter((_,idx) => idx!==i)) }

  async function handleSave() {
    if (!name||selectedDays.length===0||!selectedDays.some(d => daySlots[d]?.some(s=>s.selected))) {
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
        // 1. 수업 정보 업데이트
        await supabase.from('class_courses').update(courseData).eq('id', courseId)

        // 2. 스케줄 diff 계산 — initial의 임베드가 아니라 테이블에서 직접 읽는다.
        // (과거 중복 행 폭증으로 임베드가 1000행에서 잘려, 새 시간이 diff에 안 잡히고
        //  저장할 때마다 재삽입되는 사고가 있었음. 직접 조회 + 슬롯 키 dedupe로 자가 치유.)
        const { data: oldRows } = await supabase.from('class_schedules').select('*').eq('course_id', courseId)
        const oldSchedules = oldRows || []
        const newSet = []
        selectedDays.forEach(day => {
          ;(daySlots[day] || []).filter(s=>s.selected).forEach(slot => {
            newSet.push({ day_of_week:day, start_time:slot.start, end_time:slot.end })
          })
        })
        const slotKey = s => `${s.day_of_week}|${s.start_time}|${s.end_time}`
        const newKeys = new Set(newSet.map(slotKey))
        const keptIdByKey = new Map() // 유지되는 슬롯 → 대표 행 id (슬롯당 1행)
        const dupExtras = []          // 유지 슬롯의 잉여 중복 행 (예약만 대표로 옮기고 삭제)
        const removed = []            // 선택 해제된 슬롯 행 (예약 환불 후 삭제)
        for (const old of oldSchedules) {
          const k = slotKey(old)
          if (!newKeys.has(k)) { removed.push(old); continue }
          if (keptIdByKey.has(k)) dupExtras.push({ id: old.id, keepId: keptIdByKey.get(k) })
          else keptIdByKey.set(k, old.id)
        }
        const toAdd = newSet.filter(n => !keptIdByKey.has(slotKey(n)))

        // 2-1. 잉여 중복 행 정리: 예약을 대표 행으로 재지정 후 행만 삭제 (환불 아님)
        if (dupExtras.length > 0) {
          for (const d of dupExtras) {
            await supabase.from('bookings').update({ schedule_id: d.keepId }).eq('schedule_id', d.id)
          }
          await supabase.from('class_schedules').delete().in('id', dupExtras.map(d => d.id))
        }

        // 3. 삭제된 스케줄 처리 (배치 쿼리)
        const removedIds = removed.map(s => s.id).filter(Boolean)
        if (removedIds.length > 0) {
          const { data: orphans } = await supabase.from('bookings').select('*')
            .in('schedule_id', removedIds).gte('class_date', todayStr).neq('status','attended')
          await refundAndDeleteBookings(orphans || [], todayStr)
          await supabase.from('class_schedules').delete().in('id', removedIds)
        }

        // 4. 날짜 범위 축소 처리 (배치 쿼리)
        if (!isUnlimited && (endDate || startDate)) {
          let q = supabase.from('bookings').select('*')
            .eq('course_id', courseId).gte('class_date', todayStr).neq('status','attended')
          q = endDate ? q.gt('class_date', endDate) : q.lt('class_date', startDate)
          const { data: outOfRange } = await q
          await refundAndDeleteBookings(outOfRange || [], todayStr)
        }

        // 5. 새 스케줄 추가
        if (toAdd.length > 0) {
          await supabase.from('class_schedules').insert(toAdd.map(s => ({...s, course_id:courseId})))
        }

        // 6. 예외 갱신
        await supabase.from('class_exceptions').delete().eq('course_id', courseId)
        if (exceptions.length > 0) {
          await supabase.from('class_exceptions').insert(exceptions.map(e => ({...e, course_id:courseId})))
        }

      } else {
        // 신규 개설
        const { data } = await supabase.from('class_courses').insert({
          ...courseData, teacher:teacherName, teacher_id:teacherId
        }).select()
        const newId = data?.[0]?.id
        if (newId) {
          const schedules = []
          selectedDays.forEach(day => {
            ;(daySlots[day] || []).filter(s=>s.selected).forEach(slot => {
              schedules.push({ course_id:newId, day_of_week:day, start_time:slot.start, end_time:slot.end })
            })
          })
          if (schedules.length > 0) await supabase.from('class_schedules').insert(schedules)
          if (exceptions.length > 0) await supabase.from('class_exceptions').insert(exceptions.map(e => ({...e, course_id:newId})))
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
    <div style={{ background:'var(--surf)', borderRadius:16, border:'0.5px solid rgba(0,0,0,0.1)', padding:'16px 14px', marginBottom:14 }}>
      <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:14 }}>{initial?'수업 수정':'새 수업 개설'}</div>
      <div className="field"><label>수업 이름</label>
        <input placeholder="예: 기초 드로잉" value={name} onChange={e=>setName(e.target.value)}/>
      </div>
      <div className="field"><label>카테고리</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {Object.entries(CATS).map(([k,v]) => {
            const on = cat === k
            return (
              <div key={k} onClick={()=>setCat(k)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:20, cursor:'pointer',
                  background: on ? OK.soft : T.fieldBg, border:`1px solid ${on ? OK.main : 'rgba(0,0,0,0.08)'}` }}>
                <NavIcon name={CAT_ICON[k]||'palette'} color={on ? OK.tx : '#4a5a4e'} size={16} />
                <span style={{ fontSize:11, fontWeight: on?800:600, color: on ? OK.tx : 'var(--td)' }}>{v}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns: cat === 'meeting' ? '1fr 1fr' : '1fr', gap:10 }}>
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
                fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                background:selectedDays.includes(i)?PRIMARY:T.fieldBg,
                color:selectedDays.includes(i)?'#fff':'#5c6b5f' }}>{d}</div>
          ))}
          <div onClick={selectAllDays}
            style={{ padding:'0 12px', height:36, borderRadius:10, display:'flex', alignItems:'center',
              fontSize:11, fontWeight:700, cursor:'pointer', background:T.fieldBg, color:'#5c6b5f', border:'none' }}>
            전체
          </div>
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>요일별 운영 시간</div>
        {selectedDays.length === 0 ? (
          <div style={{ fontSize:11, color:'var(--tmu)', padding:'6px 0' }}>요일을 먼저 선택해 주세요</div>
        ) : [...selectedDays].sort((a,b)=>a-b).map(day => (
          <div key={day} style={{ marginBottom:8, padding:'9px 11px', background:'#fff', borderRadius:11, border:'0.5px solid rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--td)', marginBottom:7 }}>{DAYS[day]}요일</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {(daySlots[day] || []).map((slot, i) => (
                <div key={i} onClick={() => toggleDaySlot(day, i)}
                  style={{ padding:'6px 10px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border:'none',
                    background: slot.selected ? PRIMARY : T.fieldBg,
                    color: slot.selected ? '#fff' : '#5c6b5f' }}>
                  {slot.start}~{slot.end}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>예외 설정</div>
        {exceptions.map((e,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, background:WARN.soft, borderRadius:9, padding:'7px 11px' }}>
            <span style={{ fontSize:11, color:WARN.tx, fontWeight:700, flex:1 }}>{DAYS[e.day_of_week]}요일 {e.start_time}~{e.end_time} 제외</span>
            <button onClick={()=>removeException(i)} style={{ background:'none', border:'none', cursor:'pointer', color:WARN.tx, fontSize:14, fontWeight:700 }}>✕</button>
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
            style={{ background:PRIMARY, color:'#fff', border:'none', borderRadius:9, padding:'6px 13px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>+ 추가</button>
        </div>
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--tm)', marginBottom:8 }}>운영 기간</div>
        <div style={{ display:'flex', gap:10, marginBottom:8 }}>
          {[true,false].map(v=>(
            <div key={String(v)} onClick={()=>setIsUnlimited(v)} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${isUnlimited===v?PRIMARY:'rgba(0,0,0,0.2)'}`,
                background:isUnlimited===v?PRIMARY:'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="calendar" color="#fff" size={20} />
          <span className="header-title">수업 현황</span>
        </div>
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={() => setView(view==='calendar'?'list':'calendar')}
            style={{ background:'rgba(255,255,255,0.16)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
            {view==='calendar'?'목록':'캘린더'}
          </button>
          {!showForm && !editCourse && (
            <button onClick={() => setShowForm(true)}
              style={{ background:'rgba(255,255,255,0.16)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
              + 개설
            </button>
          )}
          <button onClick={async () => {
  await supabase.auth.signOut()
  router.push('/login')
}}
  style={{ background:'rgba(255,255,255,0.16)', border:'none', borderRadius:10, padding:'5px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>
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
        style={{ background: T.navBg, color: OK.tx, border:'none', borderRadius:10, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
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
                      background:isSel?OK.soft:'transparent', border:isSel?`1.5px solid ${OK.main}`:'1.5px solid transparent' }}>
                    {isT && todayWeather && (
  <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', fontSize:13, zIndex:1 }}>
    {todayWeather.icon}
  </div>
)}
                    {isT ? (
                      <div style={{ width:24, height:24, borderRadius:'50%', background: HEADER_BG, color:'#fff',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>{d}</div>
                    ) : (
                      <div style={{ fontSize:11, fontWeight:700, color:dow===0?'#b05050':dow===6?'#5070a0':'var(--td)' }}>{d}</div>
                    )}
                 {(() => {
  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const cnt = bookings.filter(b => b.class_date === dateStr).length
  return cnt > 0 ? (
    <div style={{ fontSize:9, fontWeight:800, color: OK.main, marginTop:2 }}>
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
                <div style={{ background:'#FBFAF5', borderRadius:14, border:`0.5px solid ${isExp?'#C9B894':'rgba(0,0,0,0.07)'}`, marginBottom:8, overflow:'hidden' }}>
                  <div onClick={() => setExpanded(isExp?null:'__free__')}
                    style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'#F4EDE0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><NavIcon name="photo" color="#8B7355" size={19} /></div>
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
                <div key={c.id} style={{ background: isExp?'#FBFCF9':'#fff', borderRadius:14, border:`0.5px solid ${isExp?'rgba(76,139,41,0.4)':'rgba(0,0,0,0.07)'}`,
                  marginBottom:8, overflow:'hidden' }}>
                  <div onClick={() => setExpanded(isExp?null:c.id)}
                    style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:CAT_COLORS[c.category]||'var(--g1)',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <NavIcon name={CAT_ICON[c.category]||'palette'} color={CAT_TEXT[c.category]||'#5c6b5f'} size={19} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:2 }}>{c.name}</div>
                      <div style={{ fontSize:10, color:'var(--tmu)' }}>
                        {c.class_schedules
  ?.filter(s => s.day_of_week === new Date(year, month, selDay).getDay())
  .filter((s,i,arr) => arr.findIndex(x => x.start_time===s.start_time && x.end_time===s.end_time)===i)
  .sort((a,b) => a.start_time.localeCompare(b.start_time))
  .map(s=>`${s.start_time}~${s.end_time}`)
  .join(' / ')}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:dayBookings.length>=c.max_count?BAD.tx:OK.tx }}>
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
                              <span style={{ fontSize:10, fontWeight:700, color:slotBookings.length>=c.max_count?BAD.tx:OK.tx }}>
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
                                    <div style={{ fontSize:9, color:WARN.tx, fontWeight:700 }}>입금 대기중</div>
                                  )}
                                </div>
                                <button onClick={() => deleteBooking(b.id, b.users?.name || '수강생', c.name)}
                                  style={{ fontSize:9, padding:'4px 10px', borderRadius:8, border:'none',
                                    background:BAD.soft, color:BAD.tx, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                                  예약삭제
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                     <div style={{ display:'flex', gap:6, marginTop:8 }}>
  <button onClick={() => setEditCourse(c)}
    style={{ flex:1, padding:'8px', background:T.fieldBg, color:'#5c6b5f', border:'none',
      borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
    {isMeeting?'회의 수정':'수업 수정'}
  </button>
  <button onClick={() => router.push(`/admin/curriculum?course=${encodeURIComponent(c.name)}`)}
    style={{ flex:1, padding:'8px', background:OK.soft, color:OK.tx, border:'none',
      borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
    커리큘럼
  </button>
  <button onClick={() => toggleCourse(c.id, c.is_active)}
    style={{ flex:1, padding:'8px', background:c.is_active?WARN.soft:T.navBg,
      color:c.is_active?WARN.tx:'#5c6b5f', border:'none',
      borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
    {c.is_active?'중단':'재개'}
  </button>
  <button onClick={() => deleteCourse(c.id, c.name, isMeeting)}
    style={{ flex:1, padding:'8px', background:BAD.soft, color:BAD.tx, border:'none',
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
                        style={{ fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:10, border:'none',
                          background:showInactive?BAD.soft:T.navBg, color:showInactive?BAD.tx:'#5c6b5f', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        {showInactive ? '중단 숨기기' : `중단된 수업 ${inactiveCourses.length}개`}
                      </button>
                    )}
                  </div>
                  {listCourses.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>등록된 수업이 없어요 🐾</div>
                  ) : listCourses.map(c => (
              <div key={c.id} style={{ background:'#fff', borderRadius:14, padding:'12px 14px', marginBottom:8, border:'0.5px solid rgba(0,0,0,0.07)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:CAT_COLORS[c.category]||'var(--g1)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <NavIcon name={CAT_ICON[c.category]||'palette'} color={CAT_TEXT[c.category]||'#5c6b5f'} size={21} />
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
                      background:c.is_active?OK.soft:BAD.soft, color:c.is_active?OK.tx:BAD.tx }}>
                      {c.is_active?'운영중':'중단'}
                    </span>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => { setEditCourse(c); setShowForm(false) }}
                        style={{ fontSize:9, padding:'4px 9px', borderRadius:8, border:'none',
                          background:T.fieldBg, color:'#5c6b5f', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>수정</button>
                      <button onClick={() => router.push(`/admin/curriculum?course=${encodeURIComponent(c.name)}`)}
                        style={{ fontSize:9, padding:'4px 9px', borderRadius:8, border:'none',
                          background:OK.soft, color:OK.tx, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>커리큘럼</button>
                      <button onClick={() => toggleCourse(c.id, c.is_active)}
                        style={{ fontSize:9, padding:'4px 9px', borderRadius:8, border:'none',
                          background:c.is_active?WARN.soft:T.navBg, color:c.is_active?WARN.tx:'#5c6b5f', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                        {c.is_active?'중단':'재개'}
                      </button>
                    </div>
                  </div>
                </div>
                {c.class_schedules?.length>0 && (
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--g1)', display:'flex', gap:4, flexWrap:'wrap' }}>
                    {[...c.class_schedules].sort((a,b)=>a.start_time.localeCompare(b.start_time)||(a.day_of_week-b.day_of_week)).map((s,i) => (
                      <span key={i} style={{ fontSize:9, padding:'3px 8px', borderRadius:6, background:OK.soft, color:OK.tx, fontWeight:700 }}>
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