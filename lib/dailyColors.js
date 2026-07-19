// 오늘의 색 — 날짜 기준 순차 순환 배색 추천.
// 순서 = 계절 흐름(봄 → 여름 → 가을 → 겨울)으로 배열. 명도·채도·한난 수치를 근거로 정렬했다.
//   봄  : 고명도·중채도 파스텔 (연두·연블루·연노랑)
//   여름: 고채도·시원한 원색 (형광·시안·터콰이즈)
//   가을: 중저명도·난색 (갈색·와인·주황)
//   겨울: 저명도·한색/무채 (네이비·딥그린·회색)
// 목록에 항목을 추가하면 사이클에 자동 포함된다(계절 위치에 맞춰 끼워 넣으면 흐름이 유지됨).
// colors: 표시용(개수 자유) · wheel: 삼색 컬러휠용 3원색(색상환에서 가장 넓게 벌어지는 조합)
// 색값은 팬톤 코드를 화면 RGB로 옮긴 근사치.

export const DAILY_COLORS = [
  // ── 봄 ── 밝고 부드러운 톤에서 시작
  { key: 'bluebell',  season: '봄', title: '블루벨 × 샤르트뢰즈 × 하이라이트',
    colors: [['Blue Bell','#96B2DC'], ['Bright Chartreuse','#B0C043'], ['Highlight','#F4E04B']],
    note: '모두 밝은 톤으로 맞추면, 색이 달라도 한 화면처럼 조용히 붙는다.' },

  { key: 'lime',      season: '봄', title: '라임 × 플러싱핑크 × 터콰이즈',
    colors: [['Lime Green','#96C11F'], ['Flushing Pink','#F5C7DB'], ['Turquoise','#40B5A8']],
    note: '라임과 터콰이즈의 팽팽한 사이를, 흐린 분홍이 부드럽게 이어준다.' },

  { key: 'violet',    season: '봄', title: '블루아톨 × 퍼플매직 × 바이올렛튤 × 슈가플럼',
    colors: [['Blue Atoll','#0095C8'], ['Purple Magic','#6A3B8F'], ['Violet Tulle','#B48FC4'], ['Sugar Plum','#EA5EA0']],
    wheel: ['#0095C8', '#6A3B8F', '#EA5EA0'],
    note: '청록에서 보라를 지나 분홍까지, 이웃한 색만으로 흐르게 한 배색.' },

  // ── 여름 ── 채도가 오르고 시원해진다
  { key: 'sugarplum', season: '여름', title: '슈가플럼 × 블루아톨 × 소이빈',
    colors: [['Sugar Plum','#EA5EA0'], ['Blue Atoll','#0095C8'], ['Soybean','#D2C3A2']],
    note: '쨍한 분홍과 시안이 부딪히는 자리를, 베이지가 바닥처럼 받쳐 준다.' },

  { key: 'marigold',  season: '여름', title: '마리골드 × 밀키블루 × 세이프티옐로',
    colors: [['Bright Marigold','#F58026'], ['Milky Blue','#7CAFC6'], ['Safety Yellow','#E1F016']],
    note: '따뜻한 주황과 차가운 하늘색 사이에 형광 노랑을 끼워 온도를 흔든다.' },

  { key: 'magnetic',  season: '여름', title: '마그네틱블루 × 검드롭그린 × 슈가플럼',
    colors: [['Magnetic Blue','#12409B'], ['Gumdrop Green','#22A06B'], ['Sugar Plum','#EA5EA0']],
    note: '파랑·초록·분홍을 모두 높은 채도로 맞추면, 어느 하나도 물러서지 않고 팽팽해진다.' },

  { key: 'lemon',     season: '여름', title: '레몬토닉 × 갈락티카 × 터콰이즈',
    colors: [['Lemon Tonic','#F3E01E'], ['Galactica','#1E3A5F'], ['Turquoise','#40B5A8']],
    note: '가장 어두운 네이비 옆에 가장 밝은 형광 노랑. 명도 폭이 그대로 대비가 된다.' },

  // ── 가을 ── 난색으로 기울고 톤이 가라앉는다
  { key: 'vibrant',   season: '가을', title: '바이브런트옐로 × 파이어리레드 × 어번던트그린',
    colors: [['Vibrant Yellow','#FBD417'], ['Fiery Red','#D21E2B'], ['Abundant Green','#00814A']],
    note: '노랑·빨강·초록, 원색에 가까운 삼각 배색. 셋의 힘이 비슷해 무엇을 넓게 쓰느냐가 전부다.' },

  { key: 'fiery',     season: '가을', title: '파이어리레드 × 초콜릿퐁당 × 슈가플럼',
    colors: [['Fiery Red','#D21E2B'], ['Chocolate Fondant','#5C3B33'], ['Sugar Plum','#EA5EA0']],
    note: '빨강 하나를 밝기와 맑기만 바꿔 세 번 썼다. 한 색상 안에서도 대비는 만들어진다.' },

  { key: 'caramel',   season: '가을', title: '카라멜카페 × 타오스토프 × 카놀리크림',
    colors: [['Caramel Café','#8B5A2B'], ['Taos Taupe','#C7B299'], ['Cannoli Cream','#EDE6D6']],
    note: '한 갈색을 진하기만 다르게 셋으로 나눴다. 색상이 같아도 명도만으로 층이 생긴다.' },

  { key: 'winery',    season: '가을', title: '와인 × 샤르트뢰즈 × 롤링워터',
    colors: [['Winery','#7A303F'], ['Bright Chartreuse','#B0C043'], ['Rolling Waters','#7196CE']],
    note: '어두운 와인 위에 형광 연두를 얹으면, 채도 차이만으로 시선이 한 점에 꽂힌다.' },

  // ── 겨울 ── 가장 어둡고 차분하게 닫고, 다시 봄으로
  { key: 'galactica', season: '겨울', title: '갈락티카 × 위스피블루 × 초콜릿퐁당',
    colors: [['Galactica','#1E3A5F'], ['Whispy Blue','#AAC3DF'], ['Chocolate Fondant','#5C3B33']],
    note: '같은 파랑을 명도로만 갈라놓고, 갈색 하나로 화면에 온기를 넣는다.' },

  { key: 'cyberleaf', season: '겨울', title: '사이버리프 × 프로스트그레이 × 퍼플매직',
    colors: [['Cyber Leaf','#0F5147'], ['Frost Gray','#9D9C9A'], ['Purple Magic','#6A3B8F']],
    note: '무채색 회색을 사이에 두면, 초록과 보라가 서로를 죽이지 않는다.' },
]

// 순환 기준일 — 이 날짜에 목록 0번이 나오고, 하루에 한 칸씩 이동한다.
const ANCHOR = Date.UTC(2026, 6, 12) // 2026-07-12

// 해당 날짜의 조합. 목록 끝에 도달하면 자동으로 처음으로 돌아간다.
export function getDailyColor(date = new Date()) {
  const n = DAILY_COLORS.length
  if (!n) return null
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.floor((today - ANCHOR) / 86400000)
  return DAILY_COLORS[((days % n) + n) % n]
}

// 삼색 컬러휠용 3원색 hex — wheel 지정이 있으면 그것, 없으면 앞 3개.
export function wheelHexOf(item) {
  if (!item) return []
  if (item.wheel?.length === 3) return item.wheel
  return item.colors.slice(0, 3).map(c => c[1])
}

// PalettePlanner의 initial 형태로 변환 (hex → {h,s,l} 3원색)
export function toPlannerInitial(item) {
  const hexes = wheelHexOf(item)
  if (hexes.length !== 3) return null
  return { v: 1, primaries: hexes.map(hexToHsl), mix: 'sub', ratio: '631' }
}

function hexToHsl(hex) {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  let h = 0, s = 0
  if (mx !== mn) {
    const d = mx - mn
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0))
    else if (mx === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}
