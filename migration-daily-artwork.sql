-- 오늘의 그림: 관리자 덮어쓰기 (선택 기능)
--
-- ⚠️ 이 테이블이 없어도 앱은 정상 동작한다 — 고정 목록(lib/dailyArtwork.js)으로 돈다.
--    덮어쓰기를 쓰고 싶을 때만 Supabase SQL Editor 에 붙여 실행한다.
--
-- 쓰는 법: 날짜 한 줄 = 그날의 덮어쓰기. **빈 칸은 고정 목록 값을 그대로 쓴다**
--          (예: note 만 넣으면 그림·작가는 그대로이고 설명만 바뀐다).
--          enabled=false 로 두면 그날은 아무것도 안 뜬다.

create table if not exists public.daily_artworks (
  id         uuid primary key default gen_random_uuid(),
  on_date    date not null unique,
  artist     text,
  artist_ko  text,
  bio        text,
  title      text,
  title_ko   text,
  year       text,
  medium     text,
  image      text,          -- 퍼블릭 도메인 이미지 URL 또는 storage 업로드 URL
  source     text,          -- 출처 링크
  crop       text,          -- 띠에 보일 디테일 위치, 예: '38% 52%'
  tease      text,          -- 띠 한 줄 질문
  note       text,          -- 설명. **강조** 는 굵게 표시된다
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.daily_artworks enable row level security;

-- 누구나 읽는다(비로그인 수강생도 본다)
drop policy if exists "daily_artworks read" on public.daily_artworks;
create policy "daily_artworks read" on public.daily_artworks
  for select using (true);

-- 쓰기는 관리자만
drop policy if exists "daily_artworks admin write" on public.daily_artworks;
create policy "daily_artworks admin write" on public.daily_artworks
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
