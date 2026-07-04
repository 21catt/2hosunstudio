-- 작성자 프로필 고양이를 글·댓글에 함께 저장 (비가입자/타인도 정확한 프로필이 보이도록)
-- user_prefs는 RLS로 남의 행을 못 읽어 전부 기본 고양이로 보이던 문제 해결.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

alter table posts add column if not exists author_cat text;
alter table comments add column if not exists author_cat text;
