-- 학생/작가가 '자기 자신의' user_prefs 행을 저장(insert/update)할 수 있게 하는 RLS 정책.
-- 이게 없으면 테마·프로필·냥밭 취향값 upsert가 조용히 실패해 계정에 안 남고,
-- 다른 페이지 로드 시 계정의 옛 값(또는 없음)으로 되돌아간다(홈 배경 하얘짐의 뿌리 원인).
-- 멱등(idempotent) — 이미 적용돼 있어도 안전하게 다시 실행 가능.
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

-- 1) 개인화 컬럼 보장(없을 때만 추가)
alter table user_prefs add column if not exists theme text;
alter table user_prefs add column if not exists farm_cat text;
alter table user_prefs add column if not exists profile_cat text;
alter table user_prefs add column if not exists harvest_count integer default 0;
alter table user_prefs add column if not exists mood_style text;
alter table user_prefs add column if not exists unlock_all boolean default false;

-- 2) RLS 활성화(이미 켜져 있으면 무시)
alter table user_prefs enable row level security;

-- 3) 본인 행만 쓰기(insert/update/delete) 허용 — 핵심
drop policy if exists "self write user_prefs" on user_prefs;
create policy "self write user_prefs" on user_prefs
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4) upsert(onConflict user_id)용 유니크 제약 — 이미 있거나 PK면 무시.
--    (혹시 user_id 중복 행이 있어 오류가 나면 이 문장만 건너뛰세요. 위 1~3이 핵심입니다.)
create unique index if not exists user_prefs_user_id_key on user_prefs (user_id);
