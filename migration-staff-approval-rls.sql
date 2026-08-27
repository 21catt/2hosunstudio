-- 승인 전 직원은 관리자가 아니다 (2026-08-26)
--
-- ⚠️ 왜 필요한가: 관리자 가입이 열리면서 "승인 전 계정"이 생긴다. 그 계정도 가입 직후
--    세션(로그인 토큰)을 갖는다. 화면(로그인·관리자 홈)에서는 isPendingStaff 로 막지만,
--    RLS 의 is_admin() 이 role 만 보면 **DB 는 그대로 열린다** — anon key 로 직접 요청하면
--    수강권·회원·기록을 전부 쓸 수 있다. 화면만 막는 것은 잠금이 아니다.
--
-- 기존 회원은 approved = true 이거나 null(옛 행)이라, coalesce 로 null 은 승인으로 본다
-- → 지금 동작에는 영향 없음.
--
-- migration-rls-enable.sql 을 이미 실행했다면 이 파일만 추가로 실행하면 된다.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
      and coalesce(u.approved, true) = true      -- 승인 전 관리자는 관리자가 아니다
  )
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin','teacher')
      and coalesce(u.approved, true) = true
  )
$$;

-- 확인 — 승인 대기 중인 직원이 있는지(있다면 그 계정은 지금 DB 권한이 없다)
select id, name, role, approved from public.users
where role in ('admin','teacher') and approved = false;
