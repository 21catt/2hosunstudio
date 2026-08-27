-- 양지운 = 양승민과 동일 권한(오너/관리자)로 (2026-08-26)
--
-- ⚠️ "관리자"를 정하는 값이 두 군데다. 둘 다 바꿔야 한다.
--    · auth.users.raw_user_meta_data->>'role'  → 로그인 판정(관리자 입구 통과)
--    · public.users.role                        → 관리자 화면·알림 라우팅·RLS is_admin()
--    한쪽만 바꾸면 "로그인은 되는데 화면이 비거나", "화면은 되는데 로그인이 막힌다".
--
-- ⚠️ 적용 후 양지운님은 반드시 로그아웃 → 재로그인. user_metadata 는 로그인 토큰에
--    들어 있어서, 이미 열려 있는 세션은 옛 역할을 그대로 들고 있다.

-- ── 1. 먼저 확인 (두 사람이 각각 한 줄씩인지, 동명이인이 없는지) ──
select u.id, u.name, u.role, u.approved, u.categories,
       (a.raw_user_meta_data->>'role')     as meta_role,
       (a.raw_user_meta_data->>'approved') as meta_approved,
       a.email
from public.users u
join auth.users a on a.id = u.id
where u.name in ('양승민', '양지운');
-- 동명이인·중복 행 진단 — count 가 1 이 아니면 아래를 실행하지 말 것
select name, count(*) as rows from public.users
where name in ('양승민','양지운') group by name;

-- ⚠️ 양지운이 두 줄 이상이면 아래를 실행하지 말고, 쓸 계정의 id 로
--    where 절을 (u.id = '…') 로 바꿔서 실행할 것.

-- ── 2. public.users — 양승민의 값을 그대로 복사 ────────────────
update public.users t
set role       = s.role,        -- admin
    approved   = s.approved,    -- true
    categories = s.categories   -- 담당 수업(강사 화면 범위)
from (select * from public.users where name = '양승민' order by id limit 1) s
where t.name = '양지운';

-- ── 3. auth 메타 — 로그인 판정용. 기존 값은 두고 두 키만 덮어쓴다 ──
update auth.users a
set raw_user_meta_data = coalesce(a.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin', 'approved', true)
where a.id in (select id from public.users where name = '양지운');

-- ── 4. 기타 — 꾸미기 전체 해금도 오너와 동일하게(있으면) ───────
-- ⚠️ 조인으로 쓰면 '양승민' 이 두 줄일 때 같은 대상 행이 두 번 제안돼
--    "ON CONFLICT DO UPDATE command cannot affect row a second time" 로 실패한다.
--    그래서 원본은 스칼라 하나로 뽑고, 대상도 한 줄로 좁힌다.
insert into public.user_prefs (user_id, unlock_all)
select (select id from public.users where name = '양지운' order by id limit 1),
       coalesce((select p.unlock_all
                 from public.user_prefs p
                 join public.users s on s.id = p.user_id
                 where s.name = '양승민'
                 order by p.user_id limit 1), false)
where exists (select 1 from public.users where name = '양지운')
on conflict (user_id) do update set unlock_all = excluded.unlock_all;

-- ── 5. 확인 — 두 사람의 role·approved·meta_role 이 같아야 한다 ──
select u.name, u.role, u.approved,
       (a.raw_user_meta_data->>'role') as meta_role,
       (select unlock_all from public.user_prefs p where p.user_id = u.id) as unlock_all
from public.users u
join auth.users a on a.id = u.id
where u.name in ('양승민', '양지운')
order by u.name;
