-- 라운지 글의 사진 크게 보기 (2026-08-26)
--
-- 지금 라운지 사진은 62px 썸네일로만 붙는다. 공지·전시 소식처럼 포스터가 본문인 글은
-- 그 크기로는 무엇인지 알아볼 수 없다. 글마다 "사진 크게" 를 켤 수 있게 한다.
--
-- 기본값 false — 기존 글과 새 글의 기본 모양은 그대로다.

alter table public.posts
  add column if not exists big_photo boolean default false;

notify pgrst, 'reload schema';

select count(*) as 컬럼있음 from information_schema.columns
where table_name = 'posts' and column_name = 'big_photo';
