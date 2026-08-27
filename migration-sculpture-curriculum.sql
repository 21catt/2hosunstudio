-- 조소기초두상 — 회차(커리큘럼) 연결 (2026-08-26)
--
-- 수업 이름 확정: '조소기초두상'
-- ⚠️ course_curriculum 은 class_courses 와 **이름 글자로** 이어진다(외래키가 아니다).
--    공백 하나만 달라도 학생 화면·관리자 커리큘럼에서 안 이어진다.
--
-- 핵심내용(리치 문서)은 SQL 이 아니라 화면에서:
--   관리자 → 커리큘럼 → 조소기초두상 → 핵심내용 편집 → "조소 두상 샘플 불러오기" → 저장
--   (jsonb 를 손으로 밀면 normalizeDoc 을 안 거쳐 필드 누락이 조용히 저장된다)

-- ── 1. 수업이 있는지 먼저 (없으면 관리자 화면에서 개설부터 — 요일·시간이 있어야 예약이 된다)
select id, '['||name||']' as 이름, category, is_active from public.class_courses
where trim(name) = '조소기초두상';

-- ── 2. 회차 정리 — 수업이 있을 때만 돈다. 여러 번 실행해도 안전.
do $$
declare cname text := '조소기초두상';
begin
  if not exists (select 1 from public.class_courses where trim(name) = cname) then
    raise notice '수업(%)이 아직 없다 — 관리자 화면에서 개설한 뒤 다시 실행할 것', cname;
    return;
  end if;

  -- 예전에 '조소' 로 넣어 둔 회차가 있으면 이름을 맞춘다
  update public.course_curriculum set course_name = cname where trim(course_name) = '조소';

  -- 회차가 하나도 없을 때만 기본 4단계를 넣는다(이미 있으면 손대지 않는다)
  if not exists (select 1 from public.course_curriculum where trim(course_name) = cname) then
    insert into public.course_curriculum (course_name, step_order, title, keyword) values
      (cname, 1, '덩어리, 형태 — 기본양 만들기',  '심재 · 기본양 · 단순한 도형'),
      (cname, 2, '뼈대 — 골격 세우기',            '두개골 · 광대 · 턱 · 코 · 이마'),
      (cname, 3, '이목구비, 지방, 근육',          '비례 · 위치 · 조화'),
      (cname, 4, '조각적 표현 — 질감과 완성도',   '손과 도구 · 질감 · 마무리');
    raise notice '회차 4개를 넣었다';
  else
    raise notice '이미 회차가 있어 그대로 둔다';
  end if;
end $$;

-- ── 3. 확인 — 수업과 회차가 같은 이름으로 이어졌는지
select c.name as 수업, c.is_active,
       (select count(*) from public.course_curriculum k where trim(k.course_name) = trim(c.name)) as 회차수,
       (c.core_doc is not null) as 핵심내용
from public.class_courses c
where trim(c.name) = '조소기초두상';

-- 회차 목록
select step_order, title, keyword from public.course_curriculum
where trim(course_name) = '조소기초두상' order by step_order;
