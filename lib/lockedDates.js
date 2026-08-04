import { supabase } from './supabase'

// 잠긴 날짜(YYYY-MM-DD) → 관리자 메모(note) 매핑을 반환. 테이블이 아직 없으면(마이그레이션 전) 빈 Map 으로 안전 폴백.
// Map 이라 기존 게이트의 .has(date) 는 그대로 동작하고, 메모가 필요한 화면만 .get(date) 로 읽는다(없으면 '').
export async function fetchLockedDates() {
  const { data, error } = await supabase.from('locked_dates').select('date, note')
  if (error) return new Map()
  return new Map((data || []).map(r => [r.date, r.note || '']))
}
