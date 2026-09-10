// 접속하면 뜨는 안내 팝업 — 기간이 지나면 저절로 사라진다.
//
// ⚠️ 여기 배열이 유일한 진실이다. 새 공지 = 항목 한 줄 추가.
//    id 는 "다시 보지 않기" 기억에 쓰이므로 한 번 정하면 바꾸지 않는다
//    (바꾸면 이미 닫은 사람에게 다시 뜬다).
// from·until 은 **표시 기간**(YYYY-MM-DD, until 당일까지 포함).
export const POPUP_NOTICES = [
  {
    id: 'chuseok-2026',
    emoji: '🌕',
    title: '추석 연휴 휴무 안내',
    lines: [
      '9월 24일(목)부터 26일(토)까지',
      '추석 연휴로 수업이 쉽니다.',
      '',
      '27일(일)부터 평소대로 진행합니다.',
    ],
    closing: '포근하고 따뜻한 한가위 보내세요 🌾',
    from: '2026-09-10',
    until: '2026-09-26',
  },
]

// 오늘 띄울 공지 하나(여러 개면 먼저 끝나는 것부터). 없으면 null.
export function activePopupNotice(todayStr, list = POPUP_NOTICES) {
  const live = (list || []).filter(n => n.from <= todayStr && todayStr <= n.until)
  if (live.length === 0) return null
  return live.slice().sort((a, b) => a.until.localeCompare(b.until))[0]
}

// "다시 보지 않기" 기억 — 기기별(localStorage). 문서·계정과 무관.
export const noticeHideKey = id => `2hs_notice_hide_${id}`

export function noticeDismissed(id) {
  try { return localStorage.getItem(noticeHideKey(id)) === '1' } catch { return false }
}

export function dismissNotice(id) {
  try { localStorage.setItem(noticeHideKey(id), '1') } catch {}
}
