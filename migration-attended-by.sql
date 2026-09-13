-- 출석 체크한 사람 기록 (2026-09-13)
-- 관리자·담당 강사 누가 체크해도 같은 행(bookings.attended)을 보므로 결과는 이미 공유된다.
-- 이 컬럼은 "누가 체크했는지"를 출석 화면에 보여 주기 위한 것 — 없어도 출석 체크는 동작한다.
alter table public.bookings add column if not exists attended_by uuid references auth.users(id) on delete set null;
notify pgrst, 'reload schema';
select count(*) as 컬럼있음 from information_schema.columns
where table_name = 'bookings' and column_name = 'attended_by';
