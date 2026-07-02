// 농부냥 캐릭터 — 학생이 설정에서 1마리를 고르고, 냥밭에는 선택된 냥이만 등장한다.
export const FARM_CATS = [
  { key: 'watering', name: '물뿌리개냥', img: '/farm/cat-watering.png', act: 'water', desc: '물주기 · 토마토', crop: 'tomato', cropName: '토마토' },
  { key: 'overalls', name: '밀짚모자냥', img: '/farm/cat-overalls.png', act: 'seed', desc: '씨뿌리기 · 옥수수', crop: 'corn', cropName: '옥수수' },
  { key: 'apron',    name: '앞치마냥',   img: '/farm/cat-apron.png',    act: 'dig',  desc: '밭갈기 · 당근', crop: 'carrot', cropName: '당근' },
]

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
