import { supabase } from './supabase'

// 잠긴 날짜(YYYY-MM-DD) 집합을 반환. 테이블이 아직 없으면(마이그레이션 전) 빈 집합으로 안전 폴백.
export async function fetchLockedDates() {
  const { data, error } = await supabase.from('locked_dates').select('date')
  if (error) return new Set()
  return new Set((data || []).map(r => r.date))
}
