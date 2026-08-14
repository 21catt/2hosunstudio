-- 수강권 차감/복구를 DB에서 원자적으로 (2026-08-09)
--
-- 배경: 앱이 `update tickets set remain = <화면에 들고 있던 값> - 1` 로 차감해 왔다.
--       화면 값 기준이라 연달아 예약하면 두 번째가 첫 번째 차감 전 값을 덮어써서
--       "예약 2건 · 차감 1회" 가 된다(실제 발생: 4회권에 4건 예약인데 잔여 1).
--       아래 함수는 DB 안에서 remain 을 직접 증감하므로 유실이 구조적으로 불가능하다.
--
-- 안전장치:
--   · 차감은 remain > 0 이고 기간이 남은 수강권만, 만료일이 임박한 것부터(먼저 쓰는 게 유리)
--   · 복구는 total 을 넘지 못한다(least) — 과잉 복구로 remain > total 이 되는 것 봉쇄
--   · 행 잠금(for update)으로 동시 호출도 순차 처리
--   · 본인 것만 조작 가능. 관리자(user_metadata.role='admin')만 다른 회원 지정 가능
--
-- Supabase 대시보드 → SQL Editor 에서 1회 실행하세요.
-- (실행 전에도 앱은 동작합니다 — 함수가 없으면 앱이 기존 방식으로 자동 폴백합니다.
--  다만 유실 버그는 실행해야 사라집니다.)

-- 호출자 검증 공통 로직
create or replace function _ticket_target_user(p_user_id uuid)
returns uuid
language plpgsql
stable
as $$
declare v_user uuid;
begin
  v_user := coalesce(p_user_id, auth.uid());
  if v_user is distinct from auth.uid()
     and coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'admin' then
    raise exception '본인 수강권만 변경할 수 있어요';
  end if;
  return v_user;
end $$;

-- 1회 차감. 쓸 수 있는 수강권이 없으면 null 을 반환한다(호출부가 예약을 막는다).
create or replace function consume_class_ticket(p_user_id uuid default null)
returns tickets
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid; t tickets;
begin
  v_user := _ticket_target_user(p_user_id);
  update tickets set remain = remain - 1
  where id = (
    select id from tickets
    where user_id = v_user and remain > 0 and expires_at >= current_date
    order by expires_at asc, created_at asc
    limit 1
    for update
  )
  returning * into t;
  return t;
end $$;

-- 1회 복구(취소 시). total 을 넘지 않는다.
create or replace function restore_class_ticket(p_user_id uuid default null)
returns tickets
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid; t tickets;
begin
  v_user := _ticket_target_user(p_user_id);
  update tickets set remain = least(remain + 1, total)
  where id = (
    select id from tickets
    where user_id = v_user and expires_at >= current_date
    order by expires_at asc, created_at asc
    limit 1
    for update
  )
  returning * into t;
  return t;
end $$;

grant execute on function consume_class_ticket(uuid) to authenticated;
grant execute on function restore_class_ticket(uuid) to authenticated;

-- ── 확인 ────────────────────────────────────────────────
-- 함수 등록 확인:
--   select proname from pg_proc where proname in ('consume_class_ticket','restore_class_ticket');
-- 특정 회원 잔여 확인:
--   select u.name, t.total, t.remain, t.expires_at from tickets t join users u on u.id=t.user_id order by u.name;
