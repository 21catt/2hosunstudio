// 냥밭 꽃밭 — 잡초 500개 보상(드로잉노트+연필)을 받은 학생에게 생기는 두 번째 밭 (2026-10-22 사용자 지시)
//   · 꽃 열 송이가 하나씩 차례로 자란다(모양·색이 서로 다른 열 가지). 열 송이가 다 피면 또 노트(운영진 알림 1번)
//   · 하루에 물 세 번이 딱 좋다. 너무 많이 줘도(4번↑) 적게 줘도(2번↓) 그날 자라는 양이 줄어든다
//   · 비 오는 날은 물을 안 줘도 된다(그날은 하늘이 준 것으로 본다 — 학생이 줘도 무르지 않는다)
//   · 물은 2시간에 한 번만 센다(연달아 눌러 세 번을 채우지 않게 — 아침·낮·저녁)
//   · 한 송이 = 딱 좋은 날 30일 → 열 송이 ≈ 10개월
//   · 하루 몫은 그날이 끝난 뒤(다음 날 처음 들어올 때) 정산한다. 비 = 신도림 그날 강수량(open-meteo, 지난 92일까지)
//   저장 = user_prefs.weed_state.flowers (lib/weeds 가 그대로 넘긴다 — 두 냥밭 화면 어느 쪽이 저장해도 남는다)

export const FLOWER = {
  COUNT: 10,
  PER_FLOWER: 30,              // 딱 좋은 날 30일 = 한 송이
  BEST: 3,                     // 하루 물 세 번
  GAP_MS: 2 * 3600 * 1000,     // 물 사이 최소 간격
  RAIN_MM: 1,                  // 그날 강수량 1mm 이상 = 비 온 날
  STAGES: 5,                   // 한 송이 안 단계(새싹 → 잎 → 봉오리 → 반쯤 → 활짝)
}

// 꽃 열 가지 — 피는 순서대로(모양 = 3D 장면이 그리는 방식)
export const FLOWER_KINDS = [
  { key: 'tulip', name: '튤립', color: '#f06b7a', shape: 'cup', petals: 6 },
  { key: 'daisy', name: '데이지', color: '#ffffff', center: '#ffd04a', shape: 'flat', petals: 14 },
  { key: 'sunflower', name: '해바라기', color: '#ffc531', center: '#7a4b2a', shape: 'flat', petals: 18, big: true },
  { key: 'lavender', name: '라벤더', color: '#a68be8', shape: 'spike', petals: 9 },
  { key: 'rose', name: '장미', color: '#e0405a', shape: 'ball', petals: 9 },
  { key: 'cosmos', name: '코스모스', color: '#f5a3c7', center: '#ffcf4a', shape: 'flat', petals: 8 },
  { key: 'bell', name: '초롱꽃', color: '#7fa6f0', shape: 'bell', petals: 5 },
  { key: 'hydrangea', name: '수국', color: '#8fb2ff', shape: 'cluster', petals: 12 },
  { key: 'poppy', name: '양귀비', color: '#ff7b3a', center: '#2b2233', shape: 'cup', petals: 4 },
  { key: 'lily', name: '백합', color: '#fff4e0', center: '#f3b04a', shape: 'star', petals: 6 },
]

export const ymdOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function normFlowers(f) {
  const d = f && typeof f === 'object' ? f : {}
  return {
    growth: Number.isFinite(d.growth) ? Math.max(0, d.growth) : 0,    // 정산한 성장(딱 좋은 날 = 1)
    settledTo: typeof d.settledTo === 'string' ? d.settledTo : null,  // 여기까지(이 날 포함) 정산
    days: d.days && typeof d.days === 'object' ? d.days : {},          // 아직 정산 안 한 날 → 물 준 횟수
    lastWater: Number.isFinite(d.lastWater) ? d.lastWater : 0,
    rewarded: !!d.rewarded,
  }
}

// 그날 자라는 양 — 물 횟수(w)·비(rain)
export function dayGrowth(w, rain) {
  if (rain) return 1
  return w === 3 ? 1 : w === 2 || w === 4 ? 0.5 : w === 1 || w === 5 ? 0.25 : 0
}

const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymdOf(new Date(y, m - 1, d + n)) }

// 꽃밭이 처음 생기는 날 — 오늘부터 센다(지난날은 빈 날로 치지 않는다)
export function startFlowers(today) { return { ...normFlowers(null), settledTo: addDays(today, -1) } }

// 어제까지 정산. rainByDay = { 'YYYY-MM-DD': mm } · null = 날씨를 못 받음 → 정산하지 않고 다음에(지난 92일 밖 날 = 비 정보 없음 = 맑은 날)
export function settleFlowers(prev, today, rainByDay) {
  const f = normFlowers(prev)
  if (!f.settledTo) return { flowers: { ...f, settledTo: addDays(today, -1) }, changed: true }
  if (!rainByDay) return { flowers: f, changed: false }
  let day = addDays(f.settledTo, 1), growth = f.growth, settledTo = f.settledTo, changed = false
  const days = { ...f.days }
  while (day < today) {
    growth += dayGrowth(days[day] || 0, (rainByDay[day] || 0) >= FLOWER.RAIN_MM)
    delete days[day]; settledTo = day; day = addDays(day, 1); changed = true
  }
  growth = Math.min(growth, FLOWER.COUNT * FLOWER.PER_FLOWER)
  return { flowers: { ...f, growth, settledTo, days }, changed }
}

// 물 주기. 반환 = { flowers, counted, reason }
//   reason: 'rain'(오늘 비 — 안 줘도 돼요) · 'soon'(2시간 안 — 흙이 아직 촉촉) · 'done'(열 송이 다 핌) · null(셌다)
export function waterFlowers(prev, now, rainingToday) {
  const f = normFlowers(prev), today = ymdOf(new Date(now))
  if (f.growth >= FLOWER.COUNT * FLOWER.PER_FLOWER) return { flowers: f, counted: false, reason: 'done' }
  if (rainingToday) return { flowers: f, counted: false, reason: 'rain' }
  if (now - f.lastWater < FLOWER.GAP_MS) return { flowers: f, counted: false, reason: 'soon', waitMin: Math.ceil((FLOWER.GAP_MS - (now - f.lastWater)) / 60000) }
  return { flowers: { ...f, lastWater: now, days: { ...f.days, [today]: (f.days[today] || 0) + 1 } }, counted: true, reason: null }
}

// 화면에 보일 모습 — 오늘 몫은 아직 정산 전이라 「오늘 이대로면」을 따로 보여 준다
export function flowerView(prev, now, rainingToday) {
  const f = normFlowers(prev), today = ymdOf(new Date(now))
  const max = FLOWER.COUNT * FLOWER.PER_FLOWER
  const bloomed = Math.min(FLOWER.COUNT, Math.floor(f.growth / FLOWER.PER_FLOWER))
  const cur = bloomed < FLOWER.COUNT ? (f.growth - bloomed * FLOWER.PER_FLOWER) / FLOWER.PER_FLOWER : 1
  const todayW = f.days[today] || 0
  return {
    bloomed, done: f.growth >= max, rewarded: f.rewarded,
    current: bloomed < FLOWER.COUNT ? FLOWER_KINDS[bloomed] : null,
    progress: cur,                                                   // 지금 자라는 꽃 0..1
    stage: bloomed < FLOWER.COUNT ? Math.min(FLOWER.STAGES - 1, Math.floor(cur * FLOWER.STAGES)) : FLOWER.STAGES,
    todayWater: todayW, rainToday: !!rainingToday,
    todayGain: dayGrowth(todayW, rainingToday),                      // 오늘 이대로면
    nextOk: f.lastWater ? f.lastWater + FLOWER.GAP_MS : 0,
    daysLeft: Math.ceil(max - f.growth),                             // 딱 좋은 날로 치면 남은 날
  }
}

// 비 기록 — 신도림(스튜디오) 지난날 강수량. 실패 = null(그날들은 다음에 정산)
export async function fetchRainDays(pastDays = 92) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=37.5088&longitude=126.8912&daily=precipitation_sum&past_days=${pastDays}&forecast_days=1&timezone=Asia/Seoul`)
    const d = await r.json(), out = {}
    ;(d.daily?.time || []).forEach((t, i) => { out[t] = d.daily.precipitation_sum?.[i] ?? 0 })
    return Object.keys(out).length ? out : null
  } catch { return null }
}
