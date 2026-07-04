// 픽셀 고양이 얼굴 10종 — 로딩 스플래시와 프로필 사진 선택에서 공용.
export const PIXEL_CATS = [
  '01-happy', '02-wink', '03-cool', '04-love', '05-surprised',
  '06-sleepy', '07-laugh', '08-grumpy', '09-cat', '10-playful',
  '15-red', '12-cow', '13-siam', '14-peach', '16-nyang', '17-nyang-laugh',
]

export function pixelCatImg(key) {
  return `/pixel-cats/${key}.png`
}

// 프로필 사진 해금 조건. null = 가입 즉시(3종), 나머지는 전부 작물 수확 개수로 해금.
// ({ attend: n } 조건도 지원하지만 현재는 사용하지 않음)
export const CAT_UNLOCKS = {
  '01-happy': null,
  '07-laugh': null,
  '09-cat': null,
  '10-playful': { harvest: 1 },
  '02-wink': { harvest: 2 },
  '05-surprised': { harvest: 3 },
  '04-love': { harvest: 4 },
  '03-cool': { harvest: 5 },
  '15-red': { harvest: 5 },
  '06-sleepy': { harvest: 6 },
  '08-grumpy': { harvest: 7 },
  '13-siam': { harvest: 7 },
  '14-peach': { harvest: 8 },
  '12-cow': { harvest: 11 },
  '16-nyang': { harvest: 12 },       // 모자 쓴 농부냥 얼굴(웃음눈)
  '17-nyang-laugh': { harvest: 12 }, // 모자 쓴 농부냥 얼굴(입벌림)
  // 수확 9~10 슬롯: 신규 3종(파랑무늬 새침·라임냥·패치 윙크혀) + 검은냥 — 파일 수급 후 추가
}

export function catUnlocked(key, { harvest = 0, attended = 0, unlockAll = false } = {}) {
  if (unlockAll) return true // 관리자가 해금해준 회원은 조건 무시
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
