-- 라운지 홈 공지 지정 + 냥 꾸미기 전체 해금 + 수확 카운트 서버 저장
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

-- 1) 라운지 글 홈 공지 지정 — 관리자가 글을 공지로 지정하면 홈 하단에 노출 (최대 2개는 앱에서 강제)
alter table posts add column if not exists pinned_at timestamptz;

-- 2) 냥 꾸미기 전체 해금 — 관리자가 회원별로 켜면 수확 횟수 없이 프로필냥·농부냥 전부 사용 가능
alter table user_prefs add column if not exists unlock_all boolean not null default false;

-- 3) 수확 카운트 — farm 페이지가 이미 upsert하고 있으나 컬럼이 없어 조용히 실패하던 것 보완(기기 간 동기화)
alter table user_prefs add column if not exists harvest_count integer;
