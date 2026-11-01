'use client'
// 3D 홈 「내 다음 수업」 카드 — 다닌 지 3개월 넘은 수강생에게 늘 가던 수업을 한 번에 예약하게 한다.
// 예약·취소·수강권 규칙은 예약 패널과 같은 함수(lib/booking·lib/myClasses). 누르기 전에 자리를 다시 확인한다.
import { useMemo, useState } from 'react'
import { bookClass, cancelBooking, hasValidTicket, requestBookingApproval } from '../../lib/booking'
import { myHabits, nextSuggestion, shortDay, slotStatus, ymd } from '../../lib/myClasses'
import { toCtx, useBookingData } from '../../lib/useBookingData'
import b from './booking.module.css'

export default function MyNextClass({ user, onMore, onBooked }) {
  const { ctx, ticket, reload, demo } = useBookingData(user)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)  // { title, text, booking? }
  const today = ymd(new Date())
  const pickNext = useMemo(() => ctx ? nextSuggestion(ctx, myHabits(ctx, today), today) : null, [ctx, today])
  const valid = hasValidTicket(ticket, today)

  async function book() {
    const o = pickNext
    if (!o || busy) return
    const title = `${o.course.name} · ${shortDay(o.ds)} ${o.schedule.start_time}`
    if (demo) { setDone({ title, text: '예약됐어요 · 시작 4시간 전까지 취소할 수 있어요', booking: { demo: true } }); return }
    setBusy(true)
    try {
      const fresh = await reload()
      if (slotStatus(toCtx(fresh), o.course, o.schedule, o.ds).kind !== 'open') { alert('방금 자리가 찼어요. 다른 날짜를 골라 주세요 🐾'); return }
      if (hasValidTicket(fresh.ticket, today)) {
        const row = await bookClass({ user, ticket: fresh.ticket, course: o.course, schedule: o.schedule, dateStr: o.ds })
        if (row) { setDone({ title, text: '예약됐어요 · 시작 4시간 전까지 취소할 수 있어요', booking: row }); onBooked?.() }
      } else {
        await requestBookingApproval({ user, course: o.course, schedule: o.schedule, dateStr: o.ds })
        setDone({ title, text: '예약 요청이 접수됐어요! 강사님이 확인 후 연락드릴게요 🐾' })
      }
    } finally { setBusy(false) }
  }
  async function undo() {
    if (busy) return
    if (done.booking?.demo) { setDone(null); return }
    setBusy(true)
    try { await cancelBooking({ user, ticket, booking: done.booking }); await reload(); setDone(null); onBooked?.() }
    catch { alert('취소하지 못했어요. 잠시 뒤 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  async function finish() { setDone(null); await reload() }

  if (done) return (
    <section className={b.nextCard} aria-label="예약 결과" role="status">
      <div className={b.nextRow}>
        <div className={b.nextText}><b>{done.title}</b><span>{done.text}</span></div>
      </div>
      <div className={b.nextActions}>
        {done.booking && <button className={b.nextGhost} disabled={busy} onClick={undo}>예약 취소</button>}
        <button className={b.nextGhost} disabled={busy} onClick={finish}>확인</button>
      </div>
    </section>
  )
  if (!pickNext) return null
  const seat = pickNext.status.left ? ` · ${pickNext.status.left}자리 남음` : ''
  return (
    <section className={b.nextCard} aria-label="내 다음 수업">
      <div className={b.nextLabel}>내 다음 수업</div>
      <div className={b.nextRow}>
        <div className={b.nextText}><b>{pickNext.course.name}</b><span>{shortDay(pickNext.ds)} {pickNext.schedule.start_time}{seat}</span></div>
        <button className={b.nextBook} disabled={busy} onClick={book}>{busy ? '처리 중…' : valid ? '예약' : '예약 요청'}</button>
      </div>
      <button className={b.nextMore} onClick={onMore}>다른 날짜·수업 고르기 ›</button>
    </section>
  )
}
