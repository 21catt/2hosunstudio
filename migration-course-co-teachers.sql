-- 수업 담당 중복 배치 — 보조 담당 (2026-08-26)
--
-- 지금은 수업 담당이 한 명(class_courses.teacher_id)이라, 두 사람이 함께 맡거나
-- 관리자가 함께 붙어 있는 상황을 표현할 수 없다.
--
-- ⚠️ 학생 화면은 이 값을 쓰지 않는다. 학생에게 보이는 강사는
--    class_courses.teacher(대표 강사 **이름** 문자열)이다 — 표시와 권한이 원래 갈라져 있다.
--    그래서 보조 담당을 몇 명 넣어도 학생 화면에는 실제 수업하는 강사만 보인다.
--
-- 보조 담당이 얻는 것: 그 수업의 알림 · 출석/기록 화면의 담당 범위.
-- 기본값 빈 배열이라 기존 수업은 아무 변화 없다.

alter table public.class_courses
  add column if not exists co_teacher_ids uuid[] default '{}'::uuid[];

-- 배열 포함 조회(담당 범위 판정)가 커지면 쓰는 인덱스 — 지금 규모에선 없어도 된다
create index if not exists class_courses_co_teachers_idx
  on public.class_courses using gin (co_teacher_ids);

-- 확인
select id, name, teacher, teacher_id, co_teacher_ids from public.class_courses order by name;
