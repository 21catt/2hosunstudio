-- 학생 개인 테마 설정 저장용 컬럼 (Supabase SQL Editor에서 실행)
-- 컬럼이 없어도 앱은 동작하며(기기 localStorage로만 유지), 실행하면 계정 단위로 동기화됩니다.
alter table user_prefs add column if not exists theme text;

-- 냥밭 농부냥 선택 저장용 컬럼 (없어도 기기 localStorage로 동작)
alter table user_prefs add column if not exists farm_cat text;

-- 프로필 사진(픽셀 고양이 얼굴) 저장용 컬럼 (없어도 기기 localStorage로 동작)
alter table user_prefs add column if not exists profile_cat text;

-- 냥밭 수확 근황(수확한 작물 수) 저장용 컬럼
alter table user_prefs add column if not exists harvest_count integer default 0;
