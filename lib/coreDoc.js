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
  // 프로필 설정에 추가한 4테마 (hero·accent·accent2 3색 구성)
  { key:'burgundy',   name:'버건디 블루', bg:'#FAF3F5', hero:'#C1DBE8', accent:'#64313E', accent2:'#D99A5C', dark:'#361B22', ink:'#45262F', sand:'#E7D6DB', mut:'#9C7E86', body:'#574049', soft:'#E4D0D6' },
  { key:'palu',       name:'팔루 선셋', bg:'#FBF4EE', hero:'#FFC973', accent:'#711D1D', accent2:'#5D83A7', dark:'#3A1513', ink:'#4A2320', sand:'#ECD9C9', mut:'#A67C5C', body:'#5C4338', soft:'#F1D3AE' },
  { key:'sagebutter', name:'세이지 버터', bg:'#F5F7F1', hero:'#F2D976', accent:'#2D5996', accent2:'#8E9A80', dark:'#182A3F', ink:'#243650', sand:'#DEE3D4', mut:'#7C8A72', body:'#3D4A52', soft:'#CBD8E6' },
  { key:'midgreen',   name:'미드 그린', bg:'#EFF6F3', hero:'#C8DFDA', accent:'#0F464C', accent2:'#D9C24E', dark:'#0A3034', ink:'#153E42', sand:'#D5E5E0', mut:'#6E8A85', body:'#37514E', soft:'#CFE6E0' },
]

export const DEFAULT_CORE_THEME = 'classic'

export function getCorePalette(key) {
  return CORE_PALETTES.find(p => p.key === key) || CORE_PALETTES[0]
}

// 리치 뷰 섹션 헤더 기본값 — 문서에 sections 오버라이드가 없으면 이 값을 쓴다(기존 인물화 문서 하위호환).
export const DEFAULT_SECTIONS = {
  approaches: { eyebrow: '세 가지 접근', title: '무엇을 다루나' },
  chips:      { eyebrow: '네 개의 모듈', title: '여덟 주의 흐름' },
  outcomes:   { eyebrow: '과정을 마치면', title: '이런 것들을 할 수 있다' },
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

// 색채 기초(COLOR THEORY) 문서 — 명도→광원으로 흐르는 10개 개념. 편집기 샘플.
export const COLOR_THEORY_CORE_DOC = {
  theme: 'palu',
  hero: {
    eyebrow: 'COLOR THEORY · 색채 기초',
    title: '색은 구조',
    titleAccent: '다.',
    desc: '감각이 아니라 명도·채도·색상의 순서로 색을 읽는 방법을 배운다. 단순 모작을 넘어, 스스로 사고하며 채색하기 위한 과정.',
    image: '',
  },
  meta: [
    { k: '일정', v: '주 1회 · 120분' },
    { k: '모집', v: '상시 — 원하는 날부터' },
    { k: '예약', v: '앱으로 일정 선택' },
    { k: '대상', v: '채색을 처음 다루는 분' },
  ],
  statement: {
    eyebrow: '뉴턴 vs 괴테 · 분해와 관찰',
    title: '분해적 사고 VS 경험적 사고',
    desc: '뉴턴은 빛을 프리즘으로 분해했고, 괴테는 색을 눈의 경험으로 보았다. 이 과정은 분해보다 관찰에 가깝다. 색의 원리를 실습으로 직접 확인하고, 자연스러움이 어디서 오는지 손으로 익힌다. 괴테의 색채론을 빌려, 색을 관념으로도 다룬다.',
  },
  sections: {
    approaches: { eyebrow: '두 개의 축', title: '무엇을 다루나' },
    chips:      { eyebrow: '열 걸음', title: '명도에서 광원으로' },
    outcomes:   { eyebrow: '과정을 마치면', title: '이런 것들을 할 수 있다' },
  },
  approaches: [
    { num: '01', title: '색의 상대성', en: 'COLOR RELATIVITY', desc: '빛과 명도로 색을 먼저 읽는다. 한난·유사색·보색으로 색이 옆 색에 따라 달라지는 상대성을 다룬다.', image: '' },
    { num: '02', title: '삼원색과 구조', en: 'PRIMARY & STRUCTURE', desc: '고전과 현대의 두 삼원색 체계를 나란히 두고, 제한·명도 교환·색상휠·광원으로 색의 구조를 세운다.', image: '' },
  ],
  chips: ['명도', '상대성', '탁색', '보색', '삼원색', '두 체계', '재설정', '명도교환', '색상휠', '광원'],
  modules: [
    { num: '00', cat: '① 색의 상대성', title: '빛과 색의 물리 규칙', en: 'PHYSICS OF LIGHT',
      desc: '색을 보기 전에 빛을 본다. 명도가 색채 관계를 먼저 정한다.',
      painters: [], bullets: ['물리 규칙', '명도 우선', '색채 관계'], image: '' },
    { num: '01', cat: '① 색의 상대성', title: '색채의 상대성 ①', en: 'COLOR RELATIVITY I',
      desc: '같은 색도 옆 색에 따라 달라진다. 따뜻함과 차가움을 단색으로 먼저 다루고, 채도와 탁색에 처음 접근한다.',
      painters: [], bullets: ['한색·난색', '단색 표현', '채도·탁색'], image: '' },
    { num: '02', cat: '① 색의 상대성', title: '색채의 상대성 ②', en: 'COLOR RELATIVITY II',
      desc: '유사색으로 화면을 묶는다. 좁은 범위 안에서 색이 어떻게 움직이는지 읽는다.',
      painters: [], bullets: ['유사색', '좁은 팔레트', '상대성'], image: '' },
    { num: '03', cat: '① 색의 상대성', title: '색상 제한 — 보색', en: 'COMPLEMENTARY',
      desc: '보색으로 긴장을 만든다. 두 극 사이에서 채도와 탁색을 조절한다.',
      painters: [], bullets: ['보색', '긴장', '제한 채색'], image: '' },
    { num: '04', cat: '② 삼원색과 구조', title: '삼원색의 두 체계', en: 'TWO PRIMARY SYSTEMS',
      desc: '고전 R·B·Y와 현대 C·M·Y. 여기에 탁색을 더해 두 체계를 나란히 본다.',
      painters: [], bullets: ['R B Y', 'C M Y', '탁색 조합'], image: '' },
    { num: '05', cat: '② 삼원색과 구조', title: '두 체계의 혼합', en: 'MIXING SYSTEMS',
      desc: '두 삼원색 체계를 섞어 쓴다. 디지털과 아날로그가 색을 다르게 만드는 지점을 구분한다.',
      painters: [], bullets: ['체계 비교', '실전 혼합', '디지털·아날로그'], image: '' },
    { num: '06', cat: '② 삼원색과 구조', title: '색채 제한 ① — 삼원색 교체', en: 'PRIMARY RESET',
      desc: '새로운 세 색을 삼원색으로 설정한다. 제한이 만드는 구조적 안정감을 경험한다.',
      painters: [], bullets: ['삼원색 재설정', '제한', '구조'], image: '' },
    { num: '07', cat: '② 삼원색과 구조', title: '명도에 따른 색채 교환', en: 'VALUE SWAP',
      desc: '흑백 명암을 바탕에 두고 색을 바꿔 끼운다. 명도가 같으면 색은 교환된다.',
      painters: [], bullets: ['흑백 바탕', '색채 교환', '명도 기준'], image: '' },
    { num: '08', cat: '② 삼원색과 구조', title: '색채 제한 ② — 색상휠 제한', en: 'WHEEL LIMIT',
      desc: '하나의 색상휠 안에서 영역을 좁힌다. 출처가 같을 때 조화가 생긴다.',
      painters: [], bullets: ['색상휠', '영역 제한', '조화'], image: '' },
    { num: '09', cat: '② 삼원색과 구조', title: '색채와 조명 — 광원', en: 'LIGHT SOURCE',
      desc: '따뜻한 빛과 차가운 빛 아래 색이 달라진다. 색은 물체보다 광원의 영향을 먼저 받는다.',
      painters: [], bullets: ['광원 온도', '색 변화', '리얼리즘 관찰'], image: '' },
  ],
  outcomes: [
    { title: '색을 명도부터 읽는다', desc: '색상에 휘둘리지 않고 명도 → 채도 → 색상의 순서로 화면을 정리한다.' },
    { title: '제한된 팔레트로 조화를 만든다', desc: '조화는 색을 많이 쓰는 데서 오지 않는다. 출처의 통일에서 온다.' },
    { title: '광원으로 장면을 본다', desc: '빛의 온도가 색과 감정을 어떻게 결정하는지 관찰한다. 리얼리즘은 광원에서 시작된다.' },
    { title: '사고하며 채색한다', desc: '모작을 넘어, 무엇을 칠하든 스스로 길을 낼 수 있다.' },
  ],
  cta: {
    title: '색은 광원에서 시작해,\n명도에서 정리된다.',
    desc: '그 순서를 손에 익히는 일. 채색 입문 · 명도 중심 · 관찰에서 창작까지.',
    buttonText: '자세히 알아보기',
    image: '',
  },
}

// 명도의 이해(VALUE & COLOR) 문서 — 명도에서 입체로 흐르는 9개 개념. 편집기 샘플.
export const VALUE_UNDERSTANDING_CORE_DOC = {
  theme: 'mono',
  hero: {
    eyebrow: 'VALUE & COLOR · 명도와 채색 과정',
    title: '명도가 단단하면,',
    titleAccent: ' 화면 속 시선을 붙잡습니다.',
    desc: '빛과 명도를 통해 덩어리감을 키우고 형태를 보는 사고를 기르는 수업입니다. 유화 채색이 처음이어도 괜찮습니다.',
    image: '',
  },
  meta: [
    { k: '일정', v: '주 1회 · 120분' },
    { k: '모집', v: '상시 모집 — 원하는 날짜부터 시작' },
    { k: '예약', v: '원하는 일정을 앱으로 예약해 참여' },
    { k: '대상', v: '명도와 채색을 처음 다루는 분' },
  ],
  statement: {
    eyebrow: '빛과 그림자 우선',
    title: '시각 구조와 정보를 결정하는 건, 빛과 그림자다.',
    desc: '사물의 구조를 먼저 읽는다. 빛과 명도로 덩어리감을 키우고 형태를 보는 사고를 길러, 관찰을 그대로 화면으로 옮기는 과정.',
  },
  sections: {
    approaches: { eyebrow: '세 단계', title: '무엇을 다루나' },
    chips:      { eyebrow: '아홉 걸음', title: '명도에서 입체로' },
    outcomes:   { eyebrow: '과정을 마치면', title: '이런 것들을 할 수 있다' },
  },
  approaches: [
    { num: '01', title: '명도 기초', en: 'VALUE BASICS', desc: '고유명도부터 빛과 그림자, 블렌딩, 그루핑까지. 명도로 형태를 읽는 기초를 세운다.', image: '' },
    { num: '02', title: '빛과 환경', en: 'LIGHT & ENVIRONMENT', desc: '주변광·반사광·차폐와 색채 항등성. 환경이 명도를 어떻게 바꾸는지 읽는다.', image: '' },
    { num: '03', title: '입체 구축', en: 'BUILDING FORM', desc: '패싯·명도 키잉으로 큰 덩어리를 면으로 쪼개고, 관찰을 자연스러운 입체로 옮긴다.', image: '' },
  ],
  chips: ['명도', '빛·그림자', '표현', '그루핑', '환경광', '항등성', '덩어리', '키잉', '입체'],
  modules: [
    { num: '01', cat: '① 명도 기초', title: '명도', en: 'VALUE FIRST',
      desc: '색은 명도에서 시작합니다. 모든 물체는 고유한 명도를 가집니다. 칠하기 전에 밝고 어두움의 단계를 먼저 봅니다.',
      painters: [], bullets: ['고유명도', '명도 단계 분해', '채색 연습'], image: '' },
    { num: '02', cat: '① 명도 기초', title: '빛과 그림자', en: 'LIGHT & SHADOW',
      desc: '형태는 빛이 닿는 방식으로 드러납니다. 명부와 암부, 그 사이의 전환. 명도 단계를 한 단계 더 깊이 읽습니다.',
      painters: [], bullets: ['광원', '명부·암부', '단계 심화'], image: '' },
    { num: '03', cat: '① 명도 기초', title: '베벨링과 블렌딩', en: 'BEVELING & BLENDING',
      desc: '면과 면 사이를 잇는 일. 딱딱한 경계와 부드러운 전환을 구분합니다. 유화에서 명도를 다루는 기초 손길입니다.',
      painters: [], bullets: ['경계 처리', '블렌딩', '유화 기초'], image: '' },
    { num: '04', cat: '① 명도 기초', title: '명도 그루핑', en: 'VALUE GROUPING',
      desc: '비슷한 명도를 묶어서 보기. 큰 덩어리부터. 어디서부터 칠하느냐가 화면을 정리합니다.',
      painters: [], bullets: ['명도 그룹', '채색 순서', '큰 덩어리'], image: '' },
    { num: '05', cat: '② 빛과 환경', title: '주변광과 차폐', en: 'AMBIENT & OCCLUSION',
      desc: '그림자 안에도 빛이 있습니다. 막힌 곳은 더 어둡습니다. 환경이 명도를 어떻게 바꾸는지 읽습니다.',
      painters: [], bullets: ['주변광', '반사광', '차폐'], image: '' },
    { num: '06', cat: '② 빛과 환경', title: '색채 항등성', en: 'COLOR CONSTANCY',
      desc: '같은 색도 빛에 따라 달라 보입니다. 눈은 색을 보정합니다. 보이는 명도와 실제 명도를 구분합니다.',
      painters: [], bullets: ['지각 보정', '명도 판단', '항등성'], image: '' },
    { num: '07', cat: '③ 입체 구축', title: '패싯', en: 'FACETS',
      desc: '부드러운 곡면도 작은 면들의 모임입니다. 큰 덩어리를 작은 면으로 쪼갭니다. 베벨에서 패싯으로.',
      painters: [], bullets: ['면 분할', '큰 덩어리 > 작은 덩어리', '패싯'], image: '' },
    { num: '08', cat: '③ 입체 구축', title: '명도 키잉', en: 'VALUE KEYING',
      desc: '화면 전체의 명도 범위를 정하기. 밝은 키, 어두운 키. 명도 폭이 장면의 분위기를 만듭니다.',
      painters: [], bullets: ['명도 범위', '하이키·로우키', '분위기'], image: '' },
    { num: '09', cat: '③ 입체 구축', title: '자연스러운 입체', en: 'FORM RENDERING',
      desc: '지금까지의 개념을 하나로 모으기. 빛·명도·면·환경광이 만나 입체가 섭니다. 관찰을 구조로 옮깁니다.',
      painters: [], bullets: ['통합', '입체 표현', '자연스러움'], image: '' },
  ],
  outcomes: [],
  cta: {
    title: '색을 구조로 이해하면,\n무엇을 칠하든 길이 생깁니다.',
    desc: '명도에서 입체로. 유화 채색이 처음이어도 괜찮습니다.',
    buttonText: '자세히 알아보기',
    image: '',
  },
}

// 편집기 "샘플 불러오기" 목록 — 항목을 추가하면 편집기에 버튼이 하나 더 생긴다.
export const CORE_DOC_SAMPLES = [
  { key: 'portrait', label: '인물화 샘플', doc: DEFAULT_CORE_DOC },
  { key: 'color',    label: '색채 기초 샘플', doc: COLOR_THEORY_CORE_DOC },
  { key: 'value',    label: '명도의 이해 샘플', doc: VALUE_UNDERSTANDING_CORE_DOC },
]

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
    // 섹션 헤더 오버라이드 — 누락 시 DEFAULT_SECTIONS로 폴백(기존 문서 그대로 렌더).
    sections: {
      approaches: { ...DEFAULT_SECTIONS.approaches, ...((d.sections && d.sections.approaches) || {}) },
      chips:      { ...DEFAULT_SECTIONS.chips,      ...((d.sections && d.sections.chips) || {}) },
      outcomes:   { ...DEFAULT_SECTIONS.outcomes,   ...((d.sections && d.sections.outcomes) || {}) },
    },
    // 과정 성과(모듈 뒤에 렌더). 없으면 빈 배열 → 섹션 미표시.
    outcomes: Array.isArray(d.outcomes) ? d.outcomes.map(o => ({ title: o?.title || '', desc: o?.desc || '' })) : [],
    cta: { title: '', desc: '', buttonText: '', image: '', ...(d.cta || {}) },
  }
}
