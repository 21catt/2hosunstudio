-- 강사(teacher) 역할 분리 (2026-08-09)
--
-- 배경: 지금까지 '강사 = role admin' 이라, 강사도 오너와 똑같이 수강권 부여·회원 삭제·
--       전체 기록 열람이 가능했다. 또 가입 시 approved 를 저장만 하고 아무도 검사하지 않아
--       강사 가입 즉시 관리자 권한이 생겼다.
--
-- 이 마이그레이션은 컬럼 '추가'만 한다(ADD) — 기존 동작에 영향 없음.
--   · users.approved : 강사 승인 여부. 기존 회원은 전부 true(승인됨)로 채운다.
--   · 앞으로 강사 가입은 approved=false 로 들어오고, 오너가 회원 관리에서 승인해야 로그인된다.
--
-- ⚠️ 로그인 차단 판정은 auth 의 user_metadata.approved 를 본다.
--    이 컬럼은 관리자 화면 표시·조회용이고, 실제 승인은 /api/admin/approve-teacher 가
--    두 곳(auth 메타 + 이 컬럼)을 함께 갱신한다.
--
-- Supabase 대시보드 → SQL Editor 에서 1회 실행하세요.

alter table public.users add column if not exists approved boolean;

-- 기존 회원(학생·작가·기존 관리자)은 모두 승인 상태로 간주
update public.users set approved = true where approved is null;

-- ── 기존 강사 계정을 teacher 로 내리려면(선택) ─────────────────────────
-- 양승민 쌤은 오너 겸 강사이므로 admin 을 유지한다(admin 이 강사 기능을 포함).
-- 다른 강사들은 새로 '강사 가입' 후 승인받는 방식이므로 보통 아래는 실행할 필요가 없다.
--   update public.users set role = 'teacher', approved = true where name = '홍길동';
--   -- auth 쪽 메타도 함께 바꿔야 한다(대시보드 Authentication → 해당 사용자 → user_metadata)

-- ── 확인 ────────────────────────────────────────────────
-- select name, role, approved from public.users order by role, name;
