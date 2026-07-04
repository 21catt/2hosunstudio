-- 프로필 고양이가 남에게도(비가입자 포함) 보이도록 user_prefs 읽기 공개
-- 원인: user_prefs는 자기 행만 읽혀서, 라운지에서 남의 profile_cat을 못 읽어 전부 기본 고양이로 보임.
-- 프로필/테마 등 개인화 취향값이라 읽기 공개해도 민감정보 아님. (쓰기는 기존 정책 그대로 = 본인만)
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

drop policy if exists "public read user_prefs" on user_prefs;
create policy "public read user_prefs" on user_prefs
  for select
  to anon, authenticated
  using (true);
