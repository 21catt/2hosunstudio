// 오늘의 그림 — 날짜마다 한 점씩 돌아가며 소개한다.
//
// ⚠️ 여기 배열이 유일한 진실이다. 작품 추가 = 항목 한 줄 추가.
//    날짜 순환이라 배열 길이가 바뀌면 "오늘 뜨는 작품"도 바뀐다(의도 — 새 작품이 섞여 든다).
//
// ⚠️ 저작권: **퍼블릭 도메인만** 넣는다. 지금 목록은 전부 메트로폴리탄 미술관
//    공개 소장품(Open Access, CC0)이고 isPublicDomain=true 를 확인한 것들이다.
//    현역·생존 작가의 그림은 넣을 수 없다(동의 없이는 금지).
//    새로 넣을 때 확인: https://collectionapi.metmuseum.org/public/collection/v1/objects/<id>
//
// ⚠️ note 는 초안이다 — 수업 톤에 맞춰 다시 쓸 자리(작성 방법은 추후 확정).
//    tease 는 띠에 뜨는 한 줄 질문이다. 정답을 말하지 말고 궁금하게 둔다.
//
// crop = 띠의 작은 사각형이 보여 줄 자리(background-position). 알아보기 어려운
//    디테일일수록 좋다 — 그게 눌러 보게 만드는 힘이다.

export const DAILY_ARTWORKS = [
  {
    id: 'met-436535',
    artist: 'Vincent van Gogh', artistKo: '빈센트 반 고흐', bio: '1853–1890',
    title: 'Wheat Field with Cypresses', titleKo: '사이프러스가 있는 밀밭',
    year: '1889', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/436535',
    crop: '30% 30%',
    tease: '하늘이 왜 이렇게 꿈틀거릴까?',
    note: '하늘과 밀밭과 나무를 **같은 붓질**로 그렸습니다. 보통은 대상마다 다루는 방식을 바꾸는데, 고흐는 전부 한 방향으로 흐르는 짧은 선으로 덮었어요. 그래서 하늘이 단단해 보이고 땅이 흔들려 보입니다. 질감을 통일하면 화면 전체가 하나로 움직인다는 걸 보여 주는 그림입니다.',
  },
  {
    id: 'met-435809',
    artist: 'Pieter Bruegel the Elder', artistKo: '피터르 브뤼헐', bio: 'ca. 1525–1569',
    title: 'The Harvesters', titleKo: '수확하는 사람들',
    year: '1565', medium: '오크 패널에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP119115.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/435809',
    crop: '58% 70%',
    tease: '여기서 제일 먼저 보이는 건 뭘까?',
    note: '밀밭을 **대각선 한 줄**로 잘라서, 왼쪽 아래 그늘과 오른쪽 위 들판이 완전히 다른 공간이 됐습니다. 그 경계에 사람들을 앉혔어요. 넓은 풍경을 그릴 때 어디를 비우고 어디에 사람을 둘지가 구도의 전부라는 걸 보여 주는 그림입니다.',
  },
  {
    id: 'met-45434',
    artist: 'Katsushika Hokusai', artistKo: '가쓰시카 호쿠사이', bio: '1760–1849',
    title: 'Under the Wave off Kanagawa', titleKo: '가나가와 해변의 높은 파도 아래',
    year: 'ca. 1830–32', medium: '목판화',
    image: 'https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/45434',
    crop: '72% 46%',
    tease: '파도 뒤에 숨은 산, 찾으셨나요?',
    note: '파도의 **곡선**과 후지산의 **직선**을 나란히 뒀습니다. 큰 파도가 작은 산을 감싸는데도 산이 눌리지 않는 건, 산만 삼각형이고 나머지는 전부 휘어 있기 때문이에요. 형태 하나를 다르게 두면 그것이 중심이 됩니다.',
  },
  {
    id: 'met-459054',
    artist: 'Hans Memling', artistKo: '한스 멤링', bio: 'ca. 1430–1494',
    title: 'Portrait of a Young Man', titleKo: '젊은 남자의 초상',
    year: 'ca. 1472–75', medium: '오크 패널에 유채',
    image: 'https://images.metmuseum.org/CRDImages/rl/web-large/DP-40423-001.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/459054',
    crop: '46% 34%',
    tease: '얼굴보다 먼저 보이는 게 있습니다',
    note: '얼굴은 아주 매끈하게, 배경 풍경은 흐리게 두고, **눈과 입가에만** 또렷한 경계를 남겼습니다. 500년 전 초상화가 지금도 살아 있어 보이는 이유예요. 어디를 또렷하게 둘지만 정해도 시선이 그리로 갑니다.',
  },
  {
    id: 'met-436105',
    artist: 'Jacques Louis David', artistKo: '자크 루이 다비드', bio: '1748–1825',
    title: 'The Death of Socrates', titleKo: '소크라테스의 죽음',
    year: '1787', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-13139-001.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/436105',
    crop: '36% 40%',
    tease: '손가락 하나가 그림 전체를 끌고 갑니다',
    note: '열세 명이 있는데 시선이 흩어지지 않습니다. 소크라테스만 **빛을 가장 많이 받고**, 그의 손이 위를 가리키며 화면 밖으로 나갑니다. 인물이 많을수록 밝기를 한 사람에게 몰아야 이야기가 읽힙니다.',
  },
  {
    id: 'met-436524',
    artist: 'Vincent van Gogh', artistKo: '빈센트 반 고흐', bio: '1853–1890',
    title: 'Sunflowers', titleKo: '해바라기',
    year: '1887', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-41223-001.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/436524',
    crop: '40% 58%',
    tease: '시든 꽃을 왜 그렸을까?',
    note: '꽃병에 꽂힌 화사한 해바라기가 아니라 **바닥에 놓인 시든 해바라기**입니다. 같은 노랑인데 가장자리가 갈색으로 넘어가면서 꽃이 말라 가는 시간이 보여요. 한 가지 색 안에서 단계를 만들면 그것만으로 상태가 전달됩니다.',
  },
  {
    id: 'met-436947',
    artist: 'Edouard Manet', artistKo: '에두아르 마네', bio: '1832–1883',
    title: 'Boating', titleKo: '뱃놀이',
    year: '1874', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-25466-001.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/436947',
    crop: '26% 68%',
    tease: '수평선이 어디 있나요?',
    note: '배경을 **물 하나로만** 채우고 수평선을 잘라 냈습니다. 하늘이 없으니 거리가 사라지고, 두 사람이 바로 앞에 있는 것처럼 느껴져요. 배경에서 무엇을 빼는가가 거리감을 정합니다.',
  },
  {
    id: 'met-437853',
    artist: 'J. M. W. Turner', artistKo: '윌리엄 터너', bio: '1775–1851',
    title: 'Venice, from the Porch of Madonna della Salute', titleKo: '베네치아, 살루테 성당 현관에서',
    year: 'ca. 1835', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP169568.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/437853',
    crop: '62% 36%',
    tease: '건물과 물이 어디서 나뉘죠?',
    note: '멀어질수록 **경계를 지웠습니다.** 가까운 기둥만 선이 분명하고 먼 건물은 물과 섞여 있어요. 원근을 선 길이가 아니라 또렷함의 차이로 만든 그림입니다.',
  },
  {
    id: 'met-436965',
    artist: 'Edouard Manet', artistKo: '에두아르 마네', bio: '1832–1883',
    title: 'The Monet Family in Their Garden at Argenteuil', titleKo: '아르장퇴유 정원의 모네 가족',
    year: '1874', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-25465-001.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/436965',
    crop: '70% 30%',
    tease: '초록이 몇 종류일까요?',
    note: '정원 전체가 초록인데 답답하지 않습니다. 햇빛 쪽은 **노랑을 섞고** 그늘 쪽은 **파랑을 섞어서**, 같은 초록이 밝기만이 아니라 색까지 달라졌어요. 한 가지 색으로 넓은 면을 칠할 때 쓰는 방법입니다.',
  },
  {
    id: 'met-436532',
    artist: 'Vincent van Gogh', artistKo: '빈센트 반 고흐', bio: '1853–1890',
    title: 'Self-Portrait with a Straw Hat', titleKo: '밀짚모자를 쓴 자화상',
    year: '1887', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1502_cropped2.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/436532',
    crop: '34% 64%',
    tease: '배경이 얼굴을 밀어내고 있습니다',
    note: '배경의 붓질이 **얼굴에서 바깥으로** 뻗어 나갑니다. 배경을 평평하게 칠하지 않고 방향을 주면 인물이 앞으로 밀려 나와요. 인물화에서 배경을 어떻게 다루느냐가 거리를 정합니다.',
  },
  {
    id: 'met-438722',
    artist: 'Vincent van Gogh', artistKo: '빈센트 반 고흐', bio: '1853–1890',
    title: 'The Potato Peeler', titleKo: '감자 깎는 여인',
    year: '1885', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1503.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/438722',
    crop: '44% 50%',
    tease: '색이 거의 없는데 왜 또렷할까?',
    note: '갈색과 회색뿐인 그림입니다. 그런데도 형태가 읽히는 건 **밝기 차이를 크게** 벌려 뒀기 때문이에요. 색을 쓰기 전에 명암만으로 형태가 서는지 먼저 확인하라는 말이 어떤 뜻인지 보여 주는 그림입니다.',
  },
]

// 날짜 순환 기준점. 바꾸면 전체가 한 칸씩 밀린다.
const ANCHOR = Date.UTC(2026, 0, 1)

function indexFor(date) {
  const n = DAILY_ARTWORKS.length
  if (!n) return -1
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.floor((today - ANCHOR) / 86400000)
  return ((days % n) + n) % n
}

// 그날의 고정 작품. 목록이 비면 null.
export function getDailyArtwork(date = new Date()) {
  const i = indexFor(date)
  return i < 0 ? null : DAILY_ARTWORKS[i]
}

// 지난 N일치(어제부터 거슬러). 상세 시트의 "지난 그림" 줄에 쓴다.
export function getRecentArtworks(date = new Date(), count = 6) {
  if (!DAILY_ARTWORKS.length) return []
  const out = []
  for (let k = 1; k <= count; k++) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - k)
    const a = getDailyArtwork(d)
    if (a && !out.some(x => x.id === a.id)) out.push({ ...a, _on: ymd(d) })
  }
  return out
}

export function ymd(date = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function koDate(str) {
  const [, m, d] = (str || '').split('-')
  return m ? `${Number(m)}월 ${Number(d)}일` : ''
}

// 관리자 덮어쓰기 한 건을 고정 항목 위에 얹는다.
// ⚠️ 빈 칸은 고정값을 남긴다 — 덮어쓰기는 "일부만 고치기"가 기본이다.
export function mergeOverride(base, row) {
  if (!row) return base
  const pick = (k, b) => (row[k] === null || row[k] === undefined || row[k] === '' ? b : row[k])
  const b = base || {}
  const merged = {
    ...b,
    id: row.image && !b.id ? `ov-${row.on_date}` : (b.id || `ov-${row.on_date}`),
    artist: pick('artist', b.artist), artistKo: pick('artist_ko', b.artistKo),
    bio: pick('bio', b.bio),
    title: pick('title', b.title), titleKo: pick('title_ko', b.titleKo),
    year: pick('year', b.year), medium: pick('medium', b.medium),
    image: pick('image', b.image), source: pick('source', b.source),
    crop: pick('crop', b.crop), tease: pick('tease', b.tease),
    note: pick('note', b.note),
    _override: true,
  }
  return merged.image ? merged : null
}
