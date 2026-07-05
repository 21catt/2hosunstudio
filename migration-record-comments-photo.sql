-- 프로필(인스타형) 공개 사진 댓글 — 사진별로 달리도록 record_comments에 photo_id 추가.
-- 기록(record_id) 댓글과 사진(photo_id) 댓글이 한 테이블에 공존. 프로필 댓글은 photo_id로 스코프.
-- record_comments RLS는 이미 열려 있음(anon 읽기 / authenticated 쓰기) → 컬럼만 추가하면 앱에서 바로 동작.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

alter table record_comments add column if not exists photo_id uuid references class_record_photos(id) on delete cascade;

create index if not exists record_comments_photo_id_idx on record_comments(photo_id);
