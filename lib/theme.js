// 학생 개인 설정 테마 (4가지 컬러 모드)
// CSS 변수 세트는 app/globals.css의 [data-theme=...] 블록과 짝을 이룹니다.
// 기본값은 '울트라 블루'(data-theme 속성 없음 = :root).

export const THEME_KEY = '2hs_theme'
export const DEFAULT_THEME = 'ultra'

export const THEMES = [
  { key: 'ultra', name: '울트라 블루', a1: '#2B2FD4', a2: '#7CE8A4' },
  { key: 'line2', name: '2호선 그린', a1: '#009A54', a2: '#CDF463' },
  { key: 'ink',   name: '잉크 탠저린', a1: '#1B1B1B', a2: '#FF6B35' },
  { key: 'lilac', name: '라일락 팝', a1: '#6B4CE6', a2: '#FF9EC4' },
  { key: 'burgundy', name: '버건디 블루', a1: '#64313E', a2: '#C1DBE8' },
  { key: 'palu', name: '팔루 선셋', a1: '#711D1D', a2: '#5D83A7', a3: '#FFC973' },
  { key: 'sage', name: '세이지 버터', a1: '#2D5996', a2: '#F2D976', a3: '#A8AC9D' },
  { key: 'midgreen', name: '미드 그린', a1: '#0F464C', a2: '#C8DFDA', a3: '#F4EB9A' },
  { key: 'fresh', name: '싱그러운', a1: '#7F9227', a2: '#94C6E8', a3: '#B7C24A' },
  { key: 'space', name: '스페이스', a1: '#d24d95', a2: '#2c3d78', a3: '#f0692a' },
  { key: 'glass', name: '글라스 민트', a1: '#6BAE9A', a2: '#F3C9CE', a3: '#A9D9C9' },
  { key: 'liquid', name: '리퀴드 글라스', a1: '#7B5CF0', a2: '#46D6C0', a3: '#F4A4D6' },
]

export function isValidTheme(key) {
  return THEMES.some(t => t.key === key)
}

// 기간 한정 테마 — 윈도우 밖(기간 종료)이면 관리자 포함 잠금, 적용 중이면 기본으로 복귀.
// 싱그러운(fresh) = 2026 여름(7~8월) 한정 글래스 스킨.
export const THEME_WINDOWS = {
  fresh: { from: '2026-07-01', until: '2026-08-31' },
  // 울트라 스페이스 = 2026 여름 한정 다크 스킨. 출시 후 2달간 누구나 무료.
  space: { from: '2026-07-25', until: '2026-09-24', label: '2달 한정', emoji: '🌌' },
  // 글라스 민트 = 서리 유리 스킨. 출시 후 2달간 누구나 무료.
  glass: { from: '2026-08-16', until: '2026-10-15', label: '2달 한정', emoji: '🫧' },
  // 리퀴드 글라스 = 보라·홀로그램 유리 스킨. 출시 후 2달간 누구나 무료.
  liquid: { from: '2026-08-16', until: '2026-10-15', label: '2달 한정', emoji: '🔮' },
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function themeInWindow(key, now = new Date()) {
  const w = THEME_WINDOWS[key]
  if (!w) return true
  const today = ymd(now)
  if (w.from && today < w.from) return false
  if (w.until && today > w.until) return false
  return true
}

// 예: "7·8월 한정" — 기간 한정 테마의 안내 배지용. window.label이 있으면 그것을 우선.
export function themeSeasonLabel(key) {
  const w = THEME_WINDOWS[key]
  if (!w) return ''
  if (w.label) return w.label
  const mf = parseInt(w.from.slice(5, 7), 10)
  const mu = parseInt(w.until.slice(5, 7), 10)
  return mf === mu ? `${mf}월 한정` : `${mf}·${mu}월 한정`
}

// 기간 한정 배지 이모지 (기본 ☀️ 여름). window.emoji로 재정의.
export function themeSeasonEmoji(key) {
  const w = THEME_WINDOWS[key]
  return (w && w.emoji) || '☀️'
}

// 테마 해금 조건 — null이면 가입 즉시, { harvest: n }이면 작물 n개 수확해야 사용 가능.
export const THEME_UNLOCKS = {
  ultra: null,
  line2: { harvest: 1 },
  ink:   { harvest: 2 },
  lilac: { harvest: 3 },
  burgundy: { harvest: 5 },  // 2색
  palu:     { harvest: 6 },  // 3색
  sage:     { harvest: 7 },  // 3색
  midgreen: { harvest: 8 },  // 3색
  fresh:    null,            // 싱그러운 = 수확 조건 없음. 대신 기간(7~8월)으로만 잠금.
  space:    null,            // 울트라 스페이스 = 수확 조건 없음. 기간(2달)으로만 잠금.
  glass:    null,            // 글라스 민트 = 수확 조건 없음. 기간(2달)으로만 잠금.
  liquid:   null,            // 리퀴드 글라스 = 수확 조건 없음. 기간(2달)으로만 잠금.
}

export function themeUnlocked(key, { harvest = 0, unlockAll = false } = {}) {
  if (!themeInWindow(key)) return false // 기간 한정 테마: 기간 밖이면 관리자 포함 잠금
  if (unlockAll) return true // 관리자가 해금해준 회원(냥 꾸미기 전체 해금)은 조건 무시
  const cond = THEME_UNLOCKS[key]
  if (!cond) return true
  if (cond.harvest != null) return harvest >= cond.harvest
  return true
}

export function themeUnlockLabel(key, unit = '수확') {
  if (THEME_WINDOWS[key] && !themeInWindow(key)) return '기간 종료'
  const cond = THEME_UNLOCKS[key]
  if (!cond) return ''
  return `${unit} ${cond.harvest}`
}

// 아직 테마를 고른 적 없는 방문자(주로 비가입자)에게 보여줄 테마.
// ⚠️ 저장하지 않는다 — 저장하면 "기기가 골랐다"가 되어 로그인 뒤 계정 테마가 안 먹는다.
// 기간이 끝나면(THEME_WINDOWS) 자동으로 기본 테마로 돌아간다.
export const GUEST_THEME = 'fresh'
export function guestTheme() {
  return themeInWindow(GUEST_THEME) ? GUEST_THEME : DEFAULT_THEME
}

// 기기에 저장된 테마 — 고른 적이 없으면 null.
// getSavedTheme() 은 없을 때 기본값을 돌려주므로 "안 고름"과 "기본을 고름"을 구분할 수 없다.
export function getSavedThemeRaw() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return (isValidTheme(t) && themeInWindow(t)) ? t : null
  } catch {
    return null
  }
}

export function getSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (isValidTheme(t) && themeInWindow(t)) return t
    return DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

// html[data-theme] 갱신 + localStorage 저장 (기본 테마는 속성 제거).
// 기간 종료된 한정 테마는 기본으로 자동 복귀(글래스 스킨이 9월까지 남지 않게).
export function applyTheme(key) {
  let k = isValidTheme(key) ? key : DEFAULT_THEME
  if (!themeInWindow(k)) k = DEFAULT_THEME
  if (k === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', k)
  try { localStorage.setItem(THEME_KEY, k) } catch {}
  return k
}
