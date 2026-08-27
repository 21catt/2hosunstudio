-- 조소 · 인물 두상 — 회차(커리큘럼) 넣기 (2026-08-26)
--
-- 핵심내용(리치 문서)은 SQL 이 아니라 관리자 화면에서 넣는다:
--   관리자 → 커리큘럼 → 핵심내용 편집 → "조소 두상 샘플 불러오기" → 저장
--   (lib/coreDoc.js SCULPTURE_HEAD_CORE_DOC. jsonb 를 손으로 밀어 넣지 않는 이유 =
--    normalizeDoc 을 안 거치면 필드 누락이 조용히 저장된다.)
--
-- 아래는 회차만 넣는다. 회차는 화면에서 하나씩 추가해도 되고, 이 SQL 로 한 번에 넣어도 된다.

-- ── 1. 수업 이름 확인 (course_curriculum.course_name 은 class_courses.name 과 글자가 같아야 이어진다)
select id, name, category, is_active from public.class_courses
where category = 'sculpture' or name like '%조소%' or name like '%두상%';

-- ── 2. 위에서 확인한 이름을 :NAME 자리에 그대로 넣고 실행
--     (이미 회차가 있으면 step_order 가 겹치지 않게 먼저 확인:
--      select step_order, title from public.course_curriculum where course_name = '조소' order by step_order;)
insert into public.course_curriculum (course_name, step_order, title, keyword) values
  ('조소', 1, '덩어리, 형태 — 기본양 만들기',        '심재 · 기본양 · 단순한 도형'),
  ('조소', 2, '뼈대 — 골격 세우기',                  '두개골 · 광대 · 턱 · 코 · 이마'),
  ('조소', 3, '이목구비, 지방, 근육',                '비례 · 위치 · 조화'),
  ('조소', 4, '조각적 표현 — 질감과 완성도',        '손과 도구 · 질감 · 마무리');

-- ── 3. 확인
-- select step_order, title, keyword from public.course_curriculum
-- where course_name = '조소' order by step_order;
