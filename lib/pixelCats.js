// 픽셀 고양이 얼굴 10종 — 로딩 스플래시와 프로필 사진 선택에서 공용.
export const PIXEL_CATS = [
  '01-happy', '02-wink', '03-cool', '04-love', '05-surprised',
  '06-sleepy', '07-laugh', '08-grumpy', '09-cat', '10-playful',
]

export function pixelCatImg(key) {
  return `/pixel-cats/${key}.png`
}

// 프로필 사진 해금 조건: 필요한 수확 횟수. 0 = 가입 즉시 사용 가능(3종).
export const CAT_UNLOCKS = {
  '01-happy': 0,
  '07-laugh': 0,
  '09-cat': 0,
  '02-wink': 1,
  '10-playful': 2,
  '04-love': 3,
  '03-cool': 4,
  '06-sleepy': 6,
  '05-surprised': 8,
  '08-grumpy': 10,
}

export function catUnlockAt(key) {
  return CAT_UNLOCKS[key] ?? 0
}

// 설정 그리드 표시 순서: 무료 3종 먼저, 이후 해금 조건 오름차순
export const PIXEL_CATS_BY_UNLOCK = [...PIXEL_CATS].sort((a, b) => catUnlockAt(a) - catUnlockAt(b))

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
