-- auth 메타의 approved 를 users 표에 맞춘다 (2026-08-26)
--
-- ⚠️ 왜: 승인 여부가 두 군데(users.approved / auth 메타 approved)에 있고 실제로 어긋나 있었다.
--    오너 계정이 users = true 인데 메타만 false 라, 메타를 보는 로그인 게이트가 오너를 잠갔다.
--    코드는 "메타가 대기로 보이면 표를 한 번 더 확인"하도록 고쳤지만(자가 치유),
--    이 SQL 로 한 번 맞춰 두면 그 확인 경로 자체를 안 타게 된다.

update auth.users a
set raw_user_meta_data = coalesce(a.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('approved', coalesce(u.approved, true))
from public.users u
where u.id = a.id
  and coalesce((a.raw_user_meta_data->>'approved')::boolean, true) is distinct from coalesce(u.approved, true);

-- 확인 — 어긋난 행이 0 이어야 한다
select u.name, u.role, u.approved as 표, (a.raw_user_meta_data->>'approved') as 메타
from public.users u join auth.users a on a.id = u.id
where coalesce((a.raw_user_meta_data->>'approved')::boolean, true) is distinct from coalesce(u.approved, true);
