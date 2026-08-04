-- 라운지 기록 글 ↔ 원본 수업기록 연결 (2026-08-03)
-- 배경: 수강생이 기록을 라운지에 공유하면 posts 행이 새로 생기는데,
--       원본 class_records 로 되짚을 열쇠가 전혀 없었다(사진은 공개 버킷에 랜덤 이름으로 재업로드).
-- 이 컬럼이 있어야 라운지 이미지 뷰어에서 "이 기록에 강사가 남긴 피드백"을 찾아 보여줄 수 있다.
--
-- 정책 '추가'만 한다(ADD, nullable) — 기존 posts 는 record_id 가 NULL 이라 피드백 표시 없음(무영향).
--   · 컬럼이 없으면 공유 insert 가 record_id 없이 폴백하도록 앱이 처리하므로, 미실행 상태여도 안전.
--   · 실행 후부터 새로 공유되는 기록 글에 record_id 가 채워진다(기존 글 소급 불가 — 공유 시 매칭 열쇠가 없었음).
-- Supabase 대시보드 → SQL Editor 에서 New query 로 1회 실행하세요.

alter table public.posts add column if not exists record_id uuid;
