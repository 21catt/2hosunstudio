-- 회원 상세 개선 — 첫 등록일 · 총 수강기간(정지 제외) · 일시정지 · 지난 수강권 이력
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

-- ① 수강권 발급 이력(append-only 로그) — grantTicket 이 기존 수강권을 지워도 이력은 남는다.
--    "몇 번 발급했는지 / 4회·8회 어떤 권을 줬는지"를 여기서 조회.
create table if not exists ticket_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text,
  total int,
  days int,
  granted_at timestamptz default now()
);
create index if not exists ticket_grants_user_idx on ticket_grants(user_id, granted_at desc);

alter table ticket_grants enable row level security;
-- 앱의 다른 테이블과 동일한 느슨한 신뢰 모델(인증 사용자 = 관리자 화면). 발급 횟수는 민감정보 아님.
drop policy if exists "ticket_grants read"  on ticket_grants;
drop policy if exists "ticket_grants write" on ticket_grants;
create policy "ticket_grants read"  on ticket_grants for select using (auth.role() = 'authenticated');
create policy "ticket_grants write" on ticket_grants for insert with check (auth.role() = 'authenticated');

-- ② 일시정지 — 활성 수강권에 정지 시작 시각. 정지 중에는 만료일(수강일)이 흐르지 않는다.
alter table tickets add column if not exists paused_at timestamptz;

-- ③ 등록일 · 정지 누적일 — 첫 등록일 표시 + 총 수강기간에서 정지 기간 제외
alter table users add column if not exists created_at  timestamptz default now();
alter table users add column if not exists paused_days int default 0;

-- ④ 기존 수강권 1건씩 발급 이력 시드(최초 1회만 — 이력이 완전히 비어 있을 때).
insert into ticket_grants (user_id, type, total, granted_at)
select user_id, type, total, now()
from tickets
where not exists (select 1 from ticket_grants);
