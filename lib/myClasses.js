// 수강생의 예약 판단 규칙(순수) — 3D 홈 「내 다음 수업」 카드와 예약 패널이 같이 쓴다.
//   ctx = { classes, seats, mine, lockedDates, isLocked(ds, s), tooLate(ds, s) } — 만드는 곳은 lib/useBookingData
//   「내 수업」 = 지난 예약 기록에서 두 번 이상 들은 일반 수업. 자율창작·모임·원데이는 각자 신청 화면이 있어 뺀다
const SPECIAL = new Set(['free', 'meeting', 'oneday'])
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const pad = n => String(n).padStart(2, '0')
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const dowOf = ds => new Date(ds + 'T00:00:00').getDay()
export const shortDay = ds => `${DOW[dowOf(ds)]} ${+ds.slice(8)}일`

// 그날 열리는 수업 — 잠긴 날짜·예외 요일·운영 기간
export function coursesOn(ctx, ds) {
  if (ctx.lockedDates.has(ds)) return []
  const dow = dowOf(ds)
  return ctx.classes.filter(c => {
    if (!c.class_schedules?.some(s => s.day_of_week === dow)) return false
    if (c.class_exceptions?.some(e => e.day_of_week === dow)) return false
    if (!c.is_unlimited) {
      if (c.start_date && ds < c.start_date) return false
      if (c.end_date && ds > c.end_date) return false
    }
    return true
  })
}
export function schedulesFor(c, ds) {
  const dow = dowOf(ds), seen = new Set()
  return (c.class_schedules || []).filter(s => s.day_of_week === dow).filter(s => {
    const k = `${s.start_time}-${s.end_time}`; if (seen.has(k)) return false; seen.add(k); return true
  }).sort((x, y) => x.start_time.localeCompare(y.start_time))
}
export function seatCount(ctx, s, ds) {
  const slot = `${s.start_time}~${s.end_time}`
  const excluded = new Set(ctx.classes.filter(x => SPECIAL.has(x.category)).map(x => x.id))
  return ctx.seats.filter(x => x.class_date === ds && x.class_time === slot && !excluded.has(x.course_id)).length
}
export function slotStatus(ctx, course, s, ds) {
  const m = ctx.mine.find(x => x.course_id === course.id && x.schedule_id === s.id && x.class_date === ds)
  if (m) return { kind: 'mine', text: '예약됨 · 눌러서 취소', booking: m }
  if (ctx.tooLate(ds, s)) return { kind: 'closed', text: '예약 마감' }
  if (ctx.isLocked(ds, s)) return { kind: 'closed', text: '예약 마감', lock: true }
  const cnt = seatCount(ctx, s, ds), max = course.max_count || null
  if (max && cnt >= max) return { kind: 'full', text: '마감' }
  if (!max) return { kind: 'open', text: '예약 가능' }
  const left = max - cnt
  return { kind: 'open', text: left === 1 ? '마감 임박 · 1자리' : `${left}자리 남음`, left, max }
}

// 자주 듣는 수업(많이 들은 순) + 그 수업의 늘 가는 요일·시간
export function myHabits(ctx, todayStr, { limit = 2, recent = 40 } = {}) {
  const past = ctx.mine.filter(b => b.class_date < todayStr && b.status !== 'cancelled')
    .sort((a, b) => b.class_date.localeCompare(a.class_date)).slice(0, recent)
  const byCourse = new Map()
  for (const b of past) {
    const c = ctx.classes.find(x => x.id === b.course_id)
    if (!c || SPECIAL.has(c.category)) continue
    if (!byCourse.has(c.id)) byCourse.set(c.id, { course: c, list: [] })
    byCourse.get(c.id).list.push(b)
  }
  return [...byCourse.values()].filter(x => x.list.length >= 2)
    .sort((a, b) => b.list.length - a.list.length || b.list[0].class_date.localeCompare(a.list[0].class_date))
    .slice(0, limit)
    .map(({ course, list }) => {
      const pat = new Map()   // 최근 것이 먼저 들어가 같은 횟수면 최근 습관이 이긴다
      for (const b of list) {
        const k = `${dowOf(b.class_date)}|${String(b.class_time || '').split('~')[0]}`
        pat.set(k, (pat.get(k) || 0) + 1)
      }
      const [key, n] = [...pat.entries()].sort((a, b) => b[1] - a[1])[0]
      const [dow, start] = key.split('|')
      return { course, dow: +dow, start, count: list.length, label: n >= 2 ? `늘 ${DOW[+dow]} ${start}` : '' }
    })
}

// 그 수업의 가까운 날짜 — 하루 한 칸(늘 가던 시간 먼저), 지나갔거나 닫힌 날은 뺀다
export function openings(ctx, habit, todayStr, { days = 14, count = 3 } = {}) {
  const out = [], base = new Date(todayStr + 'T00:00:00')
  for (let i = 0; i < days && out.length < count; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i)
    const ds = ymd(d)
    if (!coursesOn(ctx, ds).some(c => c.id === habit.course.id)) continue
    const ranked = schedulesFor(habit.course, ds).map(s => ({ s, st: slotStatus(ctx, habit.course, s, ds) }))
      .sort((a, b) => (b.s.start_time === habit.start) - (a.s.start_time === habit.start))
    const best = ranked.find(x => x.st.kind === 'open' || x.st.kind === 'mine') || ranked.find(x => x.st.kind === 'full')
    if (best) out.push({ ds, course: habit.course, schedule: best.s, status: best.st, exact: dowOf(ds) === habit.dow && best.s.start_time === habit.start })
  }
  return out
}

// 그날 그 수업의 시간 전부 — 「내 수업」 날짜를 눌렀을 때 펼치는 줄
export const dayTimes = (ctx, course, ds) => schedulesFor(course, ds).map(s => ({ s, st: slotStatus(ctx, course, s, ds) }))

// 홈 카드에 올릴 한 칸 — 늘 가던 요일·시간의 가장 가까운 빈자리, 없으면 내 수업의 가장 가까운 빈자리
export function nextSuggestion(ctx, habits, todayStr) {
  const open = habits.flatMap(h => openings(ctx, h, todayStr)).filter(o => o.status.kind === 'open')
    .sort((a, b) => a.ds.localeCompare(b.ds) || a.schedule.start_time.localeCompare(b.schedule.start_time))
  return open.find(o => o.exact) || open[0] || null
}
