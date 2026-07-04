-- 관리자가 회원의 user_prefs를 수정할 수 있게 허용 (냥 꾸미기 전체 해금 토글용)
-- 판별 기준은 JWT의 user_metadata.role = 'admin' — 앱의 관리자 판별 방식과 동일.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

drop policy if exists "admin write user_prefs" on user_prefs;
create policy "admin write user_prefs" on user_prefs
  for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
