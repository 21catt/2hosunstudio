// 농부냥 캐릭터 — 학생이 설정에서 1마리를 고르고, 냥밭에는 선택된 냥이만 등장한다.
export const FARM_CATS = [
  { key: 'watering', name: '물뿌리개냥', img: '/farm/cat-watering.png', act: 'water', desc: '물주기 담당' },
  { key: 'overalls', name: '밀짚모자냥', img: '/farm/cat-overalls.png', act: 'seed', desc: '씨뿌리기 담당' },
  { key: 'apron',    name: '앞치마냥',   img: '/farm/cat-apron.png',    act: 'dig',  desc: '밭갈기 담당' },
]

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
