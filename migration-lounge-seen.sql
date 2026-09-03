-- 라운지 새 글 배지 (2026-08-26)
--
-- "안 읽은 글"을 사람×글 표로 관리하면 글 하나에 회원 수만큼 행이 생긴다.
-- 대신 사람마다 **마지막으로 라운지를 본 시각** 하나만 저장하고,
-- 그 이후에 올라온 글(내가 쓴 것 제외)을 세어 배지에 띄운다.
--
-- user_prefs 는 이미 본인만 쓰기(self write) 정책이 있어 추가 정책이 필요 없다.

alter table public.user_prefs
  add column if not exists lounge_seen_at timestamptz;

notify pgrst, 'reload schema';

select count(*) as 컬럼있음 from information_schema.columns
where table_name = 'user_prefs' and column_name = 'lounge_seen_at';
