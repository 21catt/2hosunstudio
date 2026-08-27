-- 수업 편집·강사 지정 = 승인된 관리자만 (2026-08-26)
--
-- 화면은 이미 맞다: /admin/schedule·/admin/curriculum 은 admin 전용,
-- /admin/teachers(강사 지정)는 오너 전용, 강사는 출석·기록·알림만 들어간다.
--
-- ⚠️ 문제는 DB 쪽 한 겹. migration-class-admin-write.sql 이 만든 정책이
--    JWT 의 user_metadata.role 만 본다:
--      using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
--    RLS 는 정책들의 OR 이라, 이 정책이 남아 있으면
--    ① 승인 전 관리자(approved=false)도 수업·시간·강사 지정을 고칠 수 있고
--    ② 메타와 표가 어긋난 계정도 메타만으로 통과한다.
--    (강사는 role 이 teacher 라 이 정책으로도 막힌다 — 강사 차단은 원래 정상)
--
-- 그래서 판정을 public.is_admin() 하나로 모은다. 그 함수는 users 표를 보고
-- approved 까지 확인한다(migration-staff-approval-rls.sql).

-- 옛 JWT 기반 정책 제거
drop policy if exists "admin write class_courses"    on public.class_courses;
drop policy if exists "admin write class_schedules"  on public.class_schedules;
drop policy if exists "admin write class_exceptions" on public.class_exceptions;

-- 읽기(누구나) + 쓰기(승인된 관리자만) 를 다시 못박는다 — 여러 번 실행해도 안전
do $$
declare t text;
begin
  foreach t in array array['class_courses','class_schedules','class_exceptions','course_curriculum']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to anon, authenticated using (true)', t, t);

    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- 확인 — 네 표에 read / admin_write 두 줄씩만 남아야 한다.
-- 'admin write …' 같은 옛 이름이 보이면 아직 남은 것이다.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('class_courses','class_schedules','class_exceptions','course_curriculum')
order by tablename, policyname;
