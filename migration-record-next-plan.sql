-- 강사 피드백에 "다음에 진행할 것" 한 줄 (선택 항목)
-- 학생 홈에 가장 최근 것 하나가 뜨고, 그 수업을 한 번 더 들어 기록을 남기면 내려간다.
-- 피드백에 딸려 있으므로 이력이 그대로 쌓인다 — 피드백 노트에서 시간순으로 되짚어 볼 수 있다.
alter table class_record_feedback add column if not exists next_plan text;
