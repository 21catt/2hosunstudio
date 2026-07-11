-- 색채 기초 정리 (2026-07-11) — 원래 수업 유지 / 새 수업 삭제 / 예약 이관
-- 상황(DB 실측):
--   · 5580d5d7 "색채 기초 "(끝 공백·비활성) = 원래 수업, 스케줄 16 · 예약 12 · 회차 16 보유  → 살림
--   · be9c0cdc "색채 기초"(활성)          = 새로 개설한 수업, 예약 1(백종혜 7/12 일 16:00~18:00) → 삭제
-- Supabase 대시보드 → SQL Editor에서 New query로 열어 1회 실행하세요.

-- 1) 새 수업의 예약(백종혜)을 원래 수업의 같은 슬롯(일 16:00~18:00)으로 이관 + 수업명 오타 정정
update bookings
   set course_id   = '5580d5d7-6a82-41cf-96ab-084f842aed29',
       schedule_id = '2ad6d9f1-cf98-433f-b073-03834c499d59',
       class_name  = '색채 기초'
 where id = 'c9fdad2c-289c-423b-a7f5-1d2834e6cec0';

-- 2) 원래 수업 재활성화 + 이름 끝 공백 제거
update class_courses set is_active = true, name = '색채 기초'
 where id = '5580d5d7-6a82-41cf-96ab-084f842aed29';

-- 3) 원래 수업 회차 이름도 공백 제거(표시·매칭 일치)
update course_curriculum set course_name = '색채 기초' where course_name = '색채 기초 ';

-- 4) 새로 개설한 수업 삭제 (예약은 1에서 이미 이관됨 → 남은 예약 없어야 정상)
delete from class_schedules  where course_id = 'be9c0cdc-1b75-484e-8395-ece1892109db';
delete from class_exceptions where course_id = 'be9c0cdc-1b75-484e-8395-ece1892109db';
delete from bookings         where course_id = 'be9c0cdc-1b75-484e-8395-ece1892109db';
delete from class_courses    where id        = 'be9c0cdc-1b75-484e-8395-ece1892109db';

-- 5) 그 외 수업/회차 이름 앞뒤 공백 일괄 정리 (" 9월 시와새 회의 " 등)
update class_courses     set name        = trim(name)        where name        <> trim(name);
update course_curriculum set course_name = trim(course_name) where course_name <> trim(course_name);

-- 6) "조소 기초 두상" 두 행 병합 (둘 다 예약 0건 확인) — 토요일 행 → 수요일 행으로 스케줄 이전 후 삭제
update class_schedules set course_id = '4193261a-18f4-49b4-83f0-6a8699d55ae3'
 where course_id = '72f7e0ca-7179-4912-8e6a-d9e1905ea9eb';
delete from class_exceptions where course_id = '72f7e0ca-7179-4912-8e6a-d9e1905ea9eb';
delete from class_courses    where id        = '72f7e0ca-7179-4912-8e6a-d9e1905ea9eb';
