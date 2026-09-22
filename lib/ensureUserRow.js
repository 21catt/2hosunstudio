// 로그인한 계정의 public.users 행 보장 (2026-09-22 실사고)
//
// ⚠️ 왜 필요한가: 화면 권한은 auth 의 user_metadata.role 로 판정하는데, DB 의 RLS 는
//    public.users 를 본다(is_admin·is_staff). 그래서 users 행이 없는 계정은
//    **화면은 관리자로 열리는데 저장만 조용히 실패**한다 — 출석을 눌러도 새로고침하면 사라진다.
//    (실제로 양지운 님의 둘째 관리자 계정이 이 상태였다. 가입 때 insert 가 실패하면 이렇게 된다.)
import { supabase } from './supabase'

export async function ensureUserRow(user) {
  if (!user?.id) return
  const { data, error } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle()
  if (error || data) return                       // 이미 있으면(대부분) 아무것도 안 한다
  const md = user.user_metadata || {}
  const role = md.role || 'student'
  // ⚠️ 승인 전 직원이 스스로 승인되면 안 된다 — 직원은 메타가 승인일 때만 true
  const approved = role === 'admin' || role === 'teacher' ? md.approved === true : true
  const base = { id: user.id, name: md.name || '', phone: md.phone || '', role, categories: md.categories || [] }
  const res = await supabase.from('users').insert({ ...base, approved })
  if (res.error) await supabase.from('users').insert(base)   // approved 컬럼 없는 환경 폴백
}
