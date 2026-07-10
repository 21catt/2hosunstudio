-- 특정 날짜 예약 잠금(락) — 관리자가 날짜를 잠그면 그날 모든 수업/자율창작 예약이 차단된다.
-- 스케줄/수업 데이터는 건드리지 않으므로, 잠금을 해제하면 원래 개설되어 있던 수업이 그대로 복구된다.
-- 판별 기준은 JWT의 user_metadata.role = 'admin' — 앱의 관리자 판별 방식과 동일.
-- Supabase 대시보드 → SQL Editor에서 1회 실행하세요.

create table if not exists public.locked_dates (
  date        date primary key,
  note        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

alter table public.locked_dates enable row level security;

-- 전체 읽기(비회원 포함) — 캘린더에서 잠금 여부를 표시하기 위함
drop policy if exists "locked_dates read" on public.locked_dates;
create policy "locked_dates read" on public.locked_dates
  for select
  using (true);

-- 관리자만 쓰기(잠금/해제)
drop policy if exists "locked_dates admin write" on public.locked_dates;
create policy "locked_dates admin write" on public.locked_dates
  for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
