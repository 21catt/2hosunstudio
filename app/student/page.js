'use client'
import { useState, useEffect, useRef, useId } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useTodayWeather } from '../../components/WeatherBar'
import StudentNav from '../../components/StudentNav'
import { NavIcon } from '../../components/NavIcons'
import { sendPushToAdmins } from '../../lib/pushNotify'
import { sendKakaoToAdmins } from '../../lib/kakaoNotify'

const CAT_ICON = { drawing:'pencil', painting:'palette', sculpture:'box', free:'photo', meeting:'users' }
const CAT_NAME = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작', meeting:'모임' }
const CAT_COLOR = { drawing:'#e8f5e0', painting:'#EDE7F6', sculpture:'#FFF3E0', free:'#E3F2FD', meeting:'#FFF8E1' }
const CAT_TEXT = { drawing:'var(--g5)', painting:'#4A148C', sculpture:'#E65100', free:'#0D47A1', meeting:'#F57F17' }

const DEPOSIT = { bank: '카카오뱅크', account: '3333038381397', holder: '양승민' }

const ACCENT = '#3B6D11'
const ACCENT_BG = '#EAF3DE'
const ACCENT_TEXT = '#27500A'
const CARD = '#F1EFE8'
const BORDER = 'rgba(0,0,0,0.14)'

const CAT_IMAGES = [
  '/cats/cat01.png',
  '/cats/cat02.png',
  '/cats/cat03.png',
  '/cats/cat04.png',
  '/cats/cat05.png',
]

function getCatImage(d) {
  return CAT_IMAGES[(d * 7 + 3) % CAT_IMAGES.length]
}

// 특정 수업이 다음으로 열리는 날짜 (커리큘럼 → 예약 딥링크용)
function findNextOpenDate(course) {
  const now = new Date()
  for (let i = 0; i < 70; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const dow = d.getDay()
    if (dow === 1) continue
    if (!course.class_schedules?.some(s => s.day_of_week === dow)) continue
    if (course.class_exceptions?.some(e => e.day_of_week === dow)) continue
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (!course.is_unlimited) {
      if (course.start_date && ds < course.start_date) continue
      if (course.end_date && ds > course.end_date) continue
    }
    return d
  }
  return null
}

// 수강권 무드 인디케이터 — ratio(remain/total)에 반응. style: orb | cup | plant
function MoodIndicator({ ratio, style, size = 52 }) {
  const uid = useId()
  const r0 = Number(ratio)
  const r = Math.max(0, Math.min(1, isFinite(r0) ? r0 : 0))
  const col = r <= 0 ? '#B4AEA1' : r < 0.3 ? '#C1564D' : r < 0.6 ? '#E08A1E' : '#4C8B29'

  if (style === 'plant') {
    const d = 1 - r
    return (
      <svg width={size} height={size} viewBox="0 0 60 60">
        <g className="mood-sway" style={{ transformBox:'fill-box', transformOrigin:'50% 92%' }}>
          <rect x="21" y="42" width="18" height="3" rx="1" fill="#A5623A"/>
          <path d="M22 45 L38 45 L36 54 L24 54 Z" fill="#C57C4A" stroke="#A5623A" strokeWidth="1.1" strokeLinejoin="round"/>
          <path d={`M30 45 C30 40 ${30 - d*7} 35 ${30 - d*9} ${29 + d*5}`} stroke="#6e7c52" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <ellipse cx="24" cy={34 + d*4} rx="5" ry="3" fill={col} transform={`rotate(${-32 + d*42} 24 ${34 + d*4})`}/>
          <ellipse cx="36" cy={34 + d*4} rx="5" ry="3" fill={col} transform={`rotate(${32 - d*42} 36 ${34 + d*4})`}/>
          <ellipse cx="30" cy={28 + d*3} rx="5" ry="3" fill={col} transform={`rotate(${d*10 - 3} 30 ${28 + d*3})`}/>
          {r >= 0.6 && <><circle cx="30" cy="24" r="3.2" fill="#E7A9C0"/><circle cx="30" cy="24" r="1.2" fill="#fff"/></>}
        </g>
      </svg>
    )
  }

  if (style === 'orb') {
    const wy = 50 - r * 40
    const cid = `orb-${uid}`
    return (
      <svg width={size} height={size} viewBox="0 0 60 60">
        <defs><clipPath id={cid}><circle cx="30" cy="31" r="21"/></clipPath></defs>
        <g className="mood-bob" style={{ transformBox:'fill-box', transformOrigin:'center' }}>
          <circle cx="30" cy="31" r="21" fill="#efece4"/>
          <g clipPath={`url(#${cid})`}>
            <rect x="0" y={wy} width="60" height="60" fill={col}/>
            <path className="mood-wave" d={`M0 ${wy} q7.5 -5 15 0 t15 0 t15 0 t15 0 t15 0 v40 h-90 z`} fill={col} opacity="0.85"/>
          </g>
          <circle cx="30" cy="31" r="21" fill="none" stroke="#dcd6c9" strokeWidth="1.6"/>
        </g>
      </svg>
    )
  }

  // cup (기본값)
  const ly = 50 - r * 35
  const glass = 'M21 15 L39 15 L36.5 48 Q36.5 51 34 51 L26 51 Q23.5 51 23.5 48 Z'
  const cid = `cup-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      <defs><clipPath id={cid}><path d={glass}/></clipPath></defs>
      {r >= 0.5 && (
        <g>
          <path className="mood-st1" d="M27 12 q-2.5 -3 0 -6 q2.5 -3 0 -6" stroke="#c7bfb0" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
          <path className="mood-st2" d="M33 12 q2.5 -3 0 -6 q-2.5 -3 0 -6" stroke="#c7bfb0" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
        </g>
      )}
      <path d={glass} fill="#f3f1ec"/>
      <g clipPath={`url(#${cid})`}>
        <rect x="0" y={ly} width="60" height="60" fill="#7A4A2C"/>
        {r > 0 && <rect x="0" y={ly} width="60" height="3" fill="#D8B78C"/>}
      </g>
      <path d={glass} fill="none" stroke="#cfc7b6" strokeWidth="1.6"/>
      {r <= 0 && <circle cx="30" cy="46" r="1.6" fill="#7A4A2C" opacity="0.5"/>}
    </svg>
  )
}

export default function StudentPage() {
  const router = useRouter()
  const todayWeather = useTodayWeather()
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [meetingTickets, setMeetingTickets] = useState([])
  const [bookings, setBookings] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [classes, setClasses] = useState([])
  const [curriculumNames, setCurriculumNames] = useState(new Set())
  const [pendingCourse, setPendingCourse] = useState(null)
  const deepLinkApplied = useRef(false)
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [animDay, setAnimDay] = useState(null)
  const [selCat, setSelCat] = useState(null)
  const [selCourse, setSelCourse] = useState(null)
  const [selSchedule, setSelSchedule] = useState(null)
  const [paymentModal, setPaymentModal] = useState(null)
  const [selectedCount, setSelectedCount] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSlot, setSheetSlot] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [depositModal, setDepositModal] = useState(null)
  const [moodStyle, setMoodStyle] = useState('cup')
  const [moodSheet, setMoodSheet] = useState(false)
  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayD = now.getDate()
  const todayStr = `${todayY}-${String(todayM+1).padStart(2,'0')}-${String(todayD).padStart(2,'0')}`
  const [year, setYear] = useState(todayY)
  const [month, setMonth] = useState(todayM)
  const today = (year === todayY && month === todayM) ? todayD : -1
  const [loading, setLoading] = useState(true)
  const cellRefs = useRef({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      // 비회원도 캘린더 열람 허용 — 예약 시 회원가입으로 유도
      setUser(data.user || null)
      loadData(data.user?.id || null)
    })
  }, [])

  // 커리큘럼 '이 수업 예약하기' 딥링크 (?course=) → 해당 수업 다음 날짜로 이동 + 선택
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('course')
    if (p) setPendingCourse(p)
  }, [])

  useEffect(() => {
    if (!pendingCourse || deepLinkApplied.current || classes.length === 0) return
    deepLinkApplied.current = true
    const course = classes.find(c => c.name === pendingCourse)
    if (!course) return
    const d = findNextOpenDate(course)
    if (!d) return
    setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(d.getDate())
    setSelCat(course.category); setSelCourse(course); setSelSchedule(null)
  }, [pendingCourse, classes])

  async function loadData(userId) {
    if (userId) {
      const { data: t } = await supabase.from('tickets').select('*').eq('user_id', userId).single()
      setTicket(t)
      const { data: b } = await supabase.from('bookings').select('*').eq('user_id', userId).neq('status', 'cancelled')
      setBookings(b || [])
      const { data: ab } = await supabase.from('bookings').select('course_id, schedule_id, class_date').eq('status', 'booked')
      setAllBookings(ab || [])
      const { data: profile } = await supabase.from('users').select('name').eq('id', userId).single()
      setProfileName(profile?.name || '')
      const { data: pref } = await supabase.from('user_prefs').select('mood_style').eq('user_id', userId).single()
      setMoodStyle(pref?.mood_style || 'cup')
      const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', userId).eq('status', 'confirmed').gt('remain', 0).gte('expires_at', new Date().toISOString().split('T')[0])
      setMeetingTickets(mt || [])
    }
    // 공개 데이터: 로그인 여부와 무관하게 수업/스케줄/예외 로드 (관리자 예외·운영기간 반영)
    const { data: c } = await supabase.from('class_courses').select('*, class_schedules(*), class_exceptions(*)').eq('is_active', true)
    setClasses(c || [])
    const { data: cur } = await supabase.from('course_curriculum').select('course_name')
    setCurriculumNames(new Set((cur || []).map(r => r.course_name).filter(Boolean)))
    setLoading(false)
  }

  async function changeMood(style) {
    setMoodStyle(style)
    setMoodSheet(false)
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, mood_style: style })
  }

  function bookingsInView() {
    return bookings.filter(b => {
      const d = new Date(b.class_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }

  function bookedDays() {
    return new Set(bookingsInView().map(b => new Date(b.class_date).getDate()))
  }

  // 관리자 수업현황과 동일하게 예외 요일·운영 기간을 반영 (동기화)
  function courseOpenOnDay(c, day) {
    const dow = new Date(year, month, day).getDay()
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    if (!c.class_schedules?.some(s => s.day_of_week === dow)) return false
    if (c.class_exceptions?.some(e => e.day_of_week === dow)) return false
    if (!c.is_unlimited) {
      if (c.start_date && dateStr < c.start_date) return false
      if (c.end_date && dateStr > c.end_date) return false
    }
    return true
  }

  function dayClasses(day) {
    return classes.filter(c => courseOpenOnDay(c, day))
  }

  function getSchedulesForDay(course, day) {
    const dow = new Date(year, month, day).getDay()
    const seen = new Set()
    return (course.class_schedules || []).filter(s => s.day_of_week === dow).filter(s => {
      const key = `${s.start_time}-${s.end_time}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a,b) => a.start_time.localeCompare(b.start_time))
  }

  function isBooked(courseId, scheduleId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.some(b => b.course_id === courseId && b.schedule_id === scheduleId && b.class_date === dateStr)
  }

  function getBookingCount(courseId, scheduleId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return allBookings.filter(b => b.course_id === courseId && b.schedule_id === scheduleId && b.class_date === dateStr).length
  }

  function getBooking(courseId, scheduleId, day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return bookings.find(b => b.course_id === courseId && b.schedule_id === scheduleId && b.class_date === dateStr)
  }

  function canCancel(b) {
    if (b.attended === true) return false
    const startStr = (b.class_time || '00:00').split('~')[0]
    return new Date() < new Date(`${b.class_date}T${startStr}:00`)
  }

  function spawnParticles(el) {
    if (!el) return
    const colors = ['#c8e6c0','#6db870','#3d8b50','#a8d4a0','#fff']
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div')
      const angle = (i/8)*360
      const dist = 20 + Math.random()*20
      s.style.cssText = `position:absolute;width:6px;height:6px;border-radius:50%;background:${colors[i%5]};left:50%;top:50%;margin:-3px;pointer-events:none;z-index:99;animation:spark 0.6s ease-out forwards;--tx:${Math.cos(angle*Math.PI/180)*dist}px;--ty:${Math.sin(angle*Math.PI/180)*dist}px;`
      el.appendChild(s)
      setTimeout(() => s.remove(), 700)
    }
  }

  function handleDayClick(d) {
    const dow = new Date(year, month, d).getDay()
    if (dow === 1) return
    setSelectedDay(d)
    setSelCat(null)
    setSelCourse(null)
    setSelSchedule(null)
    setAnimDay(d)
    spawnParticles(cellRefs.current[d])
    setTimeout(() => setAnimDay(null), 500)
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
    setSelectedDay(1)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
  }

  function isBookable(day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const todayStr = `${todayY}-${String(todayM+1).padStart(2,'0')}-${String(todayD).padStart(2,'0')}`
    if (dateStr < todayStr) return false
    const diff = monthDiff()
    if (diff > 1) return false
    return true
  }

  async function execBook(course, schedule, dateStr) {
    const { data: newBooking } = await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: course.id,
      schedule_id: schedule.id,
      class_name: course.name,
      class_date: dateStr,
      class_time: `${schedule.start_time}~${schedule.end_time}`,
      teacher: course.teacher,
      status: 'booked'
    }).select().single()
    await supabase.from('tickets').update({ remain: ticket.remain - 1 }).eq('id', ticket.id)
    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    const pushMsg = `${profile?.name || '학생'}님 ${course.name} ${dateStr} ${schedule.start_time} 예약`
    if (course.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: course.teacher_id,
        type: 'booking_created',
        title: '새 예약',
        body: pushMsg,
        related_id: newBooking?.id
      })
    }
    sendPushToAdmins('🐾 새 예약', pushMsg)
    sendKakaoToAdmins('🐾 새 예약', pushMsg)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    loadData(user.id)
  }

  // 유효한(기간 내·잔여 있는) 수강권 여부
  function hasValidTicket() {
    return !!(ticket && ticket.remain > 0 && ticket.expires_at >= todayStr)
  }

  // 수강권 없음/만료/소진 상태의 예약 → 예약은 만들지 않고 관리자에게 요청 알림(연락처 포함)
  async function sendBookingRequest(course, schedule, dateStr) {
    const { data: profile } = await supabase.from('users').select('name, phone').eq('id', user.id).single()
    const nm = profile?.name || profileName || '학생'
    const phone = profile?.phone || '미등록'
    const when = `${dateStr} ${schedule.start_time}~${schedule.end_time}`
    if (course.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: course.teacher_id,
        type: 'booking_request',
        title: '📩 수업 예약 요청 (수강권 확인 필요)',
        body: `${nm}님이 ${course.name} 예약을 요청했어요.\n일시: ${when}\n연락처: ${phone}\n수강권이 없거나 소진된 상태예요. 확인 후 안내해 주세요.`
      })
    }
    sendPushToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} · 연락처 ${phone}`)
    sendKakaoToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} / 연락처 ${phone}`)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    alert('예약 요청이 접수됐어요! 강사님이 확인 후 연락드릴게요 🐾')
  }

  async function handleBook() {
    if (!user) { router.push('/signup'); return }
    if (!selCourse || !selSchedule) return

    if (selCourse.category === 'meeting') {
      const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', user.id).eq('status', 'confirmed').gt('remain', 0).gte('expires_at', new Date().toISOString().split('T')[0]).limit(1)

      if (mt && mt.length > 0) {
        await handleMeetingBookWithTicket(mt[0])
        return
      }

      setPaymentModal({ course: selCourse, schedule: selSchedule })
      return
    }

    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    if (hasValidTicket()) {
      await execBook(selCourse, selSchedule, dateStr)
    } else {
      await sendBookingRequest(selCourse, selSchedule, dateStr)
    }
  }

  async function handleMeetingBook() {
    if (!paymentModal) return
    const { course, schedule } = paymentModal
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`

    const expires = new Date()
    expires.setMonth(expires.getMonth() + 1)
    await supabase.from('meeting_tickets').insert({
      user_id: user.id,
      total: selectedCount,
      remain: selectedCount - 1,
      status: 'pending',
      expires_at: expires.toISOString().split('T')[0]
    })

    const { data: newBooking } = await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: course.id,
      schedule_id: schedule.id,
      class_name: course.name,
      class_date: dateStr,
      class_time: `${schedule.start_time}~${schedule.end_time}`,
      teacher: course.teacher,
      status: 'pending'
    }).select().single()

    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    if (course.teacher_id) {
      await supabase.from('notifications').insert({
        user_id: course.teacher_id,
        type: 'meeting_pending',
        title: '모임 참여권 신청 (입금 대기)',
        body: `${profile?.name || '학생'}님이 ${course.name} ${selectedCount}회권 신청. 금액: ${((course.price || 0) * selectedCount).toLocaleString()}원. 입금 확인 후 확정 처리 필요.`,
        related_id: newBooking?.id
      })
    }

    setPaymentModal(null)
    setSelectedCount(1)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    loadData(user.id)
    alert('신청 완료! 입금 확인 후 확정됩니다 🐾')
  }

  async function handleMeetingBookWithTicket(ticket) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`

    await supabase.from('bookings').insert({
      user_id: user.id,
      course_id: selCourse.id,
      schedule_id: selSchedule.id,
      class_name: selCourse.name,
      class_date: dateStr,
      class_time: `${selSchedule.start_time}~${selSchedule.end_time}`,
      teacher: selCourse.teacher,
      status: 'confirmed'
    })

    await supabase.from('meeting_tickets').update({ remain: ticket.remain - 1 }).eq('id', ticket.id)

    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    loadData(user.id)
  }

  async function handleCancel(booking) {
    if (booking.attended === true) {
      alert('출석 완료된 수업은 취소할 수 없어요.')
      return
    }
    const _gs = (booking.class_time || '00:00').split('~')[0]
    if (new Date() >= new Date(`${booking.class_date}T${_gs}:00`)) {
      alert('지난 수업은 취소할 수 없어요.')
      return
    }
    // ── 자율창작: 입금 상태에 따른 취소·환불 분기 ──────────────────
    if (booking.class_name === '자율창작') {
      const startStr = (booking.class_time || '').split('~')[0] || '00:00'
      const classStart = new Date(`${booking.class_date}T${startStr}:00`)
      const hoursLeft = (classStart - new Date()) / (1000 * 60 * 60)

      if (booking.confirmed === false) {
        if (!confirm('예약이 취소됩니다.')) return
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        alert('예약이 취소됐어요.')
      } else if (hoursLeft > 6) {
        if (!confirm('예약을 취소할까요?\n환불은 관리자 확인 후 처리돼요.')) return
        await supabase.from('bookings').update({ status: 'cancelled', refund_status: 'required' }).eq('id', booking.id)
        const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
        const name = profile?.name || profileName || '학생'
        sendPushToAdmins('💰 환불 필요', `${name}님 자율창작 ${booking.class_date} ${booking.class_time} ${(booking.amount || 0).toLocaleString()}원`)
      } else {
        if (!confirm('수업 6시간 전부터는 환불이 안 돼요.\n그래도 취소할까요?')) return
        await supabase.from('bookings').update({ status: 'cancelled', refund_status: 'not_required' }).eq('id', booking.id)
      }
      loadData(user.id)
      return
    }

    // ── 수업·모임 취소 (기존 로직) ─────────────────────────────────
    const diff = (new Date(booking.class_date) - new Date()) / (1000*60*60)
    if (diff < 4) { alert('수업 4시간 전에는 취소할 수 없어요'); return }

    const { data: course } = await supabase.from('class_courses').select('teacher_id, category').eq('id', booking.course_id).single()

    await supabase.from('bookings').delete().eq('id', booking.id)

    if (course?.category === 'meeting') {
      const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', user.id).eq('status', 'confirmed').gte('expires_at', new Date().toISOString().split('T')[0]).order('expires_at', { ascending: true }).limit(1)
      if (mt && mt.length > 0) {
        await supabase.from('meeting_tickets').update({ remain: mt[0].remain + 1 }).eq('id', mt[0].id)
      }
    } else if (course?.category !== 'free') {
      await supabase.from('tickets').update({ remain: ticket.remain+1 }).eq('id', ticket.id)
    }

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

  function navigateToDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelectedDay(d.getDate())
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
  }

  function getHabitNextDate(course, schedule) {
    const nowHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    const todayDow = new Date(todayY, todayM, todayD).getDay()
    const daysToTarget = (schedule.day_of_week - todayDow + 7) % 7
    for (let weeksOut = 0; weeksOut <= 8; weeksOut++) {
      const offset = daysToTarget + weeksOut * 7
      const target = new Date(todayY, todayM, todayD + offset)
      const y = target.getFullYear(), m = target.getMonth(), day = target.getDate()
      if ((y - todayY) * 12 + (m - todayM) > 1) return null
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      if (dateStr === todayStr && schedule.start_time <= nowHHMM) continue
      const alreadyBooked = bookings.some(b => b.course_id === course.id && b.schedule_id === schedule.id && b.class_date === dateStr && b.status === 'booked')
      if (alreadyBooked) continue
      return { year: y, month: m, day, dateStr }
    }
    return null
  }

  function getSameWeekSlots(course, excludeScheduleId, targetDateStr) {
    const targetDate = new Date(targetDateStr + 'T00:00:00')
    const weekSunday = new Date(targetDate)
    weekSunday.setDate(targetDate.getDate() - targetDate.getDay())
    const seen = new Set()
    const chips = []
    ;(course.class_schedules || []).forEach(s => {
      if (s.id === excludeScheduleId || s.day_of_week === 1) return
      const slotDate = new Date(weekSunday)
      slotDate.setDate(weekSunday.getDate() + s.day_of_week)
      const y = slotDate.getFullYear(), m = slotDate.getMonth(), day = slotDate.getDate()
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      if (dateStr < todayStr) return
      if ((y - todayY) * 12 + (m - todayM) > 1) return
      const chipKey = `${dateStr}-${s.start_time}`
      if (seen.has(chipKey)) return
      seen.add(chipKey)
      if (bookings.some(b => b.course_id === course.id && b.schedule_id === s.id && b.class_date === dateStr && b.status === 'booked')) return
      const cnt = allBookings.filter(b => b.course_id === course.id && b.schedule_id === s.id && b.class_date === dateStr).length
      if (cnt >= (course.max_count || 999)) return
      chips.push({ schedule: s, dateStr, day })
    })
    return chips.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.schedule.start_time.localeCompare(b.schedule.start_time))
  }

  async function handleQuickBook(course, schedule, dateStr) {
    if (!user) { router.push('/signup'); return }
    if (hasValidTicket()) await execBook(course, schedule, dateStr)
    else await sendBookingRequest(course, schedule, dateStr)
  }

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const bd = bookedDays()
  const dc = dayClasses(selectedDay)

  const dayBookings = bookings.filter(b => {
    const d = new Date(b.class_date)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay
  })

  const catGroups = dc.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {})
  const cats = Object.keys(catGroups)
  const catCourses = selCat ? catGroups[selCat] || [] : []

  const upcomingBookings = bookings
    .filter(b => b.status === 'booked' && b.class_date >= todayStr)
    .sort((a, b) => a.class_date !== b.class_date
      ? a.class_date.localeCompare(b.class_date)
      : (a.class_time || '').localeCompare(b.class_time || ''))
    .slice(0, 2)

  const habitSlots = (() => {
    if (bookings.length === 0) return []
    const freq = {}
    bookings.filter(b => b.status === 'booked').forEach(b => {
      if (!b.class_name || !b.class_time || !b.class_date) return
      const dow = new Date(b.class_date + 'T00:00:00').getDay()
      const k = `${b.class_name}||${dow}||${b.class_time}`
      if (!freq[k]) freq[k] = { count: 0, last: '', class_name: b.class_name, class_time: b.class_time, dow }
      freq[k].count++
      if (b.class_date > freq[k].last) freq[k].last = b.class_date
    })
    const entries = Object.values(freq)
    if (entries.length === 0) return []
    return entries
      .sort((a, b) => b.count !== a.count ? b.count - a.count : b.last.localeCompare(a.last))
      .slice(0, 2)
      .map(entry => {
        const course = classes.find(c => c.name === entry.class_name && c.category !== 'meeting') || null
        if (!course) return null
        const startTime = (entry.class_time || '').split('~')[0]
        const schedule = course.class_schedules?.find(s => s.start_time === startTime && s.day_of_week === entry.dow) || null
        if (!schedule) return null
        const next = getHabitNextDate(course, schedule)
        if (!next) return null
        const isFull = allBookings.filter(b => b.course_id === course.id && b.schedule_id === schedule.id && b.class_date === next.dateStr).length >= (course.max_count || 999)
        const chips = getSameWeekSlots(course, schedule.id, next.dateStr)
        return { course, schedule, next, isFull, chips }
      })
      .filter(Boolean)
  })()
  const showQuickBook = habitSlots.length > 0

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes spark { 0% { transform: translate(0,0) scale(1.2); opacity:1; } 100% { transform: translate(var(--tx),var(--ty)) scale(0); opacity:0; } }
        @keyframes catPop { 0% { transform: scale(0) rotate(-15deg); opacity:0; } 55% { transform: scale(1.28) rotate(6deg); opacity:1; } 100% { transform: scale(1) rotate(0deg); opacity:1; } }
        .cat-anim { animation: catPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes slideUp { from { transform: translateY(10px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        .slide-up { animation: slideUp 0.25s ease forwards; }
        @keyframes moodBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes moodWave{to{transform:translateX(-30px)}}
        @keyframes moodSway{0%,100%{transform:rotate(-2.2deg)}50%{transform:rotate(2.2deg)}}
        @keyframes moodSteam{0%{opacity:0;transform:translateY(3px)}35%{opacity:.5}100%{opacity:0;transform:translateY(-7px)}}
        .mood-bob{animation:moodBob 3s ease-in-out infinite}
        .mood-wave{animation:moodWave 2.4s linear infinite}
        .mood-sway{animation:moodSway 3.6s ease-in-out infinite}
        .mood-st1{animation:moodSteam 2.6s ease-in-out infinite; transform-box:fill-box; transform-origin:center}
        .mood-st2{animation:moodSteam 2.6s ease-in-out .9s infinite; transform-box:fill-box; transform-origin:center}
      `}</style>

      {depositModal && (
        <div onClick={() => setDepositModal(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'22px 20px', maxWidth:340, width:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--td)' }}>입금 안내</div>
              <span style={{ fontSize:10, fontWeight:700, background:'#FFF3CD', color:'#856404', padding:'3px 8px', borderRadius:20, border:'1px solid #FFD700' }}>입금 대기</span>
            </div>
            <div style={{ background:'#FBF8F2', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:4 }}>
                {depositModal.class_date?.slice(5).replace('-','/')} {depositModal.class_time}
                {depositModal.seat ? ` · ${depositModal.seat}자리` : ''}
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--td)' }}>{(depositModal.amount || 0).toLocaleString()}원</div>
            </div>
            <div style={{ background:'var(--bg)', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:6 }}>입금 계좌</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--td)', lineHeight:1.8 }}>
                {DEPOSIT.bank}<br/>{DEPOSIT.account}<br/>예금주: {DEPOSIT.holder}
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.7, marginBottom:14 }}>
              · 입금자명: <strong>{profileName}</strong> 으로 입금해 주세요.<br/>
              · 24시간 내 입금하지 않으면 자동으로 취소됩니다.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => { navigator.clipboard?.writeText(DEPOSIT.account).catch(() => {}); alert(`계좌번호가 복사됐어요!\n${DEPOSIT.account}`) }}
                style={{ flex:1, padding:'11px', background:'#EAF3DE', color:'#27500A', border:'1px solid #3B6D1133', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                계좌 복사
              </button>
              <button
                onClick={() => setDepositModal(null)}
                style={{ flex:1, padding:'11px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModal && (
        <div onClick={()=>{setPaymentModal(null); setSelectedCount(1)}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:'20px 18px', maxWidth:340, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--td)', marginBottom:6 }}>모임 참여 안내</div>
            <div style={{ fontSize:12, color:'var(--tm)', lineHeight:1.6, marginBottom:14 }}>{paymentModal.course.name}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:6 }}>참여 횟수 선택</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {[1,2,3,4].map(n => (
                <div key={n} onClick={()=>setSelectedCount(n)} style={{ flex:1, padding:'8px', borderRadius:10, textAlign:'center', cursor:'pointer', background:selectedCount===n?'var(--g4)':'var(--bg)', color:selectedCount===n?'#fff':'var(--td)', border:`1.5px solid ${selectedCount===n?'var(--g4)':'var(--g1)'}`, fontSize:12, fontWeight:700 }}>
                  {n}회
                </div>
              ))}
            </div>
            <div style={{ background:'var(--bg)', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:6 }}>참여비 ({paymentModal.course.price?.toLocaleString() || 0}원 × {selectedCount}회)</div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--g5)', marginBottom:10 }}>{((paymentModal.course.price || 0) * selectedCount).toLocaleString()}원</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>입금 계좌</div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--td)', lineHeight:1.6 }}>
                카카오뱅크<br/>3333-03-8381397<br/>예금주: 양승민
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.6, marginBottom:14 }}>
              • 신청 후 위 계좌로 입금해 주세요.<br/>
              • 입금 확인 후 모임 참여권이 확정됩니다.<br/>
              • 모임권은 발급일로부터 1개월 내 사용해야 하며 이월되지 않습니다.<br/>
              • 모임권은 모든 모임에서 사용 가능합니다.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{setPaymentModal(null); setSelectedCount(1)}} style={{ flex:1, padding:'11px', background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>취소</button>
              <button onClick={handleMeetingBook} style={{ flex:1, padding:'11px', background:'var(--g4)', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>신청하기</button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && sheetSlot && (
        <div onClick={() => setSheetOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'20px 18px 32px', width:'100%', maxHeight:'60vh', overflowY:'auto' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:4 }}>{sheetSlot.course.name} 예약</div>
            <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:14 }}>이번 주 다른 시간대</div>
            {(!ticket || ticket.remain <= 0) ? (
              <div style={{ textAlign:'center', padding:'12px', background:'var(--g1)', borderRadius:12, fontSize:12, color:'var(--tmu)', marginBottom:12 }}>수강권 충전 필요</div>
            ) : sheetSlot.chips.length === 0 ? (
              <div style={{ textAlign:'center', padding:'12px', background:'var(--g1)', borderRadius:12, fontSize:12, color:'var(--tmu)', marginBottom:12 }}>이번 주 다른 시간대 없음</div>
            ) : (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                {sheetSlot.chips.map(chip => {
                  const cd = new Date(chip.dateStr + 'T00:00:00')
                  const cdow = ['일','월','화','수','목','금','토'][cd.getDay()]
                  const cmmdd = `${String(cd.getMonth()+1).padStart(2,'0')}/${String(cd.getDate()).padStart(2,'0')}`
                  return (
                    <button key={`${chip.schedule.id}-${chip.dateStr}`}
                      onClick={() => { handleQuickBook(sheetSlot.course, chip.schedule, chip.dateStr); setSheetOpen(false) }}
                      style={{ padding:'8px 14px', borderRadius:20, background:ACCENT_BG, color:ACCENT_TEXT, border:`1.5px solid ${ACCENT}55`, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                      {cdow} {chip.schedule.start_time} · {cmmdd}
                    </button>
                  )
                })}
              </div>
            )}
            <div style={{ textAlign:'center' }}>
              <span onClick={() => { navigateToDate(sheetSlot.next.dateStr); setSheetOpen(false) }}
                style={{ fontSize:12, color:'var(--tmu)', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}>
                전체 일정에서 고르기 →
              </span>
            </div>
          </div>
        </div>
      )}

      {moodSheet && (
        <div onClick={() => setMoodSheet(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'18px 18px 32px', width:'100%', maxWidth:390, margin:'0 auto' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:4 }}>수강권 무드 선택</div>
            <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:14 }}>잔여가 줄면 표정이 바뀌어요 🐾</div>
            <div style={{ display:'flex', gap:8 }}>
              {[['orb','리퀴드 오브'],['cup','커피 유리컵'],['plant','식물']].map(([k, label]) => {
                const on = moodStyle === k
                return (
                  <div key={k} onClick={() => changeMood(k)}
                    style={{ flex:1, cursor:'pointer', background: on ? ACCENT_BG : CARD, border:`${on?2:1}px solid ${on?ACCENT:'rgba(0,0,0,0.08)'}`, borderRadius:14, padding:'12px 4px 9px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                    <MoodIndicator ratio={0.7} style={k} size={48} />
                    <span style={{ fontSize:10, fontWeight: on?800:700, color: on?ACCENT_TEXT:'var(--tmu)' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🐱</span>
          <span className="header-title">2호선 스튜디오</span>
        </div>
        {user ? (
          <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>로그아웃</button>
        ) : (
          <button onClick={()=>router.push('/login')} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 10px', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer' }}>로그인 / 가입</button>
        )}
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0' }}>

        {user && (() => {
          if (upcomingBookings.length > 0) {
            const b = upcomingBookings[0]
            const d = new Date(b.class_date + 'T00:00:00')
            const dow = ['일','월','화','수','목','금','토'][d.getDay()]
            const mmdd = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
            const isPending = b.confirmed === false
            return (
              <div style={{ marginBottom:16, background:isPending?'#FFF8E1':ACCENT_BG, borderRadius:14, padding:'10px 14px', border:`1.5px solid ${isPending?'#E65100':ACCENT}55`, display:'flex', alignItems:'center', gap:8 }}>
                <div onClick={() => isPending ? setDepositModal(b) : navigateToDate(b.class_date)} style={{ flex:1, minWidth:0, cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:1 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--tmu)' }}>다음 수업</span>
                    {b.attended === true
                      ? <span style={{ fontSize:9, fontWeight:700, background:'#C8E6C9', color:'#1B5E20', padding:'1px 6px', borderRadius:10, border:'1px solid #A5D6A7' }}>✓ 출석</span>
                      : isPending
                        ? <span style={{ fontSize:9, fontWeight:700, background:'#FFF3CD', color:'#856404', padding:'1px 6px', borderRadius:10, border:'1px solid #FFD700' }}>입금 대기</span>
                        : <span style={{ fontSize:9, fontWeight:700, background:'#EAF3DE', color:'#27500A', padding:'1px 6px', borderRadius:10, border:'1px solid #3B6D1133' }}>예약 확정</span>
                    }
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:isPending?'#E65100':ACCENT_TEXT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {b.class_name} · {mmdd}({dow}) {b.class_time?.split('~')[0]}
                  </div>
                </div>
                {!isPending && (
                  <button
                    onClick={() => { if (habitSlots.length > 0) { setSheetSlot(habitSlots[0]); setSheetOpen(true) } else { navigateToDate(b.class_date) } }}
                    style={{ flexShrink:0, padding:'5px 12px', borderRadius:20, background:ACCENT, color:'#fff', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                    또 예약
                  </button>
                )}
              </div>
            )
          }
          if (habitSlots.length > 0) {
            return (
              <div style={{ marginBottom:16, background:CARD, borderRadius:14, padding:'10px 14px', border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', flexShrink:0 }}>또 듣기</div>
                <div style={{ display:'flex', gap:6, flex:1, overflow:'hidden' }}>
                  {habitSlots.map(slot => {
                    const nd = new Date(slot.next.dateStr + 'T00:00:00')
                    const dow = ['일','월','화','수','목','금','토'][nd.getDay()]
                    const mmdd = `${String(nd.getMonth()+1).padStart(2,'0')}/${String(nd.getDate()).padStart(2,'0')}`
                    const disabled = !ticket || ticket.remain <= 0 || slot.isFull
                    return (
                      <button key={`${slot.course.id}-${slot.schedule.id}`}
                        onClick={() => !disabled && handleQuickBook(slot.course, slot.schedule, slot.next.dateStr)}
                        style={{ padding:'5px 10px', borderRadius:20, background:disabled?'var(--g1)':ACCENT_BG, color:disabled?'var(--tmu)':ACCENT_TEXT, border:`1.5px solid ${disabled?BORDER:ACCENT+'55'}`, fontSize:11, fontWeight:600, cursor:disabled?'default':'pointer', fontFamily:'Nunito,sans-serif', flexShrink:0 }}>
                        {slot.course.name.length <= 4 ? slot.course.name : slot.course.name.slice(0,4)+'…'} {dow} · {mmdd}
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => { setSheetSlot(habitSlots[0]); setSheetOpen(true) }}
                  style={{ flexShrink:0, padding:'4px 8px', borderRadius:20, background:'transparent', color:'var(--tmu)', border:`1px solid ${BORDER}`, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                  ⋯
                </button>
              </div>
            )
          }
          return (
            <div style={{ marginBottom:16, background:CARD, borderRadius:14, padding:'10px 14px', border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', cursor:'pointer' }}
              onClick={() => { setYear(todayY); setMonth(todayM); setSelectedDay(todayD) }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--td)' }}>수업 예약하기 →</div>
            </div>
          )
        })()}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <button onClick={() => changeMonth(-1)} disabled={monthDiff() <= -3} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() <= -3 ? 0.3 : 1 }}>‹</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18, fontWeight:800, color:'var(--td)' }}>{year}.{String(month+1).padStart(2,'0')}</span>
            {(year !== todayY || month !== todayM) && (
              <button onClick={() => { setYear(todayY); setMonth(todayM); setSelectedDay(todayD) }} style={{ background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>오늘</button>
            )}
          </div>
          <button onClick={() => changeMonth(1)} disabled={monthDiff() >= 3} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:20, color:'var(--g4)', padding:'4px 10px', opacity: monthDiff() >= 3 ? 0.3 : 1 }}>›</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', textAlign:'center', marginBottom:4 }}>
          {['일','월','화','수','목','금','토'].map((d,i)=>(
            <div key={d} style={{ fontSize:10, fontWeight:700, padding:'3px 0', color:i===0?'#b05050':i===6?'#5070a0':'var(--tmu)' }}>{d}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:6 }}>
          {Array(firstDow).fill(null).map((_,i)=><div key={`e${i}`} style={{ height:52 }}/>)}
          {Array(daysInMonth).fill(null).map((_,i)=>{
            const d = i+1
            const dow = new Date(year,month,d).getDay()
            const isMon = dow===1
            const isB = bd.has(d)
            const isSel = d===selectedDay
            const isT = d===today
            const isAnim = animDay===d
            const hasCls = dayClasses(d).length > 0

            return (
              <div key={d} ref={el => cellRefs.current[d] = el} onClick={()=>handleDayClick(d)} style={{ height:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:isMon?'default':'pointer', borderRadius:12, opacity:isMon?0.3:1, position:'relative', background:isSel?ACCENT_BG:'transparent', border:isSel?`1.5px solid ${ACCENT}`:'1.5px solid transparent' }}>
                {isT && todayWeather && (
                  <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', fontSize:13, zIndex:1 }}>{todayWeather.icon}</div>
                )}
                {isB || isSel ? (
                  <div className={isAnim?'cat-anim':''} style={{ display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1 }}>
                    <img src={getCatImage(d)} alt="" style={{ width:34, height:34, objectFit:'contain' }}/>
                    <span style={{ fontSize:9, fontWeight:800, color:'var(--td)', marginTop:-1 }}>{d}</span>
                  </div>
                ) : isT ? (
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--g4)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>{d}</div>
                ) : (
                  <div style={{ fontSize:12, fontWeight:700, color:dow===0?'#b05050':dow===6?'#5070a0':'var(--td)' }}>{d}</div>
                )}
              </div>
            )
          })}
        </div>


        {!user ? (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--tmu)', marginBottom:10 }}>🐾 처음 오셨나요?</div>
            <div onClick={()=>router.push('/student/curriculum')}
              style={{ display:'flex', alignItems:'center', gap:12, background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'13px 14px', marginBottom:8, cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ width:42, height:42, borderRadius:12, background:ACCENT_BG, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <NavIcon name="book" color={ACCENT_TEXT} size={22} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:2 }}>커리큘럼 둘러보기</div>
                <div style={{ fontSize:11, color:'var(--tmu)' }}>어떤 수업을 배우는지 회차별로 보기</div>
              </div>
              <span style={{ fontSize:18, color:'var(--tmu)' }}>›</span>
            </div>
            <div onClick={()=>router.push('/signup')}
              style={{ display:'flex', alignItems:'center', gap:12, background:ACCENT, borderRadius:14, padding:'13px 14px', cursor:'pointer' }}>
              <div style={{ width:42, height:42, borderRadius:12, background:'rgba(255,255,255,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <NavIcon name="calendar" color="#fff" size={22} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:2 }}>가입하고 수업 예약하기</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.85)' }}>날짜·수업 고르고 바로 시작</div>
              </div>
              <span style={{ fontSize:18, color:'rgba(255,255,255,0.9)' }}>›</span>
            </div>
          </div>
        ) : (
        <div style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid var(--g2)' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700 }}>내 수강권</div>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:4 }}>
              {ticket?`${ticket.total}회권 · 잔여 ${ticket.remain}회`:'수강권 없음'}
            </div>
            {ticket && (
              <>
                <div style={{ width:'100%', height:5, background:'rgba(255,255,255,0.5)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                  <div style={{ width: `${(ticket.remain / ticket.total) * 100}%`, height: '100%', background: ticket.remain/ticket.total >= 0.6 ? 'var(--g4)' : ticket.remain/ticket.total >= 0.3 ? 'var(--g3)' : '#c9a07a', transition: 'width 0.3s ease, background 0.3s ease' }}/>
                </div>
                <div style={{ fontSize:10, color:'var(--g4)', fontWeight:600 }}>만료: {ticket.expires_at}</div>
              </>
            )}
          </div>
          <div onClick={() => setMoodSheet(true)} style={{ marginLeft:12, cursor:'pointer' }} title="무드 스타일 변경">
            <MoodIndicator ratio={ticket ? (ticket.remain / ticket.total) : 0} style={moodStyle} size={52} />
          </div>
        </div>
        )}

        {meetingTickets.length > 0 && (
          <div style={{ background:'#FFF8E1', borderRadius:14, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid #FFE082' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#F57F17', fontWeight:700, marginBottom:2 }}>👥 모임 참여권</div>
              {meetingTickets.map(mt => (
                <div key={mt.id} style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>
                  잔여 {mt.remain}/{mt.total}회 · 만료 {mt.expires_at}
                </div>
              ))}
            </div>
          </div>
        )}

        <div onClick={()=>router.push(`/student/free?date=${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`)} style={{ background:'#FBF8F2', borderRadius:14, padding:'14px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid #E8DCC4', cursor:'pointer' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'#8B7355', fontWeight:700, marginBottom:2 }}>🎨 자율창작</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#5C5247', marginBottom:2 }}>1시간만, 자유롭게</div>
            <div style={{ fontSize:10, color:'#A89880' }}>평일 낮 6,000원부터</div>
          </div>
          <div style={{ fontSize:18, color:'#8B7355' }}>›</div>
        </div>

        <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>{month+1}월 {selectedDay}일 수업</div>

        {dc.length === 0 ? (
          <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 수업이 없어요 🐾</div>
        ) : (
          <>
            {cats.length > 1 && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수업 종류 선택</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {cats.map(cat => {
                    const on = selCat === cat
                    return (
                      <div key={cat} onClick={() => {
                        if (cat === 'free') { router.push(`/student/free?date=${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`); return }
                        setSelCat(cat); setSelCourse(null); setSelSchedule(null)
                      }} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 14px', borderRadius:20, cursor:'pointer', background: on ? ACCENT_BG : CARD, border:`1px solid ${on ? ACCENT : 'rgba(0,0,0,0.08)'}` }}>
                        <NavIcon name={CAT_ICON[cat] || 'palette'} color={on ? ACCENT_TEXT : '#4a5a4e'} size={17} />
                        <span style={{ fontSize:12, fontWeight: on ? 800 : 600, color: on ? ACCENT_TEXT : 'var(--td)' }}>{CAT_NAME[cat]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {cats.length === 1 && cats[0] === 'free' && (
              <div onClick={()=>router.push(`/student/free?date=${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`)} style={{ padding:'14px 16px', background:'#FBF8F2', borderRadius:14, border:'1.5px solid #E8DCC4', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#5C5247' }}>🎨 자율창작 예약하러 가기</div>
                  <div style={{ fontSize:10, color:'#8B7355', marginTop:2 }}>자리와 시간을 직접 선택해요</div>
                </div>
                <div style={{ fontSize:18, color:'#8B7355' }}>›</div>
              </div>
            )}

            {cats.length === 1 && cats[0] !== 'free' && selCat !== cats[0] && (() => { setTimeout(() => setSelCat(cats[0]), 0); return null })()}

            {selCat && selCat !== 'free' && catCourses.length === 1 && selCourse !== catCourses[0] && (() => { setTimeout(() => setSelCourse(catCourses[0]), 0); return null })()}

            {selCat && selCat !== 'free' && catCourses.length > 0 && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                {catCourses.length > 1 && (
                  <div style={{ fontSize:11, fontWeight:500, color:'var(--tmu)', marginBottom:8 }}>수업 선택</div>
                )}
                {catCourses.map(c => {
                  const isOpen = selCourse?.id === c.id
                  const daySchedules = getSchedulesForDay(c, selectedDay)
                  return (
                    <div key={c.id} style={{ borderRadius:14, marginBottom:8, overflow:'hidden', border:`1px solid ${isOpen?ACCENT:'rgba(0,0,0,0.08)'}`, background:isOpen?ACCENT_BG:CARD }}>
                      <div onClick={() => { if (isOpen) { setSelCourse(null); setSelSchedule(null) } else { setSelCourse(c); setSelSchedule(null) } }}
                        style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:isOpen?ACCENT_TEXT:'var(--td)' }}>{c.name}</div>
                          <div style={{ fontSize:11, color:'var(--tmu)', marginTop:2 }}>
                            강사 {c.teacher}
                            {daySchedules.length > 0 && <span style={{ marginLeft:6 }}>{daySchedules.map(s=>`${s.start_time}~${s.end_time}`).join(' / ')}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize:16, color:isOpen?ACCENT:'var(--tmu)', display:'inline-block', transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'rotate(0deg)' }}>›</span>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop:`1px solid ${ACCENT}28`, padding:'6px 12px 12px' }}>
                          {curriculumNames.has(c.name) && (
                            <div onClick={(e) => { e.stopPropagation(); router.push(`/student/curriculum?course=${encodeURIComponent(c.name)}`) }}
                              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', margin:'2px 0 8px', borderRadius:10, background:'#fff', border:'1px solid rgba(0,0,0,0.08)', cursor:'pointer' }}>
                              <span style={{ fontSize:11, fontWeight:700, color:ACCENT_TEXT }}>📚 이 수업 커리큘럼 보기</span>
                              <span style={{ fontSize:14, color:ACCENT }}>›</span>
                            </div>
                          )}
                          {daySchedules.length === 0 ? (
                            <div style={{ fontSize:11, color:'var(--tmu)', padding:'8px 0', textAlign:'center' }}>이 날 수업 시간이 없어요</div>
                          ) : daySchedules.map(s => {
                            const booked = isBooked(c.id, s.id, selectedDay)
                            const booking = getBooking(c.id, s.id, selectedDay)
                            const cnt = getBookingCount(c.id, s.id, selectedDay)
                            const remain = c.max_count - cnt
                            const full = remain <= 0 && !booked
                            const isSel = selSchedule?.id === s.id
                            return (
                              <div key={s.id}
                                onClick={() => { if (!full && !booked) setSelSchedule(isSel ? null : s) }}
                                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:11, marginBottom:6, background:booked?'#E8F5E0':'#fff', border:`1px solid ${booked?'#a8d9a0':isSel?ACCENT:'rgba(0,0,0,0.08)'}`, cursor:full||booked?'default':'pointer', opacity:full?0.45:1 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0, background:booked?'#6db870':isSel?ACCENT:'transparent', border:`2px solid ${booked?'#6db870':isSel?ACCENT:BORDER}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    {(booked||isSel) && <svg width="9" height="7" viewBox="0 0 9 7"><polyline points="1,3.5 3,6 8,1" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </div>
                                  <span style={{ fontSize:13, fontWeight:500, color:isSel?ACCENT_TEXT:'var(--td)' }}>{s.start_time}~{s.end_time}</span>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:11, fontWeight:500, color:full?'#c0392b':booked?'#6db870':isSel?ACCENT_TEXT:'var(--tmu)' }}>
                                    {booked ? (booking?.attended === true ? '출석' : '예약됨') : full ? '마감' : `${remain}자리 남음`}
                                  </span>
                                  {booked && canCancel(booking) && (
                                    <button onClick={e=>{e.stopPropagation();handleCancel(booking)}}
                                      style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(255,255,255,0.8)', color:'var(--tm)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:500 }}>
                                      취소
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {selSchedule && !isBooked(selCourse?.id, selSchedule?.id, selectedDay) && (
              <div className="slide-up" style={{ marginBottom:14 }}>
                {isBookable(selectedDay) ? (
                  <button onClick={handleBook}
                    style={{ width:'100%', padding:'15px 20px', background:ACCENT, color:'#fff', border:'none', borderRadius:14, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                    {!user
                      ? '가입하고 예약하기'
                      : (selCourse?.category === 'meeting' || hasValidTicket())
                        ? `${selCourse?.name} ${selSchedule?.start_time}~${selSchedule?.end_time} 예약하기`
                        : '예약 요청하기 (수강권 확인 필요)'}
                  </button>
                ) : (
                  <div style={{ padding:'14px', background:CARD, borderRadius:14, textAlign:'center', color:'var(--tmu)', fontSize:12, fontWeight:500 }}>{monthDiff() < 0 ? '지난 날짜는 예약할 수 없어요' : '예약은 다음 달까지만 가능해요'}</div>
                )}
              </div>
            )}
          </>
        )}

        {dayBookings.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>내 예약</div>
            {dayBookings.map(b => {
              const isAttended = b.attended === true
              const isDepositPending = b.confirmed === false
              const isMeetingPending = b.status === 'pending'
              const startStr = (b.class_time || '00:00').split('~')[0]
              const isPast = new Date() >= new Date(`${b.class_date}T${startStr}:00`)
              const cancellable = canCancel(b)
              let bg, borderColor
              if (isAttended) { bg = '#E8F5E0'; borderColor = '#a8d9a0' }
              else if (isDepositPending || isMeetingPending) { bg = '#FFF8E1'; borderColor = '#E65100' }
              else if (isPast) { bg = 'var(--g1)'; borderColor = 'var(--g2)' }
              else { bg = '#e8f5e0'; borderColor = 'var(--g3)' }
              return (
                <div key={b.id}
                  onClick={() => isDepositPending ? setDepositModal(b) : undefined}
                  style={{ background:bg, borderRadius:12, padding:'10px 14px', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between', border:`1.5px solid ${borderColor}`, cursor:isDepositPending?'pointer':'default' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>{b.class_name}{b.seat?` · ${b.seat}자리`:''}</span>
                      {isAttended
                        ? <span style={{ fontSize:9, fontWeight:700, background:'#C8E6C9', color:'#1B5E20', padding:'1px 6px', borderRadius:10, border:'1px solid #A5D6A7' }}>✓ 출석</span>
                        : (isDepositPending || isMeetingPending)
                          ? <span style={{ fontSize:9, fontWeight:700, background:'#FFF3CD', color:'#856404', padding:'1px 6px', borderRadius:10, border:'1px solid #FFD700' }}>입금 대기</span>
                          : isPast
                            ? <span style={{ fontSize:9, fontWeight:700, background:'var(--g1)', color:'var(--tmu)', padding:'1px 6px', borderRadius:10, border:'1px solid var(--g2)' }}>지난 수업</span>
                            : <span style={{ fontSize:9, fontWeight:700, background:'#EAF3DE', color:'#27500A', padding:'1px 6px', borderRadius:10, border:'1px solid #3B6D1133' }}>예약 확정</span>
                      }
                    </div>
                    <div style={{ fontSize:10, color:'var(--tm)' }}>{b.class_time}</div>
                    {isMeetingPending && <div style={{ fontSize:9, color:'#E65100', fontWeight:700, marginTop:2 }}>모임 확정 대기중</div>}
                    {isDepositPending && <div style={{ fontSize:9, color:'#856404', fontWeight:700, marginTop:2 }}>탭하여 입금 안내 보기</div>}
                  </div>
                  {cancellable && (
                    <button onClick={e => { e.stopPropagation(); handleCancel(b) }} style={{ fontSize:10, padding:'3px 10px', borderRadius:20, background:'var(--g1)', color:'var(--tm)', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>취소</button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ height:80 }}/>
      </div>

      <StudentNav active="schedule" />
    </>
  )
}
