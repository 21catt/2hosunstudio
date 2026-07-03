// 관리자 화면 공통 디자인 토큰
// 학생 화면과 같은 테마 CSS 변수(--ac 계열)에 매핑 — 테마(울트라 블루 등)를 그대로 따라간다.
// 톤을 바꾸려면 globals.css의 테마 변수를 수정하면 됩니다.

export const HEADER_BG = 'var(--g4)'   // 상단 헤더 배경 (테마 주조색, .header 기본과 동일)
export const PRIMARY   = 'var(--ac)'   // 주요 채움 버튼 (부여·확인 등)

// 중립 색 — 테마 텍스트/서피스 변수 재사용
export const T = {
  text:    'var(--td)',   // 본문
  mut:     'var(--tmu)',  // 보조 텍스트
  faint:   'var(--tl)',   // 카운트 등 아주 옅은
  line:    'rgba(0,0,0,0.06)',  // 행 구분선
  card:    'var(--line)',       // 카드 테두리
  fieldBg: 'var(--bg)',   // 입력 필드 배경
  tileBg:  'var(--bg)',   // 통계 타일 배경
  navBg:   'var(--g1)',   // 세그먼트/원형 버튼 배경
}

// 상태 팔레트: main(강조·링·버튼) · tx(옅은 배경 위 글자) · soft(옅은 배경) · dot(점)
// OK는 테마 강조색, WARN/BAD는 의미색(테마와 무관하게 주황/빨강 유지)
export const OK   = { main: 'var(--ac)', tx: 'var(--acTx)', soft: 'var(--acBg)', dot: 'var(--ac)' }
export const WARN = { main: '#E08A1E', tx: '#A0580B', soft: '#FAEFDD', dot: '#E08A1E' }
export const BAD  = { main: '#C1564D', tx: '#94382F', soft: '#F6E8E6', dot: '#C1564D' }

// 회원 수강권 상태 → 팔레트
export const MST = { '수강중': OK, '만료임박': WARN, '만료': BAD }
