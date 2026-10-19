-- 자리 대관(/rental) — 비회원도 시간·주·월 단위로 자리를 신청한다.
--   · rental_settings : 문구·가격·준비물·유의사항·고양이 안내(한 줄, id = 1). 누구나 읽고, 관리자만 쓴다.
--   · rental_requests : 들어온 신청. 이름·연락처가 있어 관리자만 읽고 고친다.
--                       신청은 서버(/api/rental, 서비스 키)가 넣는다 — 브라우저에서 직접 쓰는 정책은 없다.
-- Supabase 대시보드 → SQL Editor에서 1회 실행하세요. 여러 번 실행해도 안전합니다.

create table if not exists public.rental_settings (
  id          int primary key default 1 check (id = 1),
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);
insert into public.rental_settings (id) values (1) on conflict (id) do nothing;

alter table public.rental_settings enable row level security;

drop policy if exists "rental_settings read" on public.rental_settings;
create policy "rental_settings read" on public.rental_settings
  for select using (true);

drop policy if exists "rental_settings admin write" on public.rental_settings;
create policy "rental_settings admin write" on public.rental_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.rental_requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text not null,
  plan        text not null check (plan in ('hour', 'week', 'month')),
  medium      text,                     -- 유화·동양화 …
  date        date not null,            -- 시간 이용: 그날 / 장기: 시작일
  end_date    date,                     -- 장기 이용 마지막 날
  start_hour  int,                      -- 시간 이용만
  hours       int,                      -- 시간 이용만
  seat        text check (seat in ('A','B','C','D','E')),
  rentals     jsonb not null default '[]'::jsonb,   -- [{ id, name, price }] 장기 대여 품목
  amount      int not null default 0,
  memo        text,
  status      text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  admin_note  text
);
create index if not exists rental_requests_date_idx on public.rental_requests (date);

alter table public.rental_requests enable row level security;

drop policy if exists "rental_requests admin all" on public.rental_requests;
create policy "rental_requests admin all" on public.rental_requests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

select (select count(*) from public.rental_settings) as 설정, (select count(*) from public.rental_requests) as 신청;
