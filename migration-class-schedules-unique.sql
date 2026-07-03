-- 수업 스케줄 중복 방지 유니크 인덱스 (Supabase SQL Editor에서 실행 권장)
-- 배경: 같은 (수업, 요일, 시작, 종료) 스케줄 행이 수천 개 중복 적재되어
-- 임베드 조회가 1000행에서 잘리고, 관리자 수업시간 수정이 학생 화면에 반영되지 않았음.
-- 중복 데이터는 2026-07-03 정리 완료(2,792→35행). 이 인덱스는 재발을 DB 차원에서 차단한다.
-- (앱 코드도 자가 치유 diff로 고쳤으므로 인덱스 없이도 동작하지만, 실행해 두면 안전)
create unique index if not exists class_schedules_unique_slot
  on class_schedules (course_id, day_of_week, start_time, end_time);
