-- 관리자 확정 상태 공유용 — 관리자가 모든 관리자 알림을 함께 갱신할 수 있게 (2026-07-11)
-- 배경: 한 관리자가 예약요청/모임을 확정하면 다른 관리자 알림 복사본도 '확정 완료'로 바뀌어야 하는데,
--       notifications UPDATE가 '본인 행'으로 제한돼 있으면 교차 갱신이 막힌다.
-- 이 마이그레이션은 '정책 추가'만 한다(ADD). RLS 활성화는 건드리지 않으므로 안전:
--   · RLS가 꺼져 있으면  → 이 정책은 무효과(이미 교차 갱신 동작), 기존 동작 그대로.
--   · RLS가 켜져 있으면  → 관리자에게 UPDATE 허용이 더해져 확정 상태가 전체 관리자에게 공유됨.
-- 판별 기준은 앱과 동일하게 JWT user_metadata.role = 'admin'.
-- Supabase 대시보드 → SQL Editor에서 New query로 1회 실행하세요.

drop policy if exists "admin update notifications" on public.notifications;
create policy "admin update notifications" on public.notifications
  for update
  to authenticated
  using  ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
