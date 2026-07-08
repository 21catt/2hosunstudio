-- 색 계획 카드 — 기록 사진에 팔레트(3원색·혼합·비율 등) 재편집용 JSON 첨부.
-- palette가 채워진 사진 = "색 계획 카드". 탭하면 삼색 도구를 그 값으로 재오픈한다.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

alter table class_record_photos
  add column if not exists palette jsonb;
