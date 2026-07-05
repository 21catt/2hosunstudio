-- 개인 프로필(인스타형) 사진 공개/비공개
-- 기록 사진(class_record_photos)마다 프로필 공개 여부. 기본 false(비공개).
-- 외부인은 is_public = true 사진만 볼 수 있고, 본인/관리자는 전부 본다(서버에서 게이트).
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

alter table class_record_photos add column if not exists is_public boolean not null default false;
