-- 수강권 수업 시작일 (2026-09-10)
--
-- 관리자가 "이 회원은 며칟날부터 시작"을 정하고, 그 날짜로부터 주어진 기간 동안만
-- 수강권을 쓰게 한다. 예전에는 부여한 그 순간부터 기간이 흘렀다 —
-- 미리 결제해 두고 다음 달부터 나오는 경우에 기간이 먼저 깎였다.
--
-- ⚠️ nil = 키 부재 = 기존 동작(부여 즉시 시작). 기존 수강권은 아무 변화가 없다.
-- 만료일(expires_at)은 그대로 진실이다 — 시작일은 "언제부터 쓸 수 있나"만 정한다.
-- 일시정지·만료일 연장은 expires_at 만 밀므로 시작일과 무관하다.

alter table public.tickets
  add column if not exists start_date date;

-- 발급 이력에도 남긴다(테이블이 없으면 이 줄만 실패하고 위는 유지된다)
alter table public.ticket_grants
  add column if not exists start_date date;

notify pgrst, 'reload schema';

select count(*) as 컬럼있음 from information_schema.columns
where table_name = 'tickets' and column_name = 'start_date';
