-- 개설 수업별 '핵심 내용' 저장용 컬럼 (Supabase SQL Editor에서 실행)
-- 컬럼이 없어도 앱은 동작하며(핵심 내용이 빈 상태로 표시), 실행하면
-- 관리자 커리큘럼 화면에서 작성한 핵심 내용이 저장되고 학생 화면에 노출됩니다.
alter table class_courses add column if not exists core_content text;

-- 핵심 내용 사진(공개 URL 배열) 저장용 컬럼. 없어도 앱은 동작(사진 없이 표시).
alter table class_courses add column if not exists core_images text[];
