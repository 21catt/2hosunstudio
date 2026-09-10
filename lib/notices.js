// 접속하면 뜨는 안내 팝업 — 기간이 지나면 저절로 사라진다.
//
// ⚠️ 여기 배열이 유일한 진실이다. 새 공지 = 항목 한 줄 추가.
//    id 는 "다시 보지 않기" 기억에 쓰이므로 한 번 정하면 바꾸지 않는다
//    (바꾸면 이미 닫은 사람에게 다시 뜬다).
// from·until 은 **표시 기간**(YYYY-MM-DD, until 당일까지 포함).
export const POPUP_NOTICES = [
  {
    // ⚠️ id 를 바꾸면 이미 "다시 보지 않기"를 누른 사람에게도 다시 뜬다.
    //    이번엔 그게 의도다 — 휴무 안내가 아니라 인사를 새로 전하는 것이라 모두가 봐야 한다.
    id: 'chuseok-2026-greeting',
    emoji: '🌕',
    image: '/farm/cat-bucket.png',   // 농부 냥냥이가 나와서 인사한다
    imageAlt: '농부 냥냥이',
    title: '농부 냥냥이의 추석 인사',
    lines: [
      '올해도 여러분과 함께 그리고, 보고,',
      '이야기 나누며 지냈습니다.',
      '',
      '이렇게 같은 자리에서 무언가를',
      '계속 들여다볼 수 있다는 것이,',
      '당연히 주어지는 시간은 아니라는 걸',
      '요즘 자주 생각하게 됩니다.',
      '',
      '늘 고맙습니다.',
      '',
      '풍성한 한가위 보내시고,',
      '다음 수업에서 뵙겠습니다.',
    ],
    closing: '9월 24일(목)~26일(토) 추석 연휴 휴무\n27일(일)부터 평소대로 진행합니다 🌾',
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
