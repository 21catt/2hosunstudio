// 냥밭 잡초 시스템 — 실제 경과 시간으로 자란다. 상수는 여기서 조절.
// 이미지: /public/farm/weed-1.png ~ weed-5.png (1=새싹 … 5=완전 개화)
export const WEED = {
  SPAWN_MS: 5 * 3600 * 1000,   // 5시간마다
  SPAWN_COUNT: 3,              // 3개씩
  GROW_MS: 4 * 3600 * 1000,    // 4시간마다 1단계
  STAGES: 5,
  REMOVABLE_STAGE: 4,          // 4단계부터 제거 가능
  PENALTY_STAGE: 5,            // 완전 성장(5단계)
  PENALTY_AT: 10,              // 5단계 10개 이상 → 수확 작물 1개 소멸
  REWARD_AT: 100,              // 100개 제거 → 드로잉노트+연필
  MAX_FIELD: 30,               // 화면 최대 잡초 수(오래 비웠을 때 폭주 방지)
}

export function weedImg(stage) {
  return `/farm/weed-${Math.max(1, Math.min(WEED.STAGES, stage))}.png`
}

export function weedStage(w, now) {
  return Math.min(WEED.STAGES, 1 + Math.floor((now - w.born) / WEED.GROW_MS))
}

export function normWeedState(s) {
  const d = (s && typeof s === 'object') ? s : {}
  return {
    weeds: Array.isArray(d.weeds) ? d.weeds.filter(w => w && typeof w.born === 'number') : [],
    removed: Number.isFinite(d.removed) ? d.removed : 0,
    lastSpawn: Number.isFinite(d.lastSpawn) ? d.lastSpawn : 0,
    penaltyCharged: !!d.penaltyCharged,
    rewarded: !!d.rewarded,
  }
}

function makeWeed(born) {
  return {
    id: `${born}-${Math.floor(Math.random() * 1e6)}`,
    born,
    x: 8 + Math.random() * 80,   // 밭 가로 %
    y: 60 + Math.random() * 30,  // 밭 세로 % (지면 근처)
  }
}

// 경과 시간만큼 스폰/성장·페널티 반영.
// hasTicket=false면 잡초 비활성(밭 정리, 스폰 기준만 현재로).
// 반환: { state, cropLoss } — cropLoss는 이번에 사라질 작물 수(0 또는 1)
export function tickWeeds(prev, now, hasTicket) {
  const s = normWeedState(prev)
  if (!hasTicket) {
    return { state: { ...s, weeds: [], lastSpawn: now, penaltyCharged: false }, cropLoss: 0 }
  }
  if (!s.lastSpawn) s.lastSpawn = now

  let weeds = s.weeds.slice()
  let lastSpawn = s.lastSpawn
  let ticks = Math.floor((now - lastSpawn) / WEED.SPAWN_MS)
  // 오래 비운 경우 최근 틱만 반영
  const maxTicks = Math.ceil(WEED.MAX_FIELD / WEED.SPAWN_COUNT) + 2
  if (ticks > maxTicks) { lastSpawn = now - maxTicks * WEED.SPAWN_MS; ticks = maxTicks }
  for (let i = 1; i <= ticks; i++) {
    const born = lastSpawn + i * WEED.SPAWN_MS
    for (let k = 0; k < WEED.SPAWN_COUNT && weeds.length < WEED.MAX_FIELD; k++) weeds.push(makeWeed(born))
  }
  lastSpawn += ticks * WEED.SPAWN_MS

  const fullGrown = weeds.filter(w => weedStage(w, now) >= WEED.PENALTY_STAGE).length
  let cropLoss = 0
  let penaltyCharged = s.penaltyCharged
  if (fullGrown >= WEED.PENALTY_AT) {
    if (!penaltyCharged) { cropLoss = 1; penaltyCharged = true }
  } else {
    penaltyCharged = false
  }

  return { state: { ...s, weeds, lastSpawn, penaltyCharged }, cropLoss }
}
