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
]

export function isValidTheme(key) {
  return THEMES.some(t => t.key === key)
}

export function getSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return isValidTheme(t) ? t : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

// html[data-theme] 갱신 + localStorage 저장 (기본 테마는 속성 제거)
export function applyTheme(key) {
  const k = isValidTheme(key) ? key : DEFAULT_THEME
  if (k === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', k)
  try { localStorage.setItem(THEME_KEY, k) } catch {}
}
