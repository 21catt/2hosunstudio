-- 라운지 글 한 달 자동 정리 (홈 고정 공지 제외) — pg_cron 스케줄
-- Supabase 대시보드 → SQL Editor에서 1회 실행하세요.
--
-- 정책(확정):
--   • 라운지 글(posts)은 작성 후 한 달이 지나면 자동 삭제 — 그 글의 댓글·좋아요·라운지 이미지(lounge-images)도 함께.
--   • 예외: 홈 상단 고정 공지(pinned_at 지정 글)는 삭제하지 않음.
--   • 기록(class_records)·프로필 사진(class-records 버킷)은 절대 건드리지 않음 = 영구 보존.
--     (라운지에 공유된 사진은 lounge-images에 올라간 별도 사본이라, 그 사본만 지워도 프로필 원본은 그대로 남음)
--
-- 사전 준비: Database → Extensions 에서 pg_cron 활성화(아래 create extension 로도 시도됨).
--
-- ⚠️ 먼저 드라이런 — 무엇이 지워질지 미리 확인(아무것도 삭제 안 함):
--    select id, title, author_name, created_at
--    from posts
--    where created_at < now() - interval '1 month' and pinned_at is null
--    order by created_at;
--    (개수만: select count(*) from posts where created_at < now() - interval '1 month' and pinned_at is null;)

-- 1) pg_cron 확장 (대시보드에서 이미 켰다면 no-op)
create extension if not exists pg_cron;

-- 2) 정리 함수 — 한 달 지난 라운지 글 중 홈 고정(pinned_at)이 아닌 것 + 그 댓글·좋아요·스토리지 이미지 삭제.
--    반환값 = 삭제된 글 수.
create or replace function cleanup_old_lounge_posts()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  cutoff timestamptz := now() - interval '1 month';
  deleted_count integer;
begin
  -- 삭제 대상 수집 (한 달 지남 + 홈 고정 공지 아님)
  drop table if exists _old_posts;
  create temporary table _old_posts on commit drop as
    select id, images, image_url
    from posts
    where created_at < cutoff and pinned_at is null;

  -- 2-1) 연관 스토리지 파일(lounge-images) 정리 — 공개 URL에서 버킷 내 경로만 추출.
  --      class-records(프로필 사진)는 대상 아님. 실패해도 글 삭제는 진행되도록 예외 격리.
  begin
    delete from storage.objects o
    using (
      select distinct substring(u from '/lounge-images/(.*)$') as name
      from (
        select image_url as u from _old_posts where image_url is not null
        union all
        select jsonb_array_elements_text(to_jsonb(images)) from _old_posts where images is not null
      ) all_urls
      where u ~ '/lounge-images/'
    ) x
    where o.bucket_id = 'lounge-images' and o.name = x.name;
  exception when others then
    raise notice 'lounge-images 스토리지 정리 건너뜀: %', sqlerrm;
  end;

  -- 2-2) 연관 댓글·좋아요 (FK ON DELETE CASCADE 유무와 무관하게 먼저 명시 삭제)
  delete from comments where post_id in (select id from _old_posts);
  delete from likes    where post_id in (select id from _old_posts);

  -- 2-3) 글 삭제
  delete from posts where id in (select id from _old_posts);
  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

-- 3) 매일 19:00 UTC(≈다음날 04:00 KST, 저트래픽 시간) 자동 실행.
--    재실행해도 중복 등록 안 되게 기존 잡 해제 후 등록.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-old-lounge-posts') then
    perform cron.unschedule('cleanup-old-lounge-posts');
  end if;
end $$;

select cron.schedule('cleanup-old-lounge-posts', '0 19 * * *', $$ select cleanup_old_lounge_posts(); $$);

-- ── 확인 / 운영 ────────────────────────────────────────────────
-- 스케줄 등록 확인:   select * from cron.job where jobname = 'cleanup-old-lounge-posts';
-- 지금 즉시 1회 실행: select cleanup_old_lounge_posts();   -- 반환 = 삭제된 글 수
-- 실행 이력:          select * from cron.job_run_details order by start_time desc limit 5;
-- 보관 기간 변경:     함수의 interval '1 month' 를 원하는 값(예: '2 months')으로 바꿔 2)를 재실행.
-- 되돌리기(중단):     select cron.unschedule('cleanup-old-lounge-posts');
--                     drop function if exists cleanup_old_lounge_posts();
