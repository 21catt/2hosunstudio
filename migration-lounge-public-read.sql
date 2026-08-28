-- 라운지를 비로그인(외부인)도 볼 수 있게 (2026-08-26)
--
-- 화면은 원래부터 비로그인 열람을 허용한다(app/lounge/page.js: "비로그인도 열람 가능 —
-- 글쓰기·공감·댓글은 로그인 유도"). 막고 있던 것은 migration-rls-enable.sql 이 건
-- posts/comments/likes 읽기 정책이 authenticated 전용이었던 것.
--
-- ⚠️ 열기 전에 알아야 할 것: 라운지에는 수강생이 "라운지 공유"로 올린 수업 기록 사진과
--    작성자 실명이 있다. 전부 공개하면 그것도 로그인 없이 보인다.
--    ✅ 사용자 확정(2026-08-26): **[A] 전체 공개**. RLS 켜기 전 동작 그대로 복원한다.
--    [B]는 나중에 좁히고 싶을 때를 위해 주석으로 남겨 둔다(그대로 두면 발동하지 않는다).
--    쓰기(글·댓글·공감)는 어느 쪽이든 로그인 사용자만 — 그대로다.

-- ─────────────────────────────────────────────
-- [A] 전체 공개 — RLS 켜기 전 동작 그대로 복원
-- ─────────────────────────────────────────────
drop policy if exists "posts_read" on public.posts;
create policy "posts_read" on public.posts
  for select to anon, authenticated using (true);

drop policy if exists "comments_read" on public.comments;
create policy "comments_read" on public.comments
  for select to anon, authenticated using (true);

drop policy if exists "likes_read" on public.likes;
create policy "likes_read" on public.likes
  for select to anon, authenticated using (true);

-- 프로필 고양이(user_prefs)는 이미 공개 읽기 — migration-user-prefs-public-read.sql

-- ─────────────────────────────────────────────
-- [B] 소식만 공개 (선택) — 위 [A] 대신 실행한다.
--     공지·전시회의·행사만 외부에 보이고, 수업 기록·기타는 로그인해야 보인다.
--     학생 작업 사진과 실명이 검색·공유되는 것이 걱정되면 이쪽.
-- ─────────────────────────────────────────────
-- drop policy if exists "posts_read" on public.posts;
-- create policy "posts_read" on public.posts for select to anon, authenticated
--   using (
--     (select auth.uid()) is not null                   -- 로그인 사용자는 전부
--     or tag in ('notice','exhibit','event')            -- 비로그인은 소식만
--   );
-- -- 댓글도 같은 규칙으로 좁힌다
-- drop policy if exists "comments_read" on public.comments;
-- create policy "comments_read" on public.comments for select to anon, authenticated
--   using (
--     (select auth.uid()) is not null
--     or exists (select 1 from public.posts p
--                where p.id = post_id and p.tag in ('notice','exhibit','event'))
--   );

-- 확인 — roles 에 anon 이 들어 있어야 한다
select tablename, policyname, cmd, roles
from pg_policies
where schemaname='public' and tablename in ('posts','comments','likes')
order by tablename, policyname;
