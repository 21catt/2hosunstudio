-- 라운지 글 태그(멘션) — 태그된 회원 id 배열을 글에 저장.
-- 컬럼이 없어도 앱은 동작(태그 저장만 생략, 알림은 발송) — 실행하면 태그 표시까지 완성.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.
alter table posts add column if not exists mentioned_ids uuid[] default '{}';
