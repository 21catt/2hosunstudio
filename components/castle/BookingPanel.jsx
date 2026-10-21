'use client'
// 3D 홈(/castle) 예약 패널 — 장면 위에 반투명 유리로 뜬다(2026-10-19 시안 확정).
// 예약 규칙은 새로 만들지 않는다: 홈 날짜 스트립의 빠른 예약(app/student/page.js quickBook)과 같은 함수·같은 판정을 쓴다.
//   예약 = lib/booking bookClass(수강권 차감 → 예약 행) · 수강권 없음 = requestBookingApproval(운영진에게 요청만)
//   취소 = cancelBooking(홈 askCancel 과 같은 시간 규칙) · 잠긴 날짜·시간 = lib/lockedDates · 4시간 전 마감 = lib/bookingWindow
//   자리 = 같은 날짜·시간의 일반 수업 예약 합(자율창작·모임·원데이 제외)과 수업 max_count 비교 — 홈과 같다
//   원데이(계약금 입금)·모임(참여권 결제)·자율창작(자리 고르기)은 각자 화면이 따로 있어 그쪽으로 이어 준다
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { sortCoursesByCategory } from '../../lib/courseSort'
import { fetchLockedDates, fetchLockedSlots, slotLocked } from '../../lib/lockedDates'
import { isTooLateToBook, bookingCutoffMessage } from '../../lib/bookingWindow'
import { bookClass, requestBookingApproval, hasValidTicket, cancelBooking, ticketStarted } from '../../lib/booking'
import { catStyle } from '../../lib/categoryStyle'
import b from './booking.module.css'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const part = t => { const h = +String(t || '0').slice(0, 2); return h < 12 ? '오전' : h < 18 ? '오후' : '저녁' }

export default function BookingPanel({ user, initialDate, onClose, onBooked }) {
  const todayStr = ymd(new Date())
  const [date, setDate] = useState(initialDate || todayStr)
  const [classes, setClasses] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [mine, setMine] = useState([])
  const [ticket, setTicket] = useState(null)
  const [lockedDates, setLockedDates] = useState(new Set())
  const [lockedSlots, setLockedSlots] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState(null)
  const [courseId, setCourseId] = useState(null)
  const [slotId, setSlotId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  async function load() {
    const uid = user?.id
    const [c, all, my, t, ld, ls] = await Promise.all([
      supabase.from('class_courses').select('*, class_schedules(*), class_exceptions(*)').eq('is_active', true),
      supabase.from('bookings').select('course_id, schedule_id, class_date, class_time').eq('status', 'booked'),
      uid ? supabase.from('bookings').select('*').eq('user_id', uid).neq('status', 'cancelled') : Promise.resolve({ data: [] }),
      uid ? supabase.from('tickets').select('*').eq('user_id', uid).maybeSingle() : Promise.resolve({ data: null }),
      fetchLockedDates(),
      fetchLockedSlots(),
    ])
    setClasses(c.data || [])
    setAllBookings(all.data || [])
    setMine(my.data || [])
    setTicket(t.data || null)
    setLockedDates(ld || new Set())
    setLockedSlots(ls || new Set())
    setLoading(false)
  }
  useEffect(() => { load() }, [user?.id])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 2주 날짜 줄
  const days = useMemo(() => {
    const out = [], base = new Date()
    for (let i = 0; i < 14; i++) { const d = new Date(base); d.setDate(base.getDate() + i); out.push({ key: ymd(d), dow: DOW[d.getDay()], num: d.getDate(), today: i === 0 }) }
    return out
  }, [])

  // 그날 열리는 수업 — 홈 coursesOn 과 같은 규칙(잠긴 날짜·예외 요일·운영 기간)
  function coursesOn(ds) {
    if (lockedDates.has(ds)) return []
    const dow = new Date(ds + 'T00:00:00').getDay()
    return sortCoursesByCategory(classes.filter(c => {
      if (!c.class_schedules?.some(s => s.day_of_week === dow)) return false
      if (c.class_exceptions?.some(e => e.day_of_week === dow)) return false
      if (!c.is_unlimited) {
        if (c.start_date && ds < c.start_date) return false
        if (c.end_date && ds > c.end_date) return false
      }
      return true
    }))
  }
  function schedulesFor(c, ds) {
    const dow = new Date(ds + 'T00:00:00').getDay(), seen = new Set()
    return (c.class_schedules || []).filter(s => s.day_of_week === dow).filter(s => {
      const k = `${s.start_time}-${s.end_time}`; if (seen.has(k)) return false; seen.add(k); return true
    }).sort((x, y) => x.start_time.localeCompare(y.start_time))
  }
  function seatCount(s, ds) {
    const slot = `${s.start_time}~${s.end_time}`
    const excluded = new Set(classes.filter(x => x.category === 'free' || x.category === 'meeting' || x.category === 'oneday').map(x => x.id))
    return allBookings.filter(x => x.class_date === ds && x.class_time === slot && !excluded.has(x.course_id)).length
  }
  const myBookingFor = (c, s, ds) => mine.find(x => x.course_id === c.id && x.schedule_id === s.id && x.class_date === ds)

  const list = coursesOn(date)
  const cats = [...new Set(list.map(c => c.category))]
  const curCat = cats.includes(cat) ? cat : cats[0] || null
  const catCourses = list.filter(c => c.category === curCat)
  const course = catCourses.find(c => c.id === courseId) || catCourses[0] || null
  const slots = course ? schedulesFor(course, date) : []

  function slotState(s) {
    const m = myBookingFor(course, s, date)
    if (m) return { kind: 'mine', text: '예약됨 · 눌러서 취소', booking: m }
    if (isTooLateToBook(date, s.start_time)) return { kind: 'closed', text: '예약 마감' }
    if (slotLocked(lockedDates, lockedSlots, date, s.id)) return { kind: 'closed', text: '예약 마감', lock: true }
    const cnt = seatCount(s, date), max = course.max_count || null
    if (max && cnt >= max) return { kind: 'full', text: '마감' }
    if (!max) return { kind: 'open', text: '예약 가능' }
    const left = max - cnt
    return { kind: 'open', text: left === 1 ? '마감 임박 · 1자리' : `${left}자리 남음`, left, max }
  }
  const slot = slots.find(s => s.id === slotId && slotState(s).kind === 'open') || null
  const validTicket = hasValidTicket(ticket, todayStr)

  function pickDate(ds) { setDate(ds); setCat(null); setCourseId(null); setSlotId(null); setNote(null) }
  function pickCat(c) { setCat(c); setCourseId(null); setSlotId(null); setNote(null) }

  async function book() {
    if (!slot || !course || busy) return
    if (!user) { window.location.href = `/student/calendar?date=${date}`; return }
    if (isTooLateToBook(date, slot.start_time)) { alert(bookingCutoffMessage(date, slot.start_time)); return }
    if (slotLocked(lockedDates, lockedSlots, date, slot.id)) { alert('이 시간은 예약이 닫혀 있어요 🐾'); return }
    setBusy(true)
    try {
      if (validTicket) {
        const ok = await bookClass({ user, ticket, course, schedule: slot, dateStr: date })
        if (ok) { setNote(`${course.name} ${slot.start_time}~${slot.end_time} 예약됐어요 🐾`); onBooked?.() }
      } else {
        await requestBookingApproval({ user, course, schedule: slot, dateStr: date })
        setNote(ticket && !ticketStarted(ticket, todayStr)
          ? `수강권은 ${ticket.start_date}부터 쓸 수 있어요. 그때까지는 예약 요청으로 접수돼요 🐾`
          : '예약 요청이 접수됐어요! 강사님이 확인 후 연락드릴게요 🐾')
      }
      setSlotId(null)
      await load()
    } finally { setBusy(false) }
  }

  async function cancel(booking) {
    if (booking.attended === true) { alert('출석 완료된 수업은 취소할 수 없어요.'); return }
    const gs = (booking.class_time || '00:00').split('~')[0]
    if (new Date() >= new Date(`${booking.class_date}T${gs}:00`)) { alert('지난 수업은 취소할 수 없어요.'); return }
    if ((new Date(booking.class_date) - new Date()) / 3600000 < 4) { alert('수업 4시간 전에는 취소할 수 없어요.'); return }
    if (!confirm(`${booking.class_name} ${booking.class_time} 예약을 취소할까요?`)) return
    setBusy(true)
    try { await cancelBooking({ user, ticket, booking }); setNote('예약을 취소했어요.'); await load(); onBooked?.() }
    finally { setBusy(false) }
  }

  const st = catStyle(curCat)
  const d = new Date(date + 'T00:00:00')
  const dateTitle = `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`
  const step = slot ? 3 : course ? 2 : curCat ? 1 : 0

  return (
    <section className={b.panel} aria-label="예약하기" role="dialog">
      <div className={b.handle} />
      <div className={b.head}>
        <div>
          <div className={b.eyebrow}>예약하기</div>
          <div className={b.title}>{dateTitle}</div>
        </div>
        <button className={b.close} aria-label="예약 닫기" onClick={onClose}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className={b.days} role="listbox" aria-label="날짜">
        {days.map(x => {
          const open = coursesOn(x.key).length > 0
          const on = x.key === date
          return (
            <button key={x.key} data-no-tap role="option" aria-selected={on} className={`${b.day} ${on ? b.dayOn : ''}`} onClick={() => pickDate(x.key)}>
              <span className={b.dayDow}>{x.today ? '오늘' : x.dow}</span>
              <span className={b.dayNum}>{x.num}</span>
              <span className={b.dayDot} style={{ background: open ? (on ? '#8fe0b4' : '#4aa877') : 'transparent' }} />
            </button>
          )
        })}
      </div>

      <div className={b.steps} aria-hidden="true">
        {['종류', '수업', '시간'].map((t, i) => (
          <span key={t} className={b.step} style={{ color: step > i ? '#2b2433' : undefined }}>
            <span className={b.stepDot} style={step > i ? { background: '#2b2433', borderColor: '#2b2433' } : null} />{t}
            {i < 2 && <span className={b.stepLine} />}
          </span>
        ))}
      </div>

      <div className={b.body}>
        {loading ? <div className={b.muted}>수업을 불러오는 중…</div>
        : list.length === 0 ? <div className={b.empty}>이날은 수업이 없어요 🐾</div>
        : (<>
          <div className={b.label}>수업 종류</div>
          <div className={b.chips}>
            {cats.map(c => {
              const cs = catStyle(c), on = c === curCat
              return (
                <button key={c} className={b.chip} aria-pressed={on}
                  style={{ background: `linear-gradient(160deg, #fff, ${cs.tint} 75%)`, outline: on ? `2px solid ${cs.ink}` : 'none' }} onClick={() => pickCat(c)}>
                  <span className={b.orb} style={{ background: cs.orb }} />{cs.name}
                </button>
              )
            })}
          </div>

          {curCat === 'free' ? (
            <a className={b.redirect} href={`/student/free?date=${date}`} style={{ background: `linear-gradient(160deg, #fff, ${st.soft})` }}>
              <b style={{ color: st.ink }}>자율창작 자리 고르기 →</b><span>자리와 시간을 직접 선택해요</span>
            </a>
          ) : (curCat === 'oneday' || curCat === 'meeting') ? (<>
            <div className={b.label}>수업</div>
            {catCourses.map(c => (
              <a key={c.id} className={b.redirect} href={`/student/calendar?date=${date}`} style={{ background: `linear-gradient(160deg, #fff, ${st.soft})` }}>
                <b style={{ color: st.ink }}>{c.name} →</b>
                <span>{curCat === 'oneday' ? '계약금 입금 안내가 있어 예약 화면에서 이어서 신청해요' : '모임 참여권 안내가 있어 예약 화면에서 이어서 신청해요'}</span>
              </a>
            ))}
          </>) : (<>
            <div className={b.labelRow}>
              <span className={b.label}>수업 선택</span>
              {course && <a className={b.link} href={`/student/curriculum?course=${encodeURIComponent(course.name)}`}>이 수업 커리큘럼 보기</a>}
            </div>
            <div className={b.courses}>
              {catCourses.map(c => {
                const on = course?.id === c.id
                return (
                  <button key={c.id} className={b.course} aria-pressed={on} onClick={() => { setCourseId(c.id); setSlotId(null); setNote(null) }}
                    style={on ? { background: `linear-gradient(160deg, #fff, ${st.soft})`, outline: `2px solid ${st.ink}` } : null}>
                    <span className={b.place} style={{ color: st.ink }}>{st.place} · {st.name}</span>
                    <span className={b.courseName}>{c.name}</span>
                    {c.teacher && <span className={b.muted}>강사 {c.teacher}</span>}
                  </button>
                )
              })}
            </div>

            <div className={b.label}>시간</div>
            {slots.length === 0 ? <div className={b.muted}>이 날 수업 시간이 없어요</div> : (
              <div className={b.slots}>
                {slots.map(s => {
                  const ss = slotState(s), on = slot?.id === s.id
                  const clickable = ss.kind === 'open' || ss.kind === 'mine'
                  return (
                    <button key={s.id} className={`${b.slot} ${clickable ? '' : b.slotOff}`} disabled={!clickable || busy}
                      aria-pressed={on} style={on ? { outline: '2px solid #2b2433', background: 'rgba(255,255,255,0.85)' } : null}
                      onClick={() => ss.kind === 'mine' ? cancel(ss.booking) : setSlotId(s.id)}>
                      <span className={b.part} style={{ background: clickable ? st.tint : 'rgba(43,36,51,0.08)', color: clickable ? st.ink : undefined }}>{part(s.start_time)}</span>
                      <span className={b.time}>{s.start_time} ~ {s.end_time}</span>
                      <span className={b.state} style={{ color: ss.kind === 'mine' ? st.ink : ss.kind === 'open' ? (ss.left === 1 ? '#a2531c' : '#2f7a52') : undefined }}>
                        {ss.kind === 'open' && ss.max && ss.max <= 8 && (
                          <span className={b.seats} aria-hidden="true">
                            {Array.from({ length: ss.max }, (_, i) => <span key={i} style={{ background: i < ss.left ? '#4aa877' : 'rgba(43,36,51,0.18)' }} />)}
                          </span>
                        )}
                        {ss.lock ? '🔒 ' : ''}{ss.text}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>)}
        </>)}
        {note && <div className={b.note} role="status">{note}</div>}
      </div>

      <div className={b.foot}>
        <div className={b.ticket}>
          <span className={b.muted}>내 수강권</span>
          <b>{ticket ? `${ticket.total}회권 · 잔여 ${ticket.remain}회` : user ? '수강권 없음' : '로그인하면 보여요'}</b>
          {ticket?.expires_at && <span className={b.muted}>{!ticketStarted(ticket, todayStr) && ticket.start_date ? `${ticket.start_date.slice(5).replace('-', '월 ')}일부터 사용` : `만료 ${ticket.expires_at}`}</span>}
        </div>
        {course && curCat !== 'free' && curCat !== 'oneday' && curCat !== 'meeting' && (
          <button className={b.cta} disabled={!slot || busy} onClick={book}>
            {busy ? '예약 처리 중…' : !slot ? '시간을 골라 주세요' : validTicket ? `${course.name} ${slot.start_time}~${slot.end_time} 예약하기` : '예약 요청하기 (수강권 확인 필요)'}
          </button>
        )}
      </div>
    </section>
  )
}
