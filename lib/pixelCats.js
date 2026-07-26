// 픽셀 고양이 얼굴 — 로딩 스플래시와 프로필 사진 선택에서 공용.
// '18-studio'는 2호선 스튜디오 마스코트(초록 고양이) — 관리자 프로필 전용, 학생 선택 그리드엔 안 나옴.
export const STUDIO_CAT = '18-studio'
export const PIXEL_CATS = [
  '01-happy', '02-wink', '03-cool', '04-love', '05-surprised',
  '06-sleepy', '07-laugh', '08-grumpy', '09-cat', '10-playful',
  '15-red', '12-cow', '13-siam', '14-peach', '16-nyang', '17-nyang-laugh',
  // 우주 헬멧 시리즈 — 2달 한정 무료, 이후 작물 교환 해금 (파일: public/pixel-cats/helmet-*.png)
  'helmet-19-bonobono', 'helmet-20-nabuli', 'helmet-21-cave-uncle', 'helmet-22-porori', 'helmet-visor',
  STUDIO_CAT,
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
  '18-studio': null,                 // 스튜디오 마스코트(관리자 전용)
  // 우주 헬멧 시리즈 — 2026-09-24까지 누구나 무료, 이후엔 작물 교환(수확 N)으로 해금.
  'helmet-19-bonobono':   { freeUntil: '2026-09-24', harvest: 10 }, // 파랑(보노보노)
  'helmet-20-nabuli':     { freeUntil: '2026-09-24', harvest: 12 }, // 갈색 곰(나부리)
  'helmet-21-cave-uncle': { freeUntil: '2026-09-24', harvest: 14 }, // 주황(동굴아저씨)
  'helmet-22-porori':     { freeUntil: '2026-09-24', harvest: 16 }, // 핑크(뽀로리)
  'helmet-visor':         { freeUntil: '2026-09-24', harvest: 20 }, // 갤럭시 바이저 = 프레스티지
  // 수확 9~10 슬롯: 신규 3종(파랑무늬 새침·라임냥·패치 윙크혀) + 검은냥 — 파일 수급 후 추가
}

// 기간 한정 무료 여부(오늘 <= freeUntil). 서버 시각 아님(기기 로컬) — 취향 잠금이라 허용.
function catInFreeWindow(cond, now = new Date()) {
  if (!cond || !cond.freeUntil) return false
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return ymd <= cond.freeUntil
}

export function catUnlocked(key, { harvest = 0, attended = 0, unlockAll = false } = {}) {
  if (unlockAll) return true // 관리자가 해금해준 회원은 조건 무시
  const cond = CAT_UNLOCKS[key]
  if (!cond) return true
  if (catInFreeWindow(cond)) return true // 기간 한정 무료(2달) — 누구나 사용
  if (cond.attend != null) return attended >= cond.attend
  if (cond.harvest != null) return harvest >= cond.harvest
  return true
}

// 기간 한정 무료 배지 라벨(창 안에서만) — 설정 그리드에서 "🌌 2달 무료" 표기용
export function catSeasonLabel(key, now = new Date()) {
  const cond = CAT_UNLOCKS[key]
  return catInFreeWindow(cond, now) ? '2달 무료' : ''
}

export function catUnlockLabel(key, unit = '수확') {
  const cond = CAT_UNLOCKS[key]
  if (!cond) return ''
  if (cond.attend != null) return `수업 ${cond.attend}회`
  return `${unit} ${cond.harvest}`
}

// 설정 그리드 표시 순서: 무료 → 수업 조건 → 수확 조건 오름차순
function unlockRank(key) {
  const cond = CAT_UNLOCKS[key]
  if (!cond) return 0
  if (cond.attend != null) return 10 + cond.attend
  return 100 + cond.harvest
}

// 학생 프로필 선택 그리드 — 스튜디오 마스코트(관리자 전용)는 제외
export const PIXEL_CATS_BY_UNLOCK = [...PIXEL_CATS].filter(k => k !== STUDIO_CAT).sort((a, b) => unlockRank(a) - unlockRank(b))

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
