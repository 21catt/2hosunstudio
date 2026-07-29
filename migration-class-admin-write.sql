-- 모든 관리자(role=admin)가 수업·시간·예외를 편집할 수 있게 하는 RLS 쓰기 정책.
-- 증상: 특정 관리자만 수정되고, 다른 관리자의 '수업 시간 수정'이 조용히 반영 안 됨(RLS 차단).
-- 판별 기준 = JWT user_metadata.role = 'admin' (앱의 관리자 판별과 동일, 다른 admin 정책들과 일관).
-- 멱등 — 이미 있으면 교체. 기존 '학생 읽기' 정책과 OR로 합쳐지므로 학생 조회는 그대로 유지됨.
-- ⚠️ 이 정책은 RLS가 켜져 있어야 효력. 각 테이블 RLS가 꺼져 있었다면(=원래 누구나 쓰기 가능)
--    이 버그는 RLS 문제가 아니며, 앱의 저장 실패 알림에 뜬 실제 사유를 확인하세요.
-- Supabase 대시보드 → SQL Editor에서 실행.

-- 수업
drop policy if exists "admin write class_courses" on class_courses;
create policy "admin write class_courses" on class_courses for all to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 수업 시간(스케줄)
drop policy if exists "admin write class_schedules" on class_schedules;
create policy "admin write class_schedules" on class_schedules for all to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 요일 예외
drop policy if exists "admin write class_exceptions" on class_exceptions;
create policy "admin write class_exceptions" on class_exceptions for all to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
