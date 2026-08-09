// 예약 마감 규칙 — 수업 시작 4시간 전부터는 예약 불가.
// 취소 규칙(수업 4시간 전 취소 불가)과 같은 기준이라 상수를 한 곳에 둔다.
// 예약 경로가 여러 개(일반·원데이·모임·요청·자율창작)라 판정은 반드시 이 함수를 경유할 것.

export const BOOKING_CUTOFF_HOURS = 4

// 지금부터 수업 시작까지 남은 시간(시간 단위). 지난 시간이면 음수.
export function hoursUntilClass(dateStr, startTime) {
  if (!dateStr) return Infinity
  const hhmm = String(startTime || '00:00').split('~')[0].slice(0, 5)
  const start = new Date(`${dateStr}T${hhmm}:00`)
  if (isNaN(start)) return Infinity
  return (start.getTime() - Date.now()) / 3600000
}

// 예약하기엔 너무 늦었는가(4시간 이내 또는 이미 지난 수업)
export function isTooLateToBook(dateStr, startTime) {
  return hoursUntilClass(dateStr, startTime) < BOOKING_CUTOFF_HOURS
}

// 안내 메시지 — 이미 지난 수업과 임박한 수업을 구분해 알려준다.
export function bookingCutoffMessage(dateStr, startTime) {
  const h = hoursUntilClass(dateStr, startTime)
  if (h < 0) return '이미 지난 수업이에요 🐾\n다른 날짜를 선택해 주세요.'
  // 총 분으로 환산 후 시/분 분해 — 시간과 분을 따로 반올림하면 "1시간 60분"이 나온다
  const mins = Math.max(1, Math.round(h * 60))
  const left = mins < 60 ? `${mins}분`
    : mins % 60 === 0 ? `${mins / 60}시간`
    : `${Math.floor(mins / 60)}시간 ${mins % 60}분`
  return `수업 시작 ${BOOKING_CUTOFF_HOURS}시간 전부터는 예약할 수 없어요 🐾\n(수업까지 ${left} 남음)\n\n다른 시간이나 날짜를 선택해 주세요.`
}
