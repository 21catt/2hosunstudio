// 관리자 화면 공통 디자인 토큰 (모던 톤)
// 색·라디우스를 한 곳에서 관리 — 톤을 바꾸려면 이 파일만 수정하면 됩니다.

export const HEADER_BG = '#42675a'   // 상단 헤더 배경
export const PRIMARY   = '#2C6114'   // 주요 채움 버튼 (부여·확인 등)

// 중립 색
export const T = {
  text:    '#1c2a24',           // 본문
  mut:     '#a2aaa1',           // 보조 텍스트
  faint:   '#bcc2ba',           // 카운트 등 아주 옅은
  line:    'rgba(0,0,0,0.06)',  // 행 구분선
  card:    'rgba(0,0,0,0.08)',  // 카드 테두리
  fieldBg: '#F5F4EF',           // 입력 필드 배경
  tileBg:  '#F6F5F1',           // 통계 타일 배경
  navBg:   '#F0EEE8',           // 세그먼트/원형 버튼 배경
}

// 상태 팔레트: main(강조·링·버튼) · tx(옅은 배경 위 글자) · soft(옅은 배경) · dot(점)
export const OK   = { main: '#4C8B29', tx: '#2A5E12', soft: '#EEF4E4', dot: '#5F9A34' }
export const WARN = { main: '#E08A1E', tx: '#A0580B', soft: '#FAEFDD', dot: '#E08A1E' }
export const BAD  = { main: '#C1564D', tx: '#94382F', soft: '#F6E8E6', dot: '#C1564D' }

// 회원 수강권 상태 → 팔레트
export const MST = { '수강중': OK, '만료임박': WARN, '만료': BAD }
