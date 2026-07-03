// 픽셀 고양이 얼굴 10종 — 로딩 스플래시와 프로필 사진 선택에서 공용.
export const PIXEL_CATS = [
  '01-happy', '02-wink', '03-cool', '04-love', '05-surprised',
  '06-sleepy', '07-laugh', '08-grumpy', '09-cat', '10-playful',
]

export function pixelCatImg(key) {
  return `/pixel-cats/${key}.png`
}

// 프로필 사진 해금 조건. null = 가입 즉시(3종),
// { attend: n } = 수업 n회 이상 출석, { harvest: n } = 냥밭 수확 n개 이상.
export const CAT_UNLOCKS = {
  '01-happy': null,
  '07-laugh': null,
  '09-cat': null,
  '02-wink': { attend: 4 },
  '05-surprised': { attend: 4 },
  '04-love': { attend: 4 },
  '03-cool': { attend: 8 },
  '06-sleepy': { attend: 8 },
  '08-grumpy': { attend: 8 },
  '10-playful': { harvest: 1 },
}

export function catUnlocked(key, { harvest = 0, attended = 0 } = {}) {
  const cond = CAT_UNLOCKS[key]
  if (!cond) return true
  if (cond.attend != null) return attended >= cond.attend
  if (cond.harvest != null) return harvest >= cond.harvest
  return true
}

export function catUnlockLabel(key) {
  const cond = CAT_UNLOCKS[key]
  if (!cond) return ''
  if (cond.attend != null) return `수업 ${cond.attend}회`
  return `수확 ${cond.harvest}`
}

// 설정 그리드 표시 순서: 무료 → 수업 조건 → 수확 조건 오름차순
function unlockRank(key) {
  const cond = CAT_UNLOCKS[key]
  if (!cond) return 0
  if (cond.attend != null) return 10 + cond.attend
  return 100 + cond.harvest
}

export const PIXEL_CATS_BY_UNLOCK = [...PIXEL_CATS].sort((a, b) => unlockRank(a) - unlockRank(b))

export const PROFILE_CAT_KEY = '2hs_profile_cat'
export const DEFAULT_PROFILE_CAT = '09-cat'

export function isValidPixelCat(key) {
  return PIXEL_CATS.includes(key)
}

export function getSavedProfileCat() {
  try {
    const v = localStorage.getItem(PROFILE_CAT_KEY)
    return isValidPixelCat(v) ? v : DEFAULT_PROFILE_CAT
  } catch {
    return DEFAULT_PROFILE_CAT
  }
}

export function saveProfileCatLocal(key) {
  try { localStorage.setItem(PROFILE_CAT_KEY, isValidPixelCat(key) ? key : DEFAULT_PROFILE_CAT) } catch {}
}
