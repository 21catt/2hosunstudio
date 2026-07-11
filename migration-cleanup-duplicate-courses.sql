-- 중복/공백 수업 이름 정리 (2026-07-11)
-- 배경: "색채 기초 "(끝 공백·비활성·회차 16개 보유)와 "색채 기초"(활성·회차 0개)가 분리되어
--       학생 커리큘럼/핵심내용 목록에 색채 기초가 안 보였음. 조소 기초 두상은 두 행으로 나뉘어 개설됨.
-- Supabase 대시보드 → SQL Editor에서 1회 실행하세요.

-- 1) 색채 기초 회차 16개를 현재 활성 수업 이름으로 이전
update course_curriculum set course_name = '색채 기초' where course_name = '색채 기초 ';

-- 2) 옛 색채 기초(비활성)는 예약 기록 12건 보존을 위해 남기되, 구분되는 이름으로 변경
update class_courses set name = '색채 기초 (지난 기수)'
  where id = '5580d5d7-6a82-41cf-96ab-084f842aed29';

-- 3) 수업 이름 앞뒤 공백 일괄 제거 (" 9월 시와새 회의 " 등)
update class_courses set name = trim(name) where name <> trim(name);
update course_curriculum set course_name = trim(course_name) where course_name <> trim(course_name);

-- 4) "조소 기초 두상" 두 행 병합 — 토요일 행의 스케줄·예약을 수요일 행으로 옮기고 빈 행 삭제
--    (한 수업에 요일 여러 개를 붙이는 구조가 정상. 예약 0건 확인 완료라 안전)
update class_schedules set course_id = '4193261a-18f4-49b4-83f0-6a8699d55ae3'
  where course_id = '72f7e0ca-7179-4912-8e6a-d9e1905ea9eb';
update bookings set course_id = '4193261a-18f4-49b4-83f0-6a8699d55ae3'
  where course_id = '72f7e0ca-7179-4912-8e6a-d9e1905ea9eb';
delete from class_exceptions where course_id = '72f7e0ca-7179-4912-8e6a-d9e1905ea9eb';
delete from class_courses where id = '72f7e0ca-7179-4912-8e6a-d9e1905ea9eb';
