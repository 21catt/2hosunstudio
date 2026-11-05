// 예약 화면 「수업 선택」 묶음 — 같은 종류의 정규 수업 여럿을 카드 하나로 보여 준다(2026-11-05 사용자 지시).
//   페인팅 = 색채 기초 · 명암의 이해 · 인물화 → 「유화」 / 드로잉 = 그 종류 수업 전부 → 「드로잉」
//   묶이지 않는 수업(임정아 클래스 등)은 전처럼 제 이름 카드로.
// 예약 기록은 그대로 실제 수업 하나에 남는다 — 시간을 고르면 그 시간의 주인 수업이 정해진다(slotOwners).
// 수업 데이터(DB)는 건드리지 않는다: 묶음은 화면 표시뿐.

const OIL = new Set(['색채 기초', '명암의 이해', '인물화'])

export function groupOf(c) {
  const name = (c?.name || '').trim()
  if (c?.category === 'painting' && OIL.has(name)) return { key: 'oil', name: '유화' }
  if (c?.category === 'drawing') return { key: 'drawing', name: '드로잉' }
  return null
}

// 같은 종류 수업 목록 → 카드 목록 [{ key, name, members }] (순서 = 첫 구성원이 나온 자리)
export function courseCards(courses) {
  const out = [], byKey = {}
  for (const c of courses) {
    const g = groupOf(c)
    if (!g) { out.push({ key: c.id, name: c.name, members: [c], single: true }); continue }
    if (!byKey[g.key]) { byKey[g.key] = { key: g.key, name: g.name, members: [] }; out.push(byKey[g.key]) }
    byKey[g.key].members.push(c)
  }
  // 구성원이 하나뿐인 묶음은 그 수업 이름 그대로(묶을 것이 없다)
  return out.map(x => x.members.length === 1 ? { ...x, name: x.members[0].name, single: true } : x)
}

export const cardOf = (cards, course) => cards.find(x => x.members.some(m => m.id === course?.id)) || null

// 이 학생이 최근에 들은 구성원(예약 기록 기준) — 없으면 첫 구성원
export function preferredMember(card, bookings = []) {
  if (!card) return null
  const ids = new Set(card.members.map(m => m.id))
  const last = bookings.filter(b => ids.has(b.course_id) && b.status !== 'cancelled')
    .sort((a, b) => (b.class_date || '').localeCompare(a.class_date || ''))[0]
  return card.members.find(m => m.id === last?.course_id) || card.members[0]
}

// 카드의 그날 시간 — 같은 시작 시각은 하나만. 주인 수업 = 이미 예약한 수업 > 지금 고른 수업 > 즐겨 듣는 수업 > 첫 구성원
//   schedulesOf(course) = 그날 그 수업의 시간 목록 · bookedFn(course, s) = 그 시간 예약 여부
export function slotOwners(card, { schedulesOf, bookedFn, currentId, preferredId }) {
  if (!card) return []
  const rank = (m, s) => (bookedFn(m, s) ? 0 : m.id === currentId ? 1 : m.id === preferredId ? 2 : 3)
  const best = {}
  card.members.forEach((m, i) => {
    for (const s of schedulesOf(m)) {
      const r = rank(m, s) * 100 + i, k = s.start_time
      if (!best[k] || r < best[k].r) best[k] = { course: m, s, r }
    }
  })
  return Object.values(best).sort((a, b) => a.s.start_time.localeCompare(b.s.start_time)).map(({ course, s }) => ({ course, s }))
}
