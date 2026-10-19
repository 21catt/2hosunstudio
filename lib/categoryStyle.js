// 카테고리 색 — 3D 홈(Castle Jelly) 장면 속 자리에서 가져온 여섯 가지(2026-10-19 시안 확정).
// 지붕·깃대·잔디·화로의 색을 칩·수업 카드·시간 꼬리표·「들어가기」 단추에 똑같이 쓴다.
//   orb  = 진한 점(보석 구슬) · tint = 칩·꼬리표 바탕 · soft = 선택된 카드 바탕 · ink = 그 위 글자(대비 4.5:1 이상)
// 아직 3D 홈(/castle)에서만 쓴다 — 다른 화면의 기존 색(CAT_COLOR 등)은 그대로.
export const CATEGORY_STYLE = {
  drawing:   { name: '드로잉',     place: '분홍 탑',   orb: '#f39fbe', tint: '#fbd3e2', soft: '#fde3ec', ink: '#7a2348' },
  painting:  { name: '페인팅',     place: '라일락 탑', orb: '#b7a0ef', tint: '#e2d8fc', soft: '#eee8fd', ink: '#45307f' },
  sculpture: { name: '조소',       place: '하늘 탑',   orb: '#93b8f2', tint: '#d6e5fc', soft: '#e6effd', ink: '#234a85' },
  oneday:    { name: '원데이 체험', place: '금빛 깃대', orb: '#f2c55c', tint: '#fdecc4', soft: '#fef4dc', ink: '#6e4706' },
  free:      { name: '자율창작',   place: '잔디 정원', orb: '#8fdcb8', tint: '#d4f4e4', soft: '#e4f8ee', ink: '#17573a' },
  meeting:   { name: '작가 모임',   place: '화로 곁',   orb: '#d9a98a', tint: '#f5e1d4', soft: '#f9ebe1', ink: '#643a1d' },
}
const FALLBACK = { name: '수업', place: '', orb: '#c9c2d2', tint: '#ece8f1', soft: '#f4f1f7', ink: '#3f3848' }
export const catStyle = cat => CATEGORY_STYLE[cat] || FALLBACK
