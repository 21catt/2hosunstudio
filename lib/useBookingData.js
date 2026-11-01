'use client'
// 예약 화면이 읽는 자료 한 벌 — 수업·자리·내 예약·수강권·잠금. 규칙은 lib/myClasses
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { fetchLockedDates, fetchLockedSlots, slotLocked } from './lockedDates'
import { isTooLateToBook } from './bookingWindow'
import { ymd } from './myClasses'

// 개발 서버 전용 — /castle?dev=1&longterm=1 : 로그인 없이 예시 자료로 화면 확인(배포 빌드에선 false)
export function devLongTerm() {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('longterm') === '1'
}
function demoRaw() {
  const sch = (id, day_of_week, start_time, end_time) => ({ id, day_of_week, start_time, end_time })
  const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }
  const pastOn = (dow, weeks) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7 || 7) - 7 * weeks); return ymd(d) }
  const classes = [
    { id: 'c1', name: '인체 드로잉', category: 'drawing', max_count: 6, is_unlimited: true, class_schedules: [sch('s1', 4, '14:00', '16:00'), sch('s2', 4, '19:00', '21:00'), sch('s3', 0, '14:00', '16:00')] },
    { id: 'c2', name: '색채 기초', category: 'painting', max_count: 6, is_unlimited: true, class_schedules: [sch('s4', 0, '11:00', '13:00'), sch('s5', 3, '11:00', '13:00')] },
    { id: 'c3', name: '기초 드로잉', category: 'drawing', max_count: 6, is_unlimited: true, class_schedules: [sch('s6', 1, '19:00', '21:00')] },
  ]
  const past = (course_id, schedule_id, class_date, class_time) => ({ id: class_date + course_id, course_id, schedule_id, class_date, class_time, status: 'booked', attended: true })
  const mine = [0, 1, 2, 3].map(w => past('c1', 's2', pastOn(4, w), '19:00~21:00')).concat([0, 1, 2].map(w => past('c2', 's4', pastOn(0, w), '11:00~13:00')), [past('c3', 's6', ago(120), '19:00~21:00')])
  return { classes, seats: [], mine, ticket: { total: 8, remain: 7, expires_at: '2099-12-31' }, lockedDates: new Set(), lockedSlots: new Set() }
}

export function useBookingData(user, enabled = true) {
  const demo = devLongTerm()
  const [raw, setRaw] = useState(null)
  const uid = user?.id
  const reload = useCallback(async () => {
    if (demo) { const r = demoRaw(); setRaw(r); return r }
    const [c, all, my, t, ld, ls] = await Promise.all([
      supabase.from('class_courses').select('*, class_schedules(*), class_exceptions(*)').eq('is_active', true),
      supabase.from('bookings').select('course_id, schedule_id, class_date, class_time').eq('status', 'booked'),
      uid ? supabase.from('bookings').select('*').eq('user_id', uid).neq('status', 'cancelled') : Promise.resolve({ data: [] }),
      uid ? supabase.from('tickets').select('*').eq('user_id', uid).maybeSingle() : Promise.resolve({ data: null }),
      fetchLockedDates(),
      fetchLockedSlots(),
    ])
    const r = { classes: c.data || [], seats: all.data || [], mine: my.data || [], ticket: t.data || null, lockedDates: ld || new Set(), lockedSlots: ls || new Set() }
    setRaw(r)
    return r
  }, [uid, demo])
  useEffect(() => { if (enabled) reload() }, [enabled, reload])
  const ctx = useMemo(() => raw && toCtx(raw), [raw])
  return { ctx, ticket: raw?.ticket ?? null, loading: !raw, reload, toCtx, demo }
}
export function toCtx(r) {
  return { classes: r.classes, seats: r.seats, mine: r.mine, lockedDates: r.lockedDates,
    isLocked: (ds, s) => slotLocked(r.lockedDates, r.lockedSlots, ds, s.id),
    tooLate: (ds, s) => isTooLateToBook(ds, s.start_time) }
}
