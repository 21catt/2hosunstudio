import { supabase } from './supabase'

// 예약 잠금 — 관리자가 얹는 필터. 스케줄·수업 데이터는 그대로라 풀면 원래대로 돌아온다.
//
// 두 층이다:
//   · 날짜 전체 잠금  = schedule_id 가 비어 있는 행
//   · 타임 단위 잠금  = schedule_id 가 있는 행(그 수업의 그 시간만)
//
// ⚠️ 기존 화면은 fetchLockedDates().has(date) 로 날짜 잠금만 본다 — 그 계약은 그대로 둔다.
//    타임 잠금이 필요한 화면만 fetchLockedSlots() 를 함께 읽는다.

/** 날짜 전체 잠금: Map(YYYY-MM-DD → 메모). 테이블·컬럼이 없으면 빈 Map(안전 폴백). */
export async function fetchLockedDates() {
  let { data, error } = await supabase.from('locked_dates').select('date, note, schedule_id')
  if (error) {
    // schedule_id 컬럼 전(마이그레이션 미실행) — 예전 형태로 다시 읽는다
    ;({ data, error } = await supabase.from('locked_dates').select('date, note'))
    if (error) return new Map()
    return new Map((data || []).map(r => [r.date, r.note || '']))
  }
  return new Map((data || []).filter(r => !r.schedule_id).map(r => [r.date, r.note || '']))
}

/** 타임 단위 잠금: Map("YYYY-MM-DD|scheduleId" → 메모). 마이그레이션 전이면 빈 Map. */
export async function fetchLockedSlots() {
  const { data, error } = await supabase.from('locked_dates').select('date, note, schedule_id')
  if (error) return new Map()
  return new Map((data || []).filter(r => r.schedule_id)
    .map(r => [slotKey(r.date, r.schedule_id), r.note || '']))
}

/** 잠금 키 — 화면과 모델이 같은 문자열을 쓰도록 한 곳에서 만든다. */
export const slotKey = (date, scheduleId) => `${date}|${scheduleId}`

/** 이 타임이 예약 가능한가 — 날짜 전체 잠금과 타임 잠금을 함께 본다. */
export function slotLocked(lockedDates, lockedSlots, date, scheduleId) {
  if (lockedDates?.has(date)) return true
  return !!(scheduleId && lockedSlots?.has(slotKey(date, scheduleId)))
}
