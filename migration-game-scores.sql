-- 미니게임 순위(리더보드) — 게임별 사용자 최고점 + 이름. Supabase 대시보드 → SQL Editor에서 1회 실행.
-- 리더보드는 누구나 열람(이름·점수 공개), 점수 등록/갱신은 본인만.

create table if not exists game_scores (
  game text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game, user_id)
);
create index if not exists game_scores_rank_idx on game_scores (game, score desc);

alter table game_scores enable row level security;

-- 열람: 전체 공개(리더보드)
drop policy if exists game_scores_read on game_scores;
create policy game_scores_read on game_scores for select using (true);

-- 등록: 본인 것만
drop policy if exists game_scores_insert on game_scores;
create policy game_scores_insert on game_scores for insert with check (auth.uid() = user_id);

-- 갱신: 본인 것만
drop policy if exists game_scores_update on game_scores;
create policy game_scores_update on game_scores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 확인: select game, name, score from game_scores order by game, score desc;
