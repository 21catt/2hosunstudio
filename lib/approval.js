// 승인 여부의 진실은 public.users.approved 다 (2026-08-26)
//
// ⚠️ auth 의 user_metadata.approved 는 화면이 빨리 판정하려고 두는 사본일 뿐이고,
//    실제로 어긋난다. 오너 계정이 users.approved = true 인데 메타만 false 인 상태였고,
//    메타만 보고 막았더니 오너가 로그인에서 잠겼다.
//
// 규칙: 메타가 "승인 전"으로 보이면 그때만 표를 한 번 확인한다.
//   · 표가 approved = false  → 진짜 대기 → 막는다
//   · 표가 true / 행 없음     → 통과시키고, 메타를 조용히 맞춰 둔다(다음부터 질의 0)
// 정상 계정은 이 경로를 아예 안 탄다(질의 0).
import { supabase } from './supabase'
import { isPendingStaff } from './roles'

export async function staffBlocked(user) {
  if (!isPendingStaff(user)) return false
  const { data, error } = await supabase
    .from('users').select('approved').eq('id', user.id).maybeSingle()
  if (error) return true                    // 확인 못 하면 막는 쪽이 안전하다
  if (data?.approved === false) return true // 진짜 승인 대기
  // 어긋난 메타 자가 치유 — 실패해도 이번 로그인은 통과시킨다
  try { await supabase.auth.updateUser({ data: { approved: true } }) } catch {}
  return false
}
