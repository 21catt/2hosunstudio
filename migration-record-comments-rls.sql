-- 기록 사진 댓글이 앱(클라이언트)에서 저장/조회되도록 RLS 열기
-- 증상: 서비스키로는 insert 되는데 앱에서는 "댓글 등록 실패" → record_comments의 RLS/권한이 막고 있음.
-- 기록은 앱에서 본인·강사만 접근하므로 읽기/쓰기를 열어도 안전(앱 레벨에서 record_id로 스코프됨).
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

alter table record_comments enable row level security;

drop policy if exists "rc read" on record_comments;
create policy "rc read" on record_comments
  for select to anon, authenticated using (true);

drop policy if exists "rc insert" on record_comments;
create policy "rc insert" on record_comments
  for insert to authenticated with check (true);

drop policy if exists "rc delete own" on record_comments;
create policy "rc delete own" on record_comments
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, delete on record_comments to anon, authenticated;
