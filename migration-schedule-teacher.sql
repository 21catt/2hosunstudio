-- 수업 '타임별' 담당 강사 (2026-08-09)
--
-- 배경: 담당 강사가 수업(class_courses.teacher_id) 단위로만 있어서,
--       같은 수업이라도 요일·시간대마다 강사가 다른 경우를 표현할 수 없었다.
--
-- 규칙: class_schedules.teacher_id 가 있으면 그 타임의 담당 강사,
--       비어 있으면(null) 수업의 담당 강사를 그대로 따른다(상속).
--       → 기존 데이터는 전부 null 이므로 동작 변화 없음.
--
-- 이 값이 쓰이는 곳:
--   · 강사 화면의 "내 수업/내 담당 회원"
--   · 예약·취소 알림 라우팅(담당 강사 + 오너)
--
-- Supabase 대시보드 → SQL Editor 에서 1회 실행하세요.

alter table public.class_schedules add column if not exists teacher_id uuid;

-- ── 확인 ────────────────────────────────────────────────
-- 타임별 담당이 지정된 목록:
--   select c.name, s.day_of_week, s.start_time, s.end_time, u.name as teacher
--   from class_schedules s
--   join class_courses c on c.id = s.course_id
--   left join users u on u.id = s.teacher_id
--   order by c.name, s.start_time;
