'use client'
import { useState, useEffect, useRef, useId } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useTodayWeather } from '../../../components/WeatherBar'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import ProfileHeaderIcon from '../../../components/ProfileHeaderIcon'
import { sortCoursesByCategory } from '../../../lib/courseSort'
import { fetchLockedDates } from '../../../lib/lockedDates'
import { sendPushToAdmins } from '../../../lib/pushNotify'
import { sendKakaoToAdmins } from '../../../lib/kakaoNotify'
import { notifyAllAdmins } from '../../../lib/adminNotify'
import { applyTheme, isValidTheme } from '../../../lib/theme'
import MoodIndicator from '../../../components/MoodIndicator'
import LoadingCat from '../../../components/LoadingCat'
import GlassBg from '../../../components/GlassBg'
import { useFreshTheme } from '../../../lib/useFreshTheme'

const CAT_ICON = { drawing:'pencil', painting:'palette', sculpture:'box', oneday:'calendar', free:'photo', meeting:'users' }
const CAT_NAME = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', oneday:'원데이', free:'자율창작', meeting:'모임' }
const CAT_COLOR = { drawing:'#e8f5e0', painting:'#EDE7F6', sculpture:'#FFF3E0', free:'#E3F2FD', meeting:'#FFF8E1' }
const CAT_TEXT = { drawing:'var(--g5)', painting:'#4A148C', sculpture:'#E65100', oneday:'#AD1457', free:'#0D47A1', meeting:'#F57F17' }

const DEPOSIT = { bank: '국민은행', account: '392801-04-209666', holder: '양승민 (2호선스튜디오)' }

const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'
const CARD = 'var(--card)'
const BORDER = 'var(--line)'

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
function findNextOpenDate(course, lockedDates) {
  const now = new Date()
  for (let i = 0; i < 70; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const dow = d.getDay()
    if (dow === 1) continue
    if (!course.class_schedules?.some(s => s.day_of_week === dow)) continue
    if (course.class_exceptions?.some(e => e.day_of_week === dow)) continue
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (lockedDates?.has(ds)) continue  // 잠긴 날짜는 건너뜀
    if (!course.is_unlimited) {
      if (course.start_date && ds < course.start_date) continue
      if (course.end_date && ds > course.end_date) continue
    }
    return d
  }
  return null
}

export default function CalendarPage() {
  const router = useRouter()
  const todayWeather = useTodayWeather()
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [meetingTickets, setMeetingTickets] = useState([])
  const [bookings, setBookings] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [classes, setClasses] = useState([])
  const [lockedDates, setLockedDates] = useState(new Set())
  const [curriculumNames, setCurriculumNames] = useState(new Set())
  const [pendingCourse, setPendingCourse] = useState(null)
  const deepLinkApplied = useRef(false)
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [animDay, setAnimDay] = useState(null)
  const [selCat, setSelCat] = useState(null)
  const [selCourse, setSelCourse] = useState(null)
  const [selSchedule, setSelSchedule] = useState(null)
  const [onedayInfoOpen, setOnedayInfoOpen] = useState(true) // 원데이 신청 시 가격·입금 안내 토글(기본 펼침)
  const [paymentModal, setPaymentModal] = useState(null)
  const [selectedCount, setSelectedCount] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSlot, setSheetSlot] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [depositModal, setDepositModal] = useState(null)
  const [moodStyle, setMoodStyle] = useState('cup')
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

  // 홈 날짜 스트립 딥링크 (?date=YYYY-MM-DD)
  useEffect(() => {
    const ds = new URLSearchParams(window.location.search).get('date')
    if (!ds) return
    const d = new Date(ds + 'T00:00:00')
    if (isNaN(d)) return
    setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(d.getDate())
  }, [])

  useEffect(() => {
    if (!pendingCourse || deepLinkApplied.current || classes.length === 0) return
    deepLinkApplied.current = true
    const course = classes.find(c => c.name === pendingCourse)
    if (!course) return
    const d = findNextOpenDate(course, lockedDates)
    if (!d) return
    setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(d.getDate())
    setSelCat(course.category); setSelCourse(course); setSelSchedule(null)
  }, [pendingCourse, classes])

  // 최초 로드: 딥링크가 없으면 오늘 날짜의 첫 수업 시간표까지 자동으로 펼침
  useEffect(() => {
    if (classes.length === 0 || pendingCourse || selCat || selCourse) return
    autoSelectFirst(selectedDay)
  }, [classes])

  async function loadData(userId) {
    if (userId) {
      const { data: t } = await supabase.from('tickets').select('*').eq('user_id', userId).single()
      setTicket(t)
      const { data: b } = await supabase.from('bookings').select('*').eq('user_id', userId).neq('status', 'cancelled')
      setBookings(b || [])
      const { data: ab } = await supabase.from('bookings').select('course_id, schedule_id, class_date, class_time').eq('status', 'booked')
      setAllBookings(ab || [])
      const { data: profile } = await supabase.from('users').select('name').eq('id', userId).single()
      setProfileName(profile?.name || '')
      const { data: pref } = await supabase.from('user_prefs').select('*').eq('user_id', userId).single()
      setMoodStyle(pref?.mood_style || 'cup')
      // 계정에 저장된 테마가 있으면 기기 저장값보다 우선 (기기 간 동기화)
      if (isValidTheme(pref?.theme)) applyTheme(pref.theme)
      const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', userId).eq('status', 'confirmed').gt('remain', 0).gte('expires_at', new Date().toISOString().split('T')[0])
      setMeetingTickets(mt || [])
    }
    // 공개 데이터: 로그인 여부와 무관하게 수업/스케줄/예외 로드 (관리자 예외·운영기간 반영)
    const { data: c } = await supabase.from('class_courses').select('*, class_schedules(*), class_exceptions(*)').eq('is_active', true)
    setClasses(c || [])
    setLockedDates(await fetchLockedDates())
    const { data: cur } = await supabase.from('course_curriculum').select('course_name')
    setCurriculumNames(new Set((cur || []).map(r => r.course_name).filter(Boolean)))
    setLoading(false)
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
    if (lockedDates.has(dateStr)) return false  // 관리자 날짜 잠금 → 그날 예약 불가
    if (!c.class_schedules?.some(s => s.day_of_week === dow)) return false
    if (c.class_exceptions?.some(e => e.day_of_week === dow)) return false
    if (!c.is_unlimited) {
      if (c.start_date && dateStr < c.start_date) return false
      if (c.end_date && dateStr > c.end_date) return false
    }
    return true
  }

  function dayClasses(day) {
    // 카테고리 순(드로잉→페인팅→조소→자율창작→모임) 정렬
    return sortCoursesByCategory(classes.filter(c => courseOpenOnDay(c, day)))
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

  // 같은 날짜+시간대(start~end)의 모든 일반수업 예약을 합산 — 5개 수업이 물리 5자리를 공유하므로
  // 한 수업 예약이 같은 시간의 다른 수업 자리도 차감한다. (자율창작·모임은 별도라 제외)
  function sharedSlotCountByDate(dateStr, startTime, endTime) {
    const slot = `${startTime}~${endTime}`
    const excluded = new Set(classes.filter(c => c.category === 'free' || c.category === 'meeting' || c.category === 'oneday').map(c => c.id))
    return allBookings.filter(b => b.class_date === dateStr && b.class_time === slot && !excluded.has(b.course_id)).length
  }
  function sharedSlotCount(day, startTime, endTime) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return sharedSlotCountByDate(dateStr, startTime, endTime)
  }

  // 달력 셀 예약 신호: 'open'(여유 슬롯 있음) | 'full'(다 참) | null(수업 없음)
  function dayAvailability(day) {
    const cls = dayClasses(day)
    if (!cls.length) return null
    for (const c of cls) {
      if (c.category === 'free' || c.category === 'meeting' || c.category === 'oneday') return 'open'
      for (const s of getSchedulesForDay(c, day)) {
        if (sharedSlotCount(day, s.start_time, s.end_time) < (c.max_count || 999)) return 'open'
      }
    }
    return 'full'
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
    autoSelectFirst(d)   // 첫 카테고리·첫 수업 자동 펼침(시간표까지)
    setAnimDay(d)
    spawnParticles(cellRefs.current[d])
    setTimeout(() => setAnimDay(null), 500)
  }

  // 그날 첫 카테고리(자율창작 제외)의 첫 수업을 자동 선택 → 시간표까지 바로 보이게
  function autoSelectFirst(d) {
    const first = dayClasses(d).find(c => c.category !== 'free') // dayClasses는 카테고리 순 정렬됨
    if (first) { setSelCat(first.category); setSelCourse(first); setSelSchedule(null) }
    else { setSelCat(null); setSelCourse(null); setSelSchedule(null) }
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
    if (lockedDates.has(dateStr)) return false
    const todayStr = `${todayY}-${String(todayM+1).padStart(2,'0')}-${String(todayD).padStart(2,'0')}`
    if (dateStr < todayStr) return false
    const diff = monthDiff()
    if (diff > 1) return false
    return true
  }

  async function execBook(course, schedule, dateStr) {
    // 예약 직전 같은 시간대 실시간 확인 — 다른 수업 포함 5자리가 이미 찼으면 막음
    const slot = `${schedule.start_time}~${schedule.end_time}`
    const excluded = new Set(classes.filter(c => c.category === 'free' || c.category === 'meeting' || c.category === 'oneday').map(c => c.id))
    const { data: live } = await supabase.from('bookings').select('course_id, class_time').eq('status', 'booked').eq('class_date', dateStr)
    const taken = (live || []).filter(b => b.class_time === slot && !excluded.has(b.course_id)).length
    if (taken >= (course.max_count || 999)) {
      alert('이 시간대 자리가 방금 마감됐어요. 다른 시간을 선택해 주세요 🐾')
      setSelSchedule(null); loadData(user.id); return
    }
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
    await notifyAllAdmins({ type: 'booking_created', title: '새 예약', body: pushMsg, related_id: newBooking?.id })
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
    await notifyAllAdmins({ type: 'booking_request', title: '📩 수업 예약 요청 (수강권 확인 필요)', body: `${nm}님이 ${course.name} 예약을 요청했어요.\n일시: ${when}\n연락처: ${phone}\n수강권이 없거나 소진된 상태예요. 확인 후 안내해 주세요.` })
    sendPushToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} · 연락처 ${phone}`)
    sendKakaoToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} / 연락처 ${phone}`)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    alert('예약 요청이 접수됐어요! 강사님이 확인 후 연락드릴게요 🐾')
  }

  // 원데이 신청 — 수강권 불필요, 계약금 입금 대기(confirmed:false)로 예약 생성 후 관리자 알림
  async function bookOneday(course, schedule, dateStr) {
    const slot = `${schedule.start_time}~${schedule.end_time}`
    const excluded = new Set(classes.filter(c => c.category === 'free' || c.category === 'meeting' || c.category === 'oneday').map(c => c.id))
    const { data: live } = await supabase.from('bookings').select('course_id, class_time').eq('status', 'booked').eq('class_date', dateStr)
    const taken = (live || []).filter(b => b.class_time === slot && b.course_id === course.id).length
    if (taken >= (course.max_count || 999)) { alert('자리가 방금 마감됐어요 🐾'); setSelSchedule(null); loadData(user.id); return }
    const { data: nb } = await supabase.from('bookings').insert({
      user_id: user.id, course_id: course.id, schedule_id: schedule.id,
      class_name: course.name, class_date: dateStr, class_time: slot,
      teacher: course.teacher, status: 'booked', confirmed: false, amount: course.price || 0,
    }).select().single()
    const { data: profile } = await supabase.from('users').select('name, phone').eq('id', user.id).single()
    const nm = profile?.name || profileName || '학생'
    const msg = `${nm}님이 원데이 "${course.name}" ${dateStr} ${schedule.start_time} 신청. 금액 ${(course.price || 0).toLocaleString()}원. 입금 확인 후 확정 필요. 연락처 ${profile?.phone || '미등록'}`
    await notifyAllAdmins({ type: 'meeting_pending', title: '원데이 신청 (입금 대기)', body: msg, related_id: nb?.id })
    sendPushToAdmins('🎨 원데이 신청', msg)
    sendKakaoToAdmins('🎨 원데이 신청', msg)
    setSelCat(null); setSelCourse(null); setSelSchedule(null)
    alert('원데이 신청 완료! 계약금 입금 확인 후 확정됩니다 🐾')
    loadData(user.id)
  }

  async function handleBook() {
    if (!user) { router.push('/signup'); return }
    if (!selCourse || !selSchedule) return
    const lockStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    if (lockedDates.has(lockStr)) { alert('이 날은 예약이 닫혀 있어요 🐾'); return }

    if (selCourse.category === 'meeting') {
      const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', user.id).eq('status', 'confirmed').gt('remain', 0).gte('expires_at', new Date().toISOString().split('T')[0]).limit(1)

      if (mt && mt.length > 0) {
        await handleMeetingBookWithTicket(mt[0])
        return
      }

      setPaymentModal({ course: selCourse, schedule: selSchedule })
      return
    }

    // 원데이: 수강권 없이 계약금 입금 신청 → confirmed:false 로 예약 생성(관리자 입금 페이지에서 확정)
    if (selCourse.category === 'oneday') {
      await bookOneday(selCourse, selSchedule, `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`)
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
    await notifyAllAdmins({ type: 'meeting_pending', title: '모임 참여권 신청 (입금 대기)', body: `${profile?.name || '학생'}님이 ${course.name} ${selectedCount}회권 신청. 금액: ${((course.price || 0) * selectedCount).toLocaleString()}원. 입금 확인 후 확정 처리 필요.`, related_id: newBooking?.id })

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
    await notifyAllAdmins({ type: 'booking_cancelled', title: '예약 취소', body: `${profile?.name || '학생'}님이 ${booking.class_name} ${booking.class_date} ${booking.class_time} 취소` })

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
      if (sharedSlotCountByDate(dateStr, s.start_time, s.end_time) >= (course.max_count || 999)) return
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
  const selDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
  const selLocked = lockedDates.has(selDateStr)

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
        const isFull = sharedSlotCountByDate(next.dateStr, schedule.start_time, schedule.end_time) >= (course.max_count || 999)
        const chips = getSameWeekSlots(course, schedule.id, next.dateStr)
        return { course, schedule, next, isFull, chips }
      })
      .filter(Boolean)
  })()
  const showQuickBook = habitSlots.length > 0

  const fresh = useFreshTheme()

  if (loading) return <LoadingCat />

  return (
    <>
      {fresh && <GlassBg />}
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
            <div style={{ background:'var(--surf)', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
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
                style={{ flex:1, padding:'11px', background:'var(--acBg)', color:'var(--acTx)', border:'1px solid rgb(var(--ac-rgb) / 0.2)', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
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
                국민은행<br/>392801-04-209666<br/>예금주: 양승민 (2호선스튜디오)
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
                      style={{ padding:'8px 14px', borderRadius:20, background:ACCENT_BG, color:ACCENT_TEXT, border:`1.5px solid rgb(var(--ac-rgb) / 0.33)`, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
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


      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="calendar" color="var(--ac)" size={20} />
          <span className="p-title">캘린더</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {!user && (
            <button onClick={()=>router.push('/login')} className="p-chip p-chip--sm">로그인 / 가입</button>
          )}
          <ProfileHeaderIcon />
        </div>
      </div>

      <div style={{ background: fresh ? 'transparent' : '#fff', padding:'8px 14px 0' }}>

        {user && (() => {
          if (upcomingBookings.length > 0) {
            const b = upcomingBookings[0]
            const d = new Date(b.class_date + 'T00:00:00')
            const dow = ['일','월','화','수','목','금','토'][d.getDay()]
            const mmdd = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
            const isPending = b.confirmed === false
            return (
              <div style={{ marginBottom:16, background:isPending?'#FFF8E1':ACCENT_BG, borderRadius:14, padding:'10px 14px', border:`1.5px solid ${isPending?'#E6510055':'rgb(var(--ac-rgb) / 0.33)'}`, display:'flex', alignItems:'center', gap:8 }}>
                <div onClick={() => isPending ? setDepositModal(b) : navigateToDate(b.class_date)} style={{ flex:1, minWidth:0, cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:1 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--tmu)' }}>다음 수업</span>
                    {b.attended === true
                      ? <span style={{ fontSize:9, fontWeight:700, background:'#C8E6C9', color:'#1B5E20', padding:'1px 6px', borderRadius:10, border:'1px solid #A5D6A7' }}>✓ 출석</span>
                      : isPending
                        ? <span style={{ fontSize:9, fontWeight:700, background:'#FFF3CD', color:'#856404', padding:'1px 6px', borderRadius:10, border:'1px solid #FFD700' }}>입금 대기</span>
                        : <span style={{ fontSize:9, fontWeight:700, background:'var(--acBg)', color:'var(--acTx)', padding:'1px 6px', borderRadius:10, border:'1px solid rgb(var(--ac-rgb) / 0.2)' }}>예약 확정</span>
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
            const dLockStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            const isLocked = lockedDates.has(dLockStr)

            return (
              <div key={d} ref={el => cellRefs.current[d] = el} onClick={()=>handleDayClick(d)} style={{ height:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:isMon?'default':'pointer', borderRadius:12, opacity:isMon?0.3:(isLocked?0.6:1), position:'relative', background:isSel?'var(--ac2)':'transparent', border:isSel?'2px solid var(--ac)':'2px solid transparent' }}>
                {isT && todayWeather && (
                  <div style={{ position:'absolute', top:-2, left:'50%', transform:'translateX(-50%)', fontSize:13, zIndex:1 }}>{todayWeather.icon}</div>
                )}
                {isLocked && <span style={{ position:'absolute', bottom:1, right:4, fontSize:10, zIndex:1 }} title="예약 잠금">🔒</span>}
                {(() => {
                  if (isMon || isLocked || dLockStr < todayStr) return null
                  const av = dayAvailability(d)
                  if (!av) return null
                  return <span style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', width:5, height:5, borderRadius:'50%', zIndex:1,
                    background: av === 'open' ? '#3b6d11' : 'transparent', border: av === 'open' ? 'none' : '1.5px solid #c9b9a0', boxSizing:'border-box' }} title={av === 'open' ? '예약 가능' : '마감'} />
                })()}
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


        {!user ? null : (
        <div className="g-glass" style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid var(--g2)' }}>
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
          <div onClick={() => router.push('/student/settings')} style={{ marginLeft:12, cursor:'pointer' }} title="개인 설정">
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

        {!selLocked && (
        <div className="g-glass" onClick={()=>router.push(`/student/free?date=${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`)} style={{ background:'var(--surf)', borderRadius:14, padding:'14px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', border:'1.5px solid var(--g2)', cursor:'pointer' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700, marginBottom:2 }}>🎨 자율창작</div>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:2 }}>1시간만, 자유롭게</div>
            <div style={{ fontSize:10, color:'#A89880' }}>평일 낮 6,000원부터</div>
          </div>
          <div style={{ fontSize:18, color:'var(--tm)' }}>›</div>
        </div>
        )}

        <div style={{ fontSize:12, fontWeight:800, color:'var(--td)', marginBottom:10 }}>{month+1}월 {selectedDay}일 수업</div>

        {selLocked ? (
          <div style={{ textAlign:'center', padding:'22px 20px', color:'var(--tmu)', fontSize:12, background:'var(--g1)', borderRadius:14, border:'1.5px solid var(--g2)' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>🔒</div>
            이 날은 예약이 닫혀 있어요
          </div>
        ) : dc.length === 0 ? (
          <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>이날은 수업이 없어요 🐾</div>
        ) : (
          <>
            {!(cats.length === 1 && cats[0] === 'free') && (() => {
              // 예약 단계 표시 — 종류 → 수업 → 시간 (지금 어디인지 한눈에)
              const steps = [{ n:'종류', done:!!selCat }, { n:'수업', done:!!selCourse }, { n:'시간', done:!!selSchedule }]
              const dot = (st, i) => {
                const active = !st.done && steps.slice(0, i).every(x => x.done)
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, boxSizing:'border-box', background: st.done?ACCENT:active?ACCENT_BG:'var(--g1)', color: st.done?'#fff':active?ACCENT_TEXT:'var(--tmu)', border: active && !st.done ? `1.5px solid ${ACCENT}` : 'none' }}>{st.done ? '✓' : i + 1}</span>
                    <span style={{ fontSize:11, fontWeight:700, color: st.done || active ? ACCENT_TEXT : 'var(--tmu)' }}>{st.n}</span>
                  </div>
                )
              }
              return (
                <div className="slide-up" style={{ display:'flex', alignItems:'center', gap:6, margin:'0 2px 14px' }}>
                  {dot(steps[0], 0)}
                  <span style={{ flex:1, height:2, borderRadius:2, background: steps[0].done ? ACCENT : 'var(--g2)' }} />
                  {dot(steps[1], 1)}
                  <span style={{ flex:1, height:2, borderRadius:2, background: steps[1].done ? ACCENT : 'var(--g2)' }} />
                  {dot(steps[2], 2)}
                </div>
              )
            })()}

            {cats.length > 1 && (
              <div className="slide-up" style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수업 종류</div>
                <div style={{ display:'flex', gap:7 }}>
                  {cats.map(cat => {
                    const on = selCat === cat
                    return (
                      <div key={cat} onClick={() => {
                        if (cat === 'free') { router.push(`/student/free?date=${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`); return }
                        setSelCat(cat); setSelCourse(null); setSelSchedule(null)
                      }} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'9px 8px', borderRadius:20, cursor:'pointer', background: on ? ACCENT_BG : CARD, border:`1.5px solid ${on ? ACCENT : 'rgba(0,0,0,0.08)'}` }}>
                        <NavIcon name={CAT_ICON[cat] || 'palette'} color={on ? ACCENT_TEXT : '#4a5a4e'} size={16} />
                        <span style={{ fontSize:12, fontWeight: on ? 800 : 600, color: on ? ACCENT_TEXT : 'var(--td)' }}>{CAT_NAME[cat]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {cats.length === 1 && cats[0] === 'free' && (
              <div className="g-glass" onClick={()=>router.push(`/student/free?date=${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`)} style={{ padding:'14px 16px', background:'var(--surf)', borderRadius:14, border:'1.5px solid var(--g2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>🎨 자율창작 예약하러 가기</div>
                  <div style={{ fontSize:10, color:'var(--tm)', marginTop:2 }}>자리와 시간을 직접 선택해요</div>
                </div>
                <div style={{ fontSize:18, color:'var(--tm)' }}>›</div>
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
                    <div key={c.id} className={isOpen ? '' : 'g-glass'} style={{ borderRadius:14, marginBottom:8, overflow:'hidden', border:`1px solid ${isOpen?ACCENT:'rgba(0,0,0,0.08)'}`, background:isOpen?ACCENT_BG:CARD }}>
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
                        <div style={{ borderTop:`1px solid rgb(var(--ac-rgb) / 0.16)`, padding:'6px 12px 12px' }}>
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
                            // 원데이는 독립 좌석(수업별), 정규 수업은 같은 시간대 5자리 공유
                            const cnt = c.category === 'oneday'
                              ? allBookings.filter(b => b.course_id === c.id && b.class_date === `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}` && b.class_time === `${s.start_time}~${s.end_time}`).length
                              : sharedSlotCount(selectedDay, s.start_time, s.end_time)
                            const remain = c.max_count - cnt
                            const full = remain <= 0 && !booked
                            const isSel = selSchedule?.id === s.id
                            const hh = parseInt(s.start_time.slice(0, 2), 10)
                            const tod = hh < 12 ? '오전' : hh < 17 ? '오후' : '저녁'
                            const segs = Math.min(c.max_count || 5, 5)
                            const litN = Math.max(0, Math.min(segs, remain))
                            const meterOn = remain <= 1 ? '#ba7517' : '#63991f'
                            return (
                              <div key={s.id}
                                onClick={() => { if (!full && !booked) setSelSchedule(isSel ? null : s) }}
                                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 13px', borderRadius:13, marginBottom:7, background:booked?'#E8F5E0':isSel?'#f2f8ea':'#fff', border:`${isSel?2:1}px solid ${booked?'#a8d9a0':isSel?ACCENT:'rgba(0,0,0,0.08)'}`, cursor:full||booked?'default':'pointer', opacity:full?0.5:1 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, boxSizing:'border-box', background:booked?'#6db870':isSel?ACCENT:'transparent', border:`2px solid ${booked?'#6db870':isSel?ACCENT:BORDER}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    {(booked||isSel) && <svg width="10" height="8" viewBox="0 0 9 7"><polyline points="1,3.5 3,6 8,1" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </div>
                                  <div>
                                    <div style={{ fontSize:14, fontWeight:600, color:isSel?ACCENT_TEXT:'var(--td)' }}>{s.start_time}~{s.end_time}</div>
                                    <div style={{ fontSize:10.5, color:'var(--tmu)', marginTop:1 }}>{tod}</div>
                                  </div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div style={{ textAlign:'right' }}>
                                    {!booked && (
                                      <div style={{ display:'flex', gap:2, justifyContent:'flex-end', marginBottom:3 }}>
                                        {Array.from({ length: segs }).map((_, k) => (
                                          <span key={k} style={{ width:8, height:6, borderRadius:2, background: k < litN ? meterOn : (full ? 'var(--g2)' : '#dfe6d5') }} />
                                        ))}
                                      </div>
                                    )}
                                    <div style={{ fontSize:11, fontWeight:700, color:booked?'#6db870':full?'#9b9b8a':remain<=1?'#c0392b':'#3b6d11' }}>
                                      {booked ? (booking?.attended === true ? '출석' : '예약됨') : full ? '마감' : remain<=1 ? '마감 임박 · 1자리' : `${remain}자리 남음`}
                                    </div>
                                  </div>
                                  {booked && canCancel(booking) && (
                                    <button onClick={e=>{e.stopPropagation();handleCancel(booking)}}
                                      style={{ fontSize:10, padding:'4px 9px', borderRadius:20, background:'rgba(255,255,255,0.85)', color:'var(--tm)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:500, flexShrink:0 }}>
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

            {selCourse?.category === 'oneday' && selSchedule && (
              <div className="slide-up" style={{ marginBottom:14, borderRadius:14, border:'1.5px solid #f6c7d6', background:'#FCE4EC', overflow:'hidden' }}>
                <div onClick={() => setOnedayInfoOpen(o => !o)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', cursor:'pointer' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, fontWeight:800, color:'#AD1457' }}>
                    <NavIcon name="calendar" color="#AD1457" size={15} /> 가격 · 입금 안내
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'#AD1457' }}>{(selCourse.price || 0).toLocaleString()}원</span>
                    <span style={{ fontSize:13, color:'#AD1457', transform:onedayInfoOpen?'rotate(180deg)':'none', transition:'transform 0.2s', display:'inline-block' }}>▾</span>
                  </span>
                </div>
                {onedayInfoOpen && (
                  <div style={{ padding:'2px 14px 12px' }}>
                    <div style={{ fontSize:11, color:'var(--tm)', fontWeight:600, marginBottom:8, lineHeight:1.6 }}>
                      수강권 없이 <b style={{ color:'#AD1457' }}>계약금 입금</b>으로 신청해요. 아래 계좌로 <b>입금자명</b>을 넣어 보내주세요.
                    </div>
                    <div style={{ background:'#fff', borderRadius:10, border:'1px solid #f6c7d6', padding:'9px 11px', marginBottom:8 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:3 }}>입금 계좌</div>
                      <div style={{ fontSize:12.5, fontWeight:800, color:'var(--td)', lineHeight:1.5 }}>{DEPOSIT.bank} {DEPOSIT.account}<br/>예금주 {DEPOSIT.holder}</div>
                    </div>
                    <div style={{ fontSize:10.5, color:'var(--tmu)', fontWeight:600, lineHeight:1.6 }}>
                      · 24시간 내 미입금 시 자동 취소돼요.<br/>· 입금 확인 후 예약이 확정됩니다.
                    </div>
                  </div>
                )}
              </div>
            )}

            {selSchedule && !isBooked(selCourse?.id, selSchedule?.id, selectedDay) && (
              isBookable(selectedDay) ? (
                <>
                  <div style={{ height:78 }} />
                  <div style={{ position:'fixed', left:'50%', transform:'translateX(-50%)', bottom:64, width:'100%', maxWidth:390, padding:'8px 14px', boxSizing:'border-box', zIndex:80, pointerEvents:'none' }}>
                    <button onClick={handleBook}
                      style={{ pointerEvents:'auto', width:'100%', padding:'15px 20px', background:ACCENT, color:'#fff', border:'none', borderRadius:14, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'0 8px 22px -6px rgba(0,0,0,0.35)' }}>
                      {!user
                        ? '가입하고 예약하기'
                        : selCourse?.category === 'oneday'
                          ? `원데이 신청 · ${(selCourse?.price || 0).toLocaleString()}원 (계약금 입금)`
                          : (selCourse?.category === 'meeting' || hasValidTicket())
                            ? `${selCourse?.name} ${selSchedule?.start_time}~${selSchedule?.end_time} 예약하기`
                            : '예약 요청하기 (수강권 확인 필요)'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="slide-up" style={{ marginBottom:14 }}>
                  <div style={{ padding:'14px', background:CARD, borderRadius:14, textAlign:'center', color:'var(--tmu)', fontSize:12, fontWeight:500 }}>{monthDiff() < 0 ? '지난 날짜는 예약할 수 없어요' : '예약은 다음 달까지만 가능해요'}</div>
                </div>
              )
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
                            : <span style={{ fontSize:9, fontWeight:700, background:'var(--acBg)', color:'var(--acTx)', padding:'1px 6px', borderRadius:10, border:'1px solid rgb(var(--ac-rgb) / 0.2)' }}>예약 확정</span>
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

      <StudentNav active="calendar" />
    </>
  )
}
