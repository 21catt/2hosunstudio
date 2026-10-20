// 3D 모양에서 강좌마다 쓰는 젤리 색 하나 — 목록 동그라미, 강좌 첫 화면의 빛, 단계 구슬이 같은 색을 쓴다.
// 이름으로 정해지므로(저장 없음) 같은 강좌는 어느 화면·기기에서나 같은 색이다.
export const JELLY_COLORS = ['#5b7fe0', '#d81e4f', '#f2c94c', '#7fc8a9', '#9b7be0', '#e88a5b', '#8fc6e8', '#b8a48a']
export function jellyColorFor(name = '') {
  let h = 0
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return JELLY_COLORS[h % JELLY_COLORS.length]
}
// 단계 구슬 — 첫 단계는 강좌 색, 나머지는 팔레트를 돌며
export function beadColor(base, i) {
  const k = JELLY_COLORS.indexOf(base)
  return JELLY_COLORS[((k < 0 ? 0 : k) + i) % JELLY_COLORS.length]
}
