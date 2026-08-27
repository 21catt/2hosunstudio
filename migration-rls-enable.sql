-- ─────────────────────────────────────────────────────────────
-- RLS 켜기 (2026-08-26) — Security Advisor: rls_disabled_in_public
--
-- 목표: "아무나 읽고 고치고 지울 수 있는" 상태를 끝낸다.
-- 원칙: 쓰기(insert/update/delete)는 본인 또는 운영진만.
--       읽기는 지금 화면이 실제로 읽는 만큼만 열어 둔다(끊기면 안 되므로).
--
-- ⚠️ 실행 전: 아래 코드가 배포돼 있어야 한다(이미 푸시됨 — Vercel 반영 확인).
--    /api/push/* 가 anon key → service-role 로 바뀌었다. 옛 코드가 떠 있는 상태에서
--    push_subscriptions 에 RLS 를 켜면 푸시가 조용히 멎는다(에러도 안 난다).
--
-- 실행: 통째로 붙여넣고 Run. 여러 번 실행해도 안전(idempotent).
--       없는 테이블은 건너뛴다(프로젝트마다 표가 조금씩 다르므로).
-- ─────────────────────────────────────────────────────────────

-- ── 0. 역할 판별 함수 ─────────────────────────────────────────
-- SECURITY DEFINER = 함수 안의 users 조회가 RLS 를 통과한다.
-- 이게 없으면 users 정책이 users 를 다시 읽어 무한 재귀가 난다.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','teacher'))
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;


-- ── 도우미: 없는 표는 건너뛰고, 정책은 이름으로 갈아끼운다 ────
create or replace function public.rls_apply(tbl text, pol text, cmd text, roles text,
                                            using_expr text, check_expr text default null)
returns void language plpgsql as $$
begin
  if to_regclass('public.' || tbl) is null then
    raise notice '건너뜀(표 없음): %', tbl;
    return;
  end if;
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists %I on public.%I', pol, tbl);
  execute format('create policy %I on public.%I for %s to %s %s %s',
    pol, tbl, cmd, roles,
    case when using_expr is null then '' else 'using (' || using_expr || ')' end,
    case when check_expr is null then '' else 'with check (' || check_expr || ')' end);
end $$;

-- 정책 없이 잠그기만(서버에서만 쓰는 표)
create or replace function public.rls_lock(tbl text)
returns void language plpgsql as $$
begin
  if to_regclass('public.' || tbl) is null then
    raise notice '건너뜀(표 없음): %', tbl;
    return;
  end if;
  execute format('alter table public.%I enable row level security', tbl);
end $$;


-- ── 1. 서버에서만 쓰는 표 = 정책 없이 잠근다 ──────────────────
-- service-role 은 RLS 를 통과하므로 앱 동작 영향 0, anon key 로는 아무것도 못 한다.
-- admin_kakao_tokens = 카카오 액세스·리프레시 토큰. 가장 급한 항목.
select public.rls_lock('admin_kakao_tokens');
select public.rls_lock('push_subscriptions');


-- ── 2. 누구나 읽어야 하는 표(비로그인 포함) · 쓰기는 관리자만 ──
-- 커리큘럼·시간표·좌석 사진은 로그인 전에도 보여 준다.
do $$
declare t text;
begin
  foreach t in array array['class_courses','class_schedules','class_exceptions',
                           'course_curriculum','seat_photos','locked_dates']
  loop
    perform public.rls_apply(t, t || '_read',        'select', 'anon, authenticated', 'true');
    perform public.rls_apply(t, t || '_admin_write', 'all',    'authenticated',
                             'public.is_admin()', 'public.is_admin()');
  end loop;
end $$;


-- ── 3. 예약 ───────────────────────────────────────────────────
-- ⚠️ 읽기를 본인으로 좁히면 안 된다: 홈·캘린더가 "그 시간에 몇 자리 남았나"를
--    전체 예약을 세어 구한다. 비로그인 홈도 이 값을 쓴다.
--    그래서 select 는 열어 두고, 쓰기만 본인·운영진으로 잠근다. (좁히는 법 = 맨 아래 ①)
select public.rls_apply('bookings', 'bookings_read',  'select', 'anon, authenticated', 'true');
select public.rls_apply('bookings', 'bookings_write', 'all',    'authenticated',
                        'user_id = auth.uid() or public.is_staff()',
                        'user_id = auth.uid() or public.is_staff()');

-- 수강권 — 본인 것만 보이고, 부여·차감은 운영진
do $$
declare t text;
begin
  foreach t in array array['tickets','meeting_tickets'] loop
    perform public.rls_apply(t, t || '_own',         'select', 'authenticated',
                             'user_id = auth.uid() or public.is_staff()');
    perform public.rls_apply(t, t || '_staff_write', 'all',    'authenticated',
                             'public.is_staff()', 'public.is_staff()');
  end loop;
end $$;


-- ── 4. 회원 ───────────────────────────────────────────────────
-- 서로의 이름·프로필 고양이를 읽는 곳이 많고(37곳), 알림 라우팅이 role='admin' 을 찾는다.
select public.rls_apply('users', 'users_read',         'select', 'authenticated', 'true');
select public.rls_apply('users', 'users_insert_self',  'insert', 'authenticated', null, 'id = auth.uid()');
select public.rls_apply('users', 'users_update_self',  'update', 'authenticated',
                        'id = auth.uid() or public.is_admin()', 'id = auth.uid() or public.is_admin()');
select public.rls_apply('users', 'users_delete_admin', 'delete', 'authenticated', 'public.is_admin()');


-- ── 5. 알림 ───────────────────────────────────────────────────
-- ⚠️ insert 를 본인으로 잠그면 예약·문의가 멈춘다: 학생이 담당 강사·오너의 행을 만들고,
--    '미가입 예약 요청'은 로그인하지 않은 사람도 만든다. 그래서 insert 만 열어 둔다.
--    (닫는 법 = 맨 아래 ②)
select public.rls_apply('notifications', 'notifications_own',    'select', 'authenticated',
                        'user_id = auth.uid()');
select public.rls_apply('notifications', 'notifications_insert', 'insert', 'anon, authenticated',
                        null, 'true');
select public.rls_apply('notifications', 'notifications_update', 'update', 'authenticated',
                        'user_id = auth.uid() or public.is_admin()',
                        'user_id = auth.uid() or public.is_admin()');
select public.rls_apply('notifications', 'notifications_delete', 'delete', 'authenticated',
                        'user_id = auth.uid() or public.is_admin()');


-- ── 6. 수업 기록 ──────────────────────────────────────────────
-- 학생 = 자기 기록, 강사 = 남의 기록에 피드백을 쓴다.
select public.rls_apply('class_records', 'records_own', 'all', 'authenticated',
                        'user_id = auth.uid() or public.is_staff()',
                        'user_id = auth.uid() or public.is_staff()');

-- 사진·피드백은 record_id 로 주인을 따라간다
select public.rls_apply('class_record_photos', 'record_photos', 'all', 'authenticated',
  'exists (select 1 from public.class_records r where r.id = record_id and (r.user_id = auth.uid() or public.is_staff()))',
  'exists (select 1 from public.class_records r where r.id = record_id and (r.user_id = auth.uid() or public.is_staff()))');

select public.rls_apply('class_record_feedback', 'record_feedback_read', 'select', 'authenticated',
  'exists (select 1 from public.class_records r where r.id = record_id and (r.user_id = auth.uid() or public.is_staff()))');
select public.rls_apply('class_record_feedback', 'record_feedback_write', 'all', 'authenticated',
  'public.is_staff()', 'public.is_staff()');


-- ── 7. 라운지 ─────────────────────────────────────────────────
select public.rls_apply('posts', 'posts_read',   'select', 'authenticated', 'true');
select public.rls_apply('posts', 'posts_insert', 'insert', 'authenticated', null, 'author_id = auth.uid()');
select public.rls_apply('posts', 'posts_update', 'update', 'authenticated',
                        'author_id = auth.uid() or public.is_admin()',
                        'author_id = auth.uid() or public.is_admin()');
select public.rls_apply('posts', 'posts_delete', 'delete', 'authenticated',
                        'author_id = auth.uid() or public.is_admin()');

do $$
declare t text;
begin
  foreach t in array array['comments','likes'] loop
    perform public.rls_apply(t, t || '_read',      'select', 'authenticated', 'true');
    perform public.rls_apply(t, t || '_own_write', 'all',    'authenticated',
                             'user_id = auth.uid() or public.is_admin()',
                             'user_id = auth.uid() or public.is_admin()');
  end loop;
end $$;


-- ── 8. 도우미 함수 정리 (정책은 그대로 남는다) ────────────────
drop function if exists public.rls_apply(text, text, text, text, text, text);
drop function if exists public.rls_lock(text);


-- ── 9. 확인 ───────────────────────────────────────────────────
-- rls_on = false 가 남아 있으면 그 표는 아직 열려 있다(이 파일에 없는 표일 수 있다 → 알려 주세요).
select c.relname as table_name, c.relrowsecurity as rls_on,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- ── [남는 것] 이번 단계로 안 닫히는 두 가지 ────────────────────
-- ① bookings 읽기가 열려 있다(좌석 수 계산 때문). 닫으려면 4개 컬럼만 있는 뷰를 만들고
--    홈·캘린더가 그 뷰를 읽게 바꾼다:
--      create view public.booking_seats as
--        select course_id, schedule_id, class_date, class_time from public.bookings where status='booked';
--    그 뒤 bookings_read 를 (user_id = auth.uid() or public.is_staff()) 로 좁힌다.
-- ② notifications 만들기가 열려 있다(비회원 예약 요청·강사 알림). 닫으려면 알림 생성을
--    서버 라우트(service-role)로 옮기고 그 정책을 지운다.
