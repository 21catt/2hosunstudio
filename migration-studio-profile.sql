-- 화실 소개(오시는 길·화실 사진) — 비회원 소개 페이지(/intro)에 보이는 정보.
-- 한 줄짜리 표(id = 1). 누구나 읽고, 관리자만 쓴다.
-- 사진 파일은 기존 공개 버킷 seat-photos 의 studio/ 폴더에 올린다(자리사진과 같은 업로드 권한).
-- Supabase 대시보드 → SQL Editor에서 1회 실행하세요.

create table if not exists public.studio_profile (
  id              int primary key default 1 check (id = 1),
  address         text,          -- 도로명 주소
  address_detail  text,          -- 층·호수
  directions      text,          -- 찾아오는 길 안내(역·출구·도보 시간 등)
  map_url         text,          -- 네이버/카카오 지도 공유 링크(비우면 주소로 검색)
  photos          jsonb not null default '[]'::jsonb,  -- [{ url, caption }]
  updated_at      timestamptz default now()
);

insert into public.studio_profile (id) values (1) on conflict (id) do nothing;

alter table public.studio_profile enable row level security;

drop policy if exists "studio_profile read" on public.studio_profile;
create policy "studio_profile read" on public.studio_profile
  for select using (true);

drop policy if exists "studio_profile admin write" on public.studio_profile;
create policy "studio_profile admin write" on public.studio_profile
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

select id, address, jsonb_array_length(photos) as 사진수 from public.studio_profile;
