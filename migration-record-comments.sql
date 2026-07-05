-- 기록 사진 라이트박스 댓글 — 라운지 사진 댓글과 동일 UX
-- 기록은 본인만 보는 공간이라 댓글은 본인 메모/기록용.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

create table if not exists record_comments (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references class_records(id) on delete cascade,
  user_id uuid,
  author_name text,
  author_cat text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists record_comments_record_id_idx on record_comments(record_id);
