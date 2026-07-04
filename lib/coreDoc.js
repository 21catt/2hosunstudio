// 리치 핵심내용(인물화형 랜딩) 문서 모델
// class_courses.core_doc(jsonb)에 저장. 관리자 편집 → 학생 리치 뷰(CoreDocView) 렌더.
// 문서가 없으면 학생은 기존 텍스트/사진 핵심내용으로 폴백한다.

// 리치 뷰 색상 테마 — 관리자가 스와치로 고르면 랜딩 전체 색이 이 팔레트로 바뀐다.
// 역할: bg(밝은 배경) · hero(히어로 블록) · accent(주강조: 스테이트먼트 배경·강조 텍스트) ·
//       accent2(보조: 불릿·CTA 버튼) · dark(어두운 섹션) · ink/sand/mut/body(중립) · soft(어두운 배경 위 옅은 글자)
export const CORE_PALETTES = [
  { key:'classic', name:'레몬 블루', bg:'#FBF7E3', hero:'#EFE156', accent:'#3538D6', accent2:'#6FE89A', dark:'#1B1C46', ink:'#2A2B55', sand:'#EAE3C4', mut:'#8A7A4A', body:'#4A4B70', soft:'#CDCEF2' },
  { key:'sage',    name:'세이지 그린', bg:'#F1F5EC', hero:'#C6E6A9', accent:'#2E7D4F', accent2:'#F2C14E', dark:'#1C2B20', ink:'#26362A', sand:'#D5E2C8', mut:'#6C7D61', body:'#3D4A40', soft:'#D7ECC8' },
  { key:'terra',   name:'테라코타', bg:'#FBF1E7', hero:'#F2B279', accent:'#C24E2E', accent2:'#E8A23D', dark:'#3A2118', ink:'#4A2C20', sand:'#EAD6C2', mut:'#A17A5E', body:'#5C4438', soft:'#F5D8BF' },
  { key:'lilac',   name:'라일락 팝', bg:'#F6F2FB', hero:'#D9C4F0', accent:'#6B4CE6', accent2:'#FF9EC4', dark:'#241B3A', ink:'#302748', sand:'#E0D6EE', mut:'#8577A0', body:'#4A4166', soft:'#E4D7F5' },
  { key:'mono',    name:'모노 잉크', bg:'#F4F3EF', hero:'#E7E5DE', accent:'#1B1B1B', accent2:'#FF6B35', dark:'#141414', ink:'#222222', sand:'#DEDCD3', mut:'#8A877E', body:'#3A3A38', soft:'#D8D7D0' },
]

export const DEFAULT_CORE_THEME = 'classic'

export function getCorePalette(key) {
  return CORE_PALETTES.find(p => p.key === key) || CORE_PALETTES[0]
}

// 인물화 특강 기본 문서 — 관리자 편집기의 시작 템플릿 겸 샘플.
export const DEFAULT_CORE_DOC = {
  theme: 'classic',
  hero: {
    eyebrow: 'PORTRAIT PAINTING · 인물화 특강',
    title: '빛을 해체',
    titleAccent: '한다.',
    desc: '자연스럽고 생동감 있는 인물 표현을 위한 접근. 눈·코·입·귀의 구조부터 나만의 피부색 공식까지, 여덟 주 동안.',
    image: '/pixel-cats/17-nyang-laugh.png',
  },
  meta: [
    { k: '기간', v: '8주 · 주 1회' },
    { k: '시간', v: '회당 120분' },
    { k: '정원', v: '소수 정예' },
    { k: '대상', v: '인물화를 깊이 다루려는 분' },
  ],
  statement: {
    eyebrow: '"빛을 해체하는 인물화" · 8주 특강',
    title: '고전의 구조를 배우고, 인상주의로 해체한다.',
    desc: '단순 모작을 넘어, 빛이 형태를 만드는 방식을 손으로 익힌다. 거장의 인물화를 분석하고, 색을 덩어리로 다루다, 끝에는 자신만의 팔레트로 한 점을 완성한다.',
  },
  approaches: [
    { num: '01', title: '눈·코·입·귀', en: 'EYES NOSE MOUTH EARS', desc: '각 영역의 입체감과 색채 특성을 구조적으로 파악하고 접근한다.', image: '' },
    { num: '02', title: '인물의 색채와 톤', en: 'SKIN COLOR & TONE', desc: '고전회화 모작을 통해 피부 색채에 필요한 기초 조색법을 익힌다.', image: '' },
    { num: '03', title: '인상주의 색채와 표현', en: 'IMPRESSIONIST COLOR', desc: '고전 색채에서 벗어난, 색을 품은 채색 조합을 실험한다.', image: '' },
  ],
  chips: ['고전 구조', '인상주의', '개인 팔레트', '개인 창작'],
  modules: [
    {
      num: '01', cat: '고전 구조', title: '모듈 1 — 고전 구조 분석', en: 'CLASSICAL STRUCTURE',
      desc: '빛이 형태를 만드는 방식을 거장의 인물화에서 분석한다.',
      painters: [
        { ko: '앤서니 반 다이크', en: 'Anthony van Dyck', points: ['암부 통합', '측광에서 발생하는 특징적 구조', '코어 섀도우의 깊이'] },
        { ko: '존 싱어 서전트', en: 'John Singer Sargent', points: ['과감한 생략', '붓 터치의 방향성', '색을 덩어리로 쓰는 방식'] },
      ],
      bullets: [], image: '',
    },
    {
      num: '02', cat: '인상주의', title: '모듈 2 — 인상주의 구조 분석', en: 'IMPRESSIONIST STRUCTURE',
      desc: '고전의 어둠을 색으로 바꾼다.',
      painters: [],
      bullets: ['피부 안에 보라·청색을 미세하게 포함', '그림자에도 색을 넣음 — 검정 사용 최소화', '부드러운 경계 + 선택적 강조', '완성도를 80%에서 멈추는 훈련'],
      image: '',
    },
    {
      num: '03', cat: '팔레트', title: '모듈 3 — 개인 팔레트 구축', en: 'YOUR PALETTE',
      desc: '나만의 피부색 공식을 만든다.',
      painters: [],
      bullets: ['5색 이하로 제한', '본인만의 피부색 공식 만들기'],
      image: '',
    },
    {
      num: '04', cat: '개인 창작', title: '모듈 4 — 개인 창작', en: 'PERSONAL WORK',
      desc: '배운 구조로 한 점의 인물을 완성한다.',
      painters: [],
      bullets: ['주제 선정과 구도 잡기', '개인 창작을 통한 인물 표현'],
      image: '',
    },
  ],
  cta: {
    title: '빛을 해체하러 오세요.',
    desc: '8주 · 주 1회 120분 · 소수 정예. 인물화를 깊이 다루려는 분을 위한 특강입니다.',
    buttonText: '자세히 알아보기',
    image: '/farm/cat-bucket.png',
  },
}

// core_doc 값이 리치 뷰로 렌더할 만한 문서인지 (모듈이 하나라도 있으면 리치로 간주)
export function hasRichDoc(doc) {
  return !!(doc && typeof doc === 'object' && Array.isArray(doc.modules) && doc.modules.length > 0)
}

// 저장된 문서를 안전한 형태로 정규화 — 누락 필드는 기본값으로 채운다.
export function normalizeDoc(doc) {
  const d = (doc && typeof doc === 'object') ? doc : {}
  return {
    theme: CORE_PALETTES.some(p => p.key === d.theme) ? d.theme : DEFAULT_CORE_THEME,
    hero: { eyebrow: '', title: '', titleAccent: '', desc: '', image: '', ...(d.hero || {}) },
    meta: Array.isArray(d.meta) ? d.meta.map(m => ({ k: m?.k || '', v: m?.v || '' })) : [],
    statement: { eyebrow: '', title: '', desc: '', ...(d.statement || {}) },
    approaches: Array.isArray(d.approaches) ? d.approaches.map(a => ({ num: a?.num || '', title: a?.title || '', en: a?.en || '', desc: a?.desc || '', image: a?.image || '' })) : [],
    chips: Array.isArray(d.chips) ? d.chips.filter(Boolean) : [],
    modules: Array.isArray(d.modules) ? d.modules.map(m => ({
      num: m?.num || '', cat: m?.cat || '', title: m?.title || '', en: m?.en || '', desc: m?.desc || '',
      painters: Array.isArray(m?.painters) ? m.painters.map(p => ({ ko: p?.ko || '', en: p?.en || '', points: Array.isArray(p?.points) ? p.points.filter(Boolean) : [] })) : [],
      bullets: Array.isArray(m?.bullets) ? m.bullets.filter(Boolean) : [],
      image: m?.image || '',
    })) : [],
    cta: { title: '', desc: '', buttonText: '', image: '', ...(d.cta || {}) },
  }
}
