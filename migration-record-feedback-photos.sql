-- 강사 피드백 이미지 첨부 — class_record_feedback 에 사진 경로 배열(jsonb) 추가.
-- 피드백 사진은 class-records 버킷의 {학생id}/{record_id}/fb_*.jpg 경로에 저장(비공개).
-- 업로드는 service-role 서버 라우트(/api/records/feedback-photo)가, 열람은 기존
-- /api/records/signed-url(소유자=학생 · 관리자 허용)이 서명한다. 컬럼만 추가하면 앱에서 바로 동작.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

alter table class_record_feedback
  add column if not exists photos jsonb;
