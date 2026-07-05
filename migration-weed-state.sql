-- 냥밭 잡초 상태 저장 (실제 경과 시간대로 성장/제거 누적)
-- weed_state = { weeds:[{id,born,x,y}], removed, lastSpawn, penaltyCharged, rewarded }
-- Supabase 대시보드 → SQL Editor에서 실행하세요.

alter table user_prefs add column if not exists weed_state jsonb;
