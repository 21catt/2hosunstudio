-- 첫 화면 「요즘 스튜디오」 사진 — 관리자가 고른 글만 (2026-08-26)
--
-- 비회원 첫 화면에 작업 사진 한 줄을 띄운다. 라운지 최신 글을 자동으로 끌어오지 않고,
-- **관리자가 고른 글의 사진만** 나간다(사용자 확정). 공지 고정(pinned_at)과 같은 방식.
--
-- 기본값 null = 아무것도 안 걸린 상태 → 첫 화면에 그 줄이 아예 안 뜬다.

alter table public.posts
  add column if not exists featured_at timestamptz;

notify pgrst, 'reload schema';

select count(*) as 컬럼있음 from information_schema.columns
where table_name = 'posts' and column_name = 'featured_at';
