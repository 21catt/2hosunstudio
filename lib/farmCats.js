// 농부냥 캐릭터 — 학생이 설정에서 1마리를 고르고, 냥밭에는 선택된 냥이만 등장한다.
// unlock(선택): 없으면 가입 즉시 사용, { harvest: n }이면 작물 n개 수확해야 해금.
export const FARM_CATS = [
  { key: 'watering', name: '물뿌리개냥', img: '/farm/cat-watering.png', act: 'water', desc: '물주기 · 토마토', crop: 'tomato', cropName: '토마토' },
  { key: 'overalls', name: '밀짚모자냥', img: '/farm/cat-overalls.png', act: 'seed', desc: '씨뿌리기 · 옥수수', crop: 'corn', cropName: '옥수수' },
  { key: 'apron',    name: '앞치마냥',   img: '/farm/cat-apron.png',    act: 'dig',  desc: '밭갈기 · 당근', crop: 'carrot', cropName: '당근' },
  { key: 'bucket',   name: '농부 냥냥이', img: '/farm/cat-bucket.png',   act: 'water', desc: '수확 12개 보상 · 당근', crop: 'carrot', cropName: '당근', unlock: { harvest: 12 } },
]

// 농부냥 해금 여부 — unlock이 없으면 항상 true.
export function farmCatUnlocked(key, { harvest = 0, unlockAll = false } = {}) {
  if (unlockAll) return true // 관리자가 해금해준 회원은 조건 무시
  const c = FARM_CATS.find(x => x.key === key)
  if (!c || !c.unlock) return true
  if (c.unlock.harvest != null) return harvest >= c.unlock.harvest
  return true
}

// 잠긴 농부냥의 해금 조건 라벨 ('수확 12' 등). 조건 없으면 빈 문자열.
export function farmCatUnlockLabel(key, unit = '수확') {
  const c = FARM_CATS.find(x => x.key === key)
  if (!c || !c.unlock) return ''
  if (c.unlock.harvest != null) return `${unit} ${c.unlock.harvest}`
  return ''
}

// 작물: 출석 1회 = 1단계, 4단계(완숙)에서 수확 가능
export const CROP_STAGES = 4

export function cropImg(crop, stage) {
  return `/crops/${crop}-${Math.max(1, Math.min(CROP_STAGES, stage))}.png`
}

export const HARVEST_KEY = '2hs_harvest'

export function getSavedHarvest() {
  try {
    const n = parseInt(localStorage.getItem(HARVEST_KEY), 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveHarvestLocal(n) {
  try { localStorage.setItem(HARVEST_KEY, String(n)) } catch {}
}

export const FARM_CAT_KEY = '2hs_farm_cat'
export const DEFAULT_FARM_CAT = 'watering'

export function isValidFarmCat(key) {
  return FARM_CATS.some(c => c.key === key)
}

export function getSavedFarmCat() {
  try {
    const v = localStorage.getItem(FARM_CAT_KEY)
    return isValidFarmCat(v) ? v : DEFAULT_FARM_CAT
  } catch {
    return DEFAULT_FARM_CAT
  }
}

export function saveFarmCatLocal(key) {
  try { localStorage.setItem(FARM_CAT_KEY, isValidFarmCat(key) ? key : DEFAULT_FARM_CAT) } catch {}
}
