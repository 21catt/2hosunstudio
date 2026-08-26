-- ─────────────────────────────────────────────────────────────
-- RLS 점검 (2026-08-26) — Supabase Security Advisor: rls_disabled_in_public
--
-- ⚠️ 이 파일은 "한 번에 실행하는 마이그레이션"이 아니다.
--    1단계(조회)를 먼저 돌려 실제 상태를 보고, 그 결과에 맞춰 2단계 이후를 고른다.
--    정책 없이 RLS 만 켜면 그 테이블을 쓰는 화면이 조용히 죽는다.
-- ─────────────────────────────────────────────────────────────

-- ── 1단계. 지금 상태 보기 (읽기만 — 아무것도 바꾸지 않는다) ────────
-- rls_on = false 인 줄이 경고 대상. policies = 0 인데 rls_on = true 면
-- 그 테이블은 이미 전부 잠겨 있다(앱에서 접근 실패하고 있을 수 있음).
select c.relname                                   as table_name,
       c.relrowsecurity                            as rls_on,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 정책 내용까지 보려면:
-- select tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies where schemaname = 'public' order by tablename, policyname;


-- ── 2단계. 지금 바로 켜도 안전한 것 ───────────────────────────────
-- admin_kakao_tokens = 카카오 액세스·리프레시 토큰. 코드에서 오직
-- service-role(supabaseAdmin: app/api/kakao/*, lib/kakao.js)로만 읽고 쓴다.
-- service-role 은 RLS 를 통과하므로 정책을 하나도 안 만들어야 맞다
-- (= anon key 로는 아무것도 못 읽는 상태). 앱 동작 영향 0.
--
-- ⚠️ 여기가 가장 급하다. RLS 가 꺼져 있었다면 anon key 만으로 토큰이 읽혔다.
--    켠 뒤에는 카카오 알림 발송이 되는지 한 번 확인하고,
--    만약 이 표가 그동안 노출돼 있었다면 카카오 토큰 재발급(재연동)을 권한다.
alter table public.admin_kakao_tokens enable row level security;


-- ── 3단계. 켜기 전에 반드시 정책부터 정해야 하는 것들 ──────────────
-- 아래는 "코드가 실제로 하는 일"이라 정책을 잘못 잡으면 바로 깨진다.
--
-- notifications
--   ⚠️ 학생이 '남의 행'을 만든다: 예약·문의·기록 댓글이 담당 강사와 오너
--      user_id 로 알림을 넣는다(lib/adminNotify.js notifyStaff).
--      게다가 '미가입 예약 요청'은 로그인하지 않은 anon 도 넣는다
--      (app/student/calendar/page.js). 그래서 insert 를
--      auth.uid() = user_id 로 잠그면 예약·문의 흐름이 통째로 멈춘다.
--   → 선택지 ① insert 는 넓게 열고(anon 포함) select/update/delete 만 본인으로 제한
--            ② 알림 생성을 서버 라우트(service-role)로 옮기고 insert 를 잠근다(권장, 코드 수정 필요)
--
-- users
--   가입 시 본인 행 insert, 관리자 화면에서 타인 update/delete,
--   알림 라우팅이 role='admin' 목록을 읽는다. 프로필 고양이·이름 표시로
--   서로의 행을 읽는 곳이 많다(37회 select).
--   → select 는 authenticated 전체 허용이 현실적. update/delete 는 본인 또는 admin.
--
-- bookings / tickets / meeting_tickets
--   본인 것 읽기·쓰기 + 관리자 전체. 취소·확정이 update 로 돈다.
--   ⚠️ tickets 차감은 RPC(원자적)가 따로 있다 — migration-ticket-atomic.sql 확인.
--
-- class_records / class_record_photos / class_record_feedback / record_comments
--   학생 = 본인 기록, 강사 = 담당 학생 기록에 피드백 insert(남의 행에 쓴다).
--   record_comments 는 이미 정책이 있다(migration-record-comments-rls.sql) — 그 모양을 참고.
--
-- posts / comments / likes (라운지)
--   로그인 사용자 전체 읽기, 작성자 본인 수정·삭제, 관리자 공지 지정(update).
--
-- push_subscriptions
--   본인 것만. 발송은 서버 라우트(service-role)라 select 를 잠가도 된다.
--
-- class_courses / class_schedules / class_exceptions / course_curriculum / seat_photos / locked_dates
--   비로그인 방문자도 읽어야 한다(커리큘럼·시간표를 로그인 전에 보여준다).
--   → select 를 anon 까지 허용, 쓰기는 admin 만.
--   ⚠️ course_curriculum·seat_photos 는 아직 정책 파일이 없다.
