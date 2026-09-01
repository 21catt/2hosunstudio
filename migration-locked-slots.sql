-- 시간(타임) 단위 예약 잠금 (2026-08-26)
--
-- 지금 locked_dates 는 date 가 기본키라 "그날 전체"만 잠글 수 있다.
-- 여기에 schedule_id 를 더해 특정 타임만 잠글 수 있게 한다.
--   · schedule_id 가 비어 있는 행 = 그날 전체 잠금(기존 동작 그대로)
--   · schedule_id 가 있는 행       = 그 수업의 그 타임만 잠금
--
-- 기존 행은 schedule_id 가 null 이라 그대로 "날짜 전체 잠금"으로 남는다.
-- 잠금은 스케줄·수업 데이터를 건드리지 않는 '얹는 필터'라, 풀면 원래대로 복구된다.

-- ① 컬럼 추가 (수업 시간이 삭제되면 그 잠금도 같이 사라진다)
alter table public.locked_dates
  add column if not exists schedule_id uuid references public.class_schedules(id) on delete cascade;

-- ② 기본키를 date 에서 대리키로 옮긴다 — 한 날짜에 여러 타임 잠금이 들어가야 하므로
alter table public.locked_dates add column if not exists id uuid default gen_random_uuid();
update public.locked_dates set id = gen_random_uuid() where id is null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'locked_dates_pkey') then
    alter table public.locked_dates drop constraint locked_dates_pkey;
  end if;
end $$;

alter table public.locked_dates alter column id set not null;
alter table public.locked_dates add primary key (id);

-- ③ 같은 (날짜, 타임) 잠금이 두 번 들어가지 않게.
--    coalesce 로 감싼 이유: null 은 서로 다른 값으로 취급돼 '전체 잠금'이 중복 삽입된다.
create unique index if not exists locked_dates_date_slot_uniq
  on public.locked_dates (date, coalesce(schedule_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ④ 확인
select date, schedule_id, note from public.locked_dates order by date;
