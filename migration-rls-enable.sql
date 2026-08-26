-- ─────────────────────────────────────────────────────────────
-- RLS 켜기 (2026-08-26) — Security Advisor: rls_disabled_in_public
--
-- 목표: "아무나 읽고 고치고 지울 수 있는" 상태를 끝낸다.
-- 원칙: 쓰기(insert/update/delete)는 본인 또는 운영진만.
--       읽기는 지금 화면이 실제로 읽는 만큼만 열어 둔다(끊기면 안 되므로).
--       ⚠️ 그래서 이번 단계로 "읽기"까지 다 막히지는 않는다 — 아래 [남는 것] 참고.
--
-- 실행 순서: 1) 아래를 통째로 SQL Editor 에 붙여 실행(여러 번 실행해도 안전)
--            2) 앱에서 확인: 예약·기록·라운지·알림·푸시·비회원 캘린더
--            3) Advisors → Security 다시 보기
--
-- ⚠️ 이 파일보다 먼저 배포돼야 하는 코드 변경이 있다(같은 커밋):
--    /api/push/* 가 anon key → service-role 로 바뀌었다. 이전 코드가 떠 있는 상태에서
--    push_subscriptions 에 RLS 를 켜면 푸시가 조용히 멎는다.
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


-- ── 1. 서버에서만 쓰는 표 = 정책 없이 잠근다 ──────────────────
-- service-role 은 RLS 를 통과하므로 앱 동작에는 영향이 없고, anon key 로는 아무것도 못 한다.
-- admin_kakao_tokens = 카카오 액세스·리프레시 토큰. 가장 급한 항목.
alter table public.admin_kakao_tokens  enable row level security;
alter table public.push_subscriptions  enable row level security;


-- ── 2. 누구나 읽어야 하는 표(비로그인 포함) · 쓰기는 운영진만 ──
-- 커리큘럼·시간표·좌석 사진은 로그인 전에도 보여 준다.
do $$
declare t text;
begin
  foreach t in array array['class_courses','class_schedules','class_exceptions',
                           'course_curriculum','seat_photos','locked_dates']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;


-- ── 3. 예약·수강권 ────────────────────────────────────────────
-- ⚠️ 읽기를 본인으로 좁히면 안 된다: 홈·캘린더가 "그 시간에 몇 자리 남았나"를
--    전체 예약을 세어 구한다(app/student/page.js). 비로그인 홈도 이 값을 쓴다.
--    그래서 select 는 열어 두고, 쓰기만 본인·운영진으로 잠근다. (좁히는 방법은 [남는 것] ①)
alter table public.bookings enable row level security;
drop policy if exists "bookings_read"  on public.bookings;
create policy "bookings_read"  on public.bookings for select to anon, authenticated using (true);
drop policy if exists "bookings_write" on public.bookings;
create policy "bookings_write" on public.bookings for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

-- 수강권 — 본인 것만 보이고, 부여·차감은 운영진(또는 원자적 RPC)
do $$
declare t text;
begin
  foreach t in array array['tickets','meeting_tickets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for select to authenticated using (user_id = auth.uid() or public.is_staff())', t, t);
    execute format('drop policy if exists "%s_staff_write" on public.%I', t, t);
    execute format('create policy "%s_staff_write" on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t, t);
  end loop;
end $$;


-- ── 4. 회원 ───────────────────────────────────────────────────
-- 서로의 이름·프로필 고양이를 읽는 곳이 많고(37곳), 알림 라우팅이 role='admin' 을 찾는다.
alter table public.users enable row level security;
drop policy if exists "users_read"        on public.users;
create policy "users_read"        on public.users for select to authenticated using (true);
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users for insert to authenticated with check (id = auth.uid());
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists "users_delete_admin" on public.users;
create policy "users_delete_admin" on public.users for delete to authenticated using (public.is_admin());


-- ── 5. 알림 ───────────────────────────────────────────────────
-- ⚠️ insert 를 본인으로 잠그면 예약·문의가 멈춘다: 학생이 담당 강사·오너의 행을 만들고,
--    '미가입 예약 요청'은 로그인하지 않은 사람도 만든다. 그래서 insert 만 열어 둔다.
--    (닫는 방법은 [남는 것] ②)
alter table public.notifications enable row level security;
drop policy if exists "notifications_own"    on public.notifications;
create policy "notifications_own"    on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert to anon, authenticated with check (true);
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());


-- ── 6. 수업 기록 ──────────────────────────────────────────────
-- 학생 = 자기 기록, 강사 = 남의 기록에 피드백을 쓴다.
alter table public.class_records enable row level security;
drop policy if exists "records_own" on public.class_records;
create policy "records_own" on public.class_records for all to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

-- 사진·피드백은 record_id 로 주인을 따라간다
alter table public.class_record_photos enable row level security;
drop policy if exists "record_photos" on public.class_record_photos;
create policy "record_photos" on public.class_record_photos for all to authenticated
  using (exists (select 1 from public.class_records r where r.id = record_id
                  and (r.user_id = auth.uid() or public.is_staff())))
  with check (exists (select 1 from public.class_records r where r.id = record_id
                  and (r.user_id = auth.uid() or public.is_staff())));

alter table public.class_record_feedback enable row level security;
drop policy if exists "record_feedback_read"  on public.class_record_feedback;
create policy "record_feedback_read"  on public.class_record_feedback for select to authenticated
  using (exists (select 1 from public.class_records r where r.id = record_id
                  and (r.user_id = auth.uid() or public.is_staff())));
drop policy if exists "record_feedback_write" on public.class_record_feedback;
create policy "record_feedback_write" on public.class_record_feedback for all to authenticated
  using (public.is_staff()) with check (public.is_staff());


-- ── 7. 라운지 ─────────────────────────────────────────────────
alter table public.posts enable row level security;
drop policy if exists "posts_read"   on public.posts;
create policy "posts_read"   on public.posts for select to authenticated using (true);
drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
drop policy if exists "posts_delete" on public.posts;
create policy "posts_delete" on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['comments','likes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_own_write" on public.%I', t, t);
    execute format('create policy "%s_own_write" on public.%I for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin())', t, t);
  end loop;
end $$;


-- ── 8. 확인 ───────────────────────────────────────────────────
-- rls_on = false 가 남아 있으면 그 표는 아직 열려 있다(이 파일에 없는 표일 수 있다).
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
--    서버 라우트(service-role)로 옮기고 이 정책을 지운다.
