// 오늘의 그림 — 날짜마다 한 점씩 소개한다.
//
// ⚠️ 여기 배열이 유일한 진실이다. 작품 추가 = 항목 한 줄 추가.
//    날짜 순환이라 배열 길이가 바뀌면 "오늘 뜨는 작품"도 바뀐다(의도 — 새 작품이 섞여 든다).
//
// 글 형식(매거진 톤):
//   quote  = 작가가 남긴 말 한 줄. **확실한 것만** 넣는다 — 출처가 불분명하면 비워 둔다
//            (없으면 상세 시트가 설명부터 시작한다). 지어내지 말 것.
//   note   = 빈 줄로 나눈 3~4 문단.
//            ① 언제 어디서 태어나 무엇을 그렸는가(사실)
//            ② 이 그림에서 그가 붙든 것(관찰)
//            ③ 그래서 어떻게 보이는가(해석)
//            ④ 한 줄 마무리 — 인용문이 있으면 그리로 돌아온다
//            **강조** 는 굵게(테마 색) 표시된다.
//   tease  = 띠에 뜨는 한 줄 질문. 정답을 말하지 말고 궁금하게 둔다.
//
// 이미지 = 메트로폴리탄 미술관 공개 소장품(Open Access). 다른 데서 가져온 그림을 넣어도
//   코드는 그대로 돈다 — image 에 주소만 넣으면 된다.
//
// crop = 띠의 작은 사각형이 보여 줄 자리(background-position). 알아보기 어려운
//   디테일일수록 좋다 — 그게 눌러 보게 만드는 힘이다.

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
    quote: '사이프러스는 늘 내 마음을 사로잡는다. 이집트의 오벨리스크처럼 아름다운 선과 비례를 지녔다.',
    quoteBy: '빈센트 반 고흐, 동생 테오에게 보낸 편지에서',
    note: '1889년, 고흐는 프랑스 남부 생레미의 요양원에 있었습니다. 창밖으로 보이는 밀밭과 그 끝에 선 사이프러스를 여러 번 그렸고, 이 그림도 그중 하나입니다.\n\n눈여겨볼 것은 소재가 아니라 **붓질**입니다. 하늘도, 밀밭도, 나무도 전부 같은 방향으로 흐르는 짧은 선으로 덮여 있어요. 보통은 하늘은 넓게 펴 바르고 나무는 세워 그리는데, 고흐는 화면 전체를 한 가지 리듬으로 통일했습니다.\n\n그래서 하늘이 단단해 보이고 땅이 흔들려 보입니다. 질감을 하나로 맞추면 멀리 있는 것과 가까운 것이 같은 호흡으로 묶인다는 것을, 이 그림이 보여 줍니다.\n\n그가 사이프러스에서 본 것도 아마 모양이 아니라 그 선이었을 겁니다.',
  },
  {
    id: 'met-435809',
    artist: 'Pieter Bruegel the Elder', artistKo: '피터르 브뤼헐', bio: '약 1525–1569',
    title: 'The Harvesters', titleKo: '수확하는 사람들',
    year: '1565', medium: '오크 패널에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP119115.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/435809',
    crop: '58% 70%',
    tease: '여기서 제일 먼저 보이는 건 뭘까?',
    note: '브뤼헐은 16세기 플랑드르에서 계절마다 달라지는 농촌의 하루를 연작으로 그렸습니다. 이 그림은 그중 여름, 밀을 베는 8월입니다.\n\n화면을 보면 밀밭이 **대각선 한 줄**로 뚝 잘려 있습니다. 왼쪽 아래 나무 그늘과 오른쪽 위 들판이 완전히 다른 공간이 되고, 사람들은 정확히 그 경계에 앉아 있어요. 밥을 먹고, 자고, 낫을 휘두릅니다.\n\n넓은 풍경을 그릴 때 어려운 건 넓이가 아니라 **어디를 비울지**입니다. 브뤼헐은 들판을 비우고 사람을 경계에 몰아 두었고, 그래서 시선이 멀리 갔다가 다시 사람에게 돌아옵니다.\n\n풍경화인데 끝내 사람 이야기로 읽히는 이유입니다.',
  },
  {
    id: 'met-45434',
    artist: 'Katsushika Hokusai', artistKo: '가쓰시카 호쿠사이', bio: '1760–1849',
    title: 'Under the Wave off Kanagawa', titleKo: '가나가와 해변의 높은 파도 아래',
    year: '약 1830–32', medium: '목판화',
    image: 'https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/45434',
    crop: '72% 46%',
    tease: '파도 뒤에 숨은 산, 찾으셨나요?',
    quote: '일흔셋이 되어서야 새와 짐승, 벌레와 물고기의 구조를 조금 알게 되었다.',
    quoteBy: '가쓰시카 호쿠사이, 『후지산 백경』 후기에서',
    note: '호쿠사이는 일흔이 넘어 후지산 연작을 시작했습니다. 이 그림은 그 서른여섯 장 가운데 하나이고, 지금은 세계에서 가장 많이 복제된 그림 중 하나가 되었습니다.\n\n여기서 그가 나란히 놓은 것은 **곡선과 직선**입니다. 파도는 끝까지 휘어 있고 후지산만 혼자 삼각형이에요. 큰 파도가 작은 산을 통째로 감싸는 구도인데도 산이 눌려 보이지 않습니다.\n\n형태 하나만 다르게 두면 그것이 중심이 됩니다. 크기가 아니라 성질이 주인공을 정한다는 뜻이에요.\n\n평생 그림을 고쳐 그린 사람이 일흔셋에 "이제 조금 알겠다"고 적은 것도, 아마 이런 것들이었을 겁니다.',
  },
  {
    id: 'met-459054',
    artist: 'Hans Memling', artistKo: '한스 멤링', bio: '약 1430–1494',
    title: 'Portrait of a Young Man', titleKo: '젊은 남자의 초상',
    year: '약 1472–75', medium: '오크 패널에 유채',
    image: 'https://images.metmuseum.org/CRDImages/rl/web-large/DP-40423-001.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/459054',
    crop: '46% 34%',
    tease: '얼굴보다 먼저 보이는 게 있습니다',
    note: '멤링은 브뤼헤에서 활동한 초기 네덜란드 화가입니다. 당시 초상화는 신분을 남기는 기록이었지만, 그의 인물들은 500년이 지난 지금도 묘하게 살아 있어 보입니다.\n\n비결은 **어디를 또렷하게 두었는가**입니다. 얼굴 피부는 붓자국이 보이지 않을 만큼 매끈하게, 뒤의 풍경은 안개처럼 흐리게 처리했어요. 그리고 또렷한 경계는 눈과 입가에만 남겨 두었습니다.\n\n사람이 사람을 볼 때 실제로 그렇게 봅니다. 전부를 똑같이 보지 않고 눈과 입 주변에 초점을 둡니다. 그 보는 방식을 그대로 그림으로 옮긴 셈이에요.\n\n인물을 그릴 때 "어디까지 그릴까"가 늘 고민이라면, 이 그림이 한 가지 답입니다.',
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
    note: '프랑스 혁명 두 해 전, 다비드는 독배를 앞에 둔 소크라테스를 그렸습니다. 열세 명이 한 화면에 들어가 있는데도 이야기가 흐트러지지 않습니다.\n\n밝기를 **한 사람에게 몰아** 두었기 때문입니다. 소크라테스만 빛을 정면으로 받고 나머지는 한 단계씩 어둡습니다. 그리고 그의 손이 위를 가리키며 화면 밖으로 빠져나가요.\n\n인물이 많아질수록 흔한 실수는 모두를 비슷하게 밝히는 것입니다. 그러면 눈이 쉴 곳을 잃고 그림이 시끄러워집니다.\n\n누구를 보여 줄지 먼저 정하고 나머지를 양보시키는 것 — 구성의 거의 전부입니다.',
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
    quote: '해바라기는, 말하자면 내 것이다.',
    quoteBy: '빈센트 반 고흐, 편지에서',
    note: '고흐가 파리에 머물던 1887년에 그린 해바라기입니다. 흔히 떠올리는 꽃병에 꽂힌 노란 해바라기가 아니라, **바닥에 놓인 시든 해바라기**예요.\n\n그래서 색이 한 가지로 끝나지 않습니다. 가운데는 아직 노랗고 가장자리로 갈수록 갈색으로 넘어가요. 같은 노랑 안에서 단계를 만들어 꽃이 말라 가는 시간을 보여 줍니다.\n\n색을 여러 개 쓰는 것보다 한 색 안에서 단계를 만드는 쪽이 어렵습니다. 대신 그게 되면 설명 없이도 상태가 전해집니다.\n\n이 꽃을 자기 것이라고 부를 만큼, 그는 해바라기를 오래 들여다본 사람이었습니다.',
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
    quote: '진실한 것은 하나뿐이다. 본 것을 곧바로 그리는 것.',
    quoteBy: '에두아르 마네',
    note: '1874년 여름, 마네는 센강 가에서 보트를 타는 사람들을 그렸습니다. 당시 파리 사람들의 주말 풍경이었어요.\n\n이 그림에서 가장 과감한 선택은 **수평선을 잘라 낸 것**입니다. 배경이 전부 물이라 하늘이 한 뼘도 없습니다. 하늘이 없으니 멀고 가까움을 재는 기준이 사라지고, 두 사람이 바로 눈앞에 있는 것처럼 느껴집니다.\n\n거리감은 인물을 어떻게 그리느냐보다 **배경에서 무엇을 빼느냐**로 정해질 때가 많습니다. 꽉 채우는 것보다 덜어 내는 쪽이 어려운 이유이기도 하고요.\n\n본 것을 곧바로 그린다는 그의 말은, 아마 이런 결단까지 포함한 말이었을 겁니다.',
  },
  {
    id: 'met-437853',
    artist: 'J. M. W. Turner', artistKo: '윌리엄 터너', bio: '1775–1851',
    title: 'Venice, from the Porch of Madonna della Salute', titleKo: '베네치아, 살루테 성당 현관에서',
    year: '약 1835', medium: '캔버스에 유채',
    image: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP169568.jpg',
    source: 'https://www.metmuseum.org/art/collection/search/437853',
    crop: '62% 36%',
    tease: '건물과 물이 어디서 나뉘죠?',
    note: '터너는 평생 빛과 물을 그렸습니다. 베네치아는 그에게 가장 좋은 소재였어요. 도시 전체가 물 위에 떠 있고, 그 물이 다시 건물을 비추니까요.\n\n이 그림의 원근은 선으로 만들어지지 않았습니다. **멀어질수록 경계를 지웠습니다.** 가까운 기둥만 윤곽이 분명하고, 건너편 건물은 물과 하늘에 섞여 어디까지가 벽인지 알 수 없어요.\n\n학교에서 배우는 원근은 보통 선의 길이와 각도로 설명합니다. 그런데 실제로 멀리 있는 것은 작아지기 전에 먼저 **흐려집니다.**\n\n무엇을 또렷하게 두고 무엇을 풀어 줄지 — 거리를 만드는 건 결국 그 선택입니다.',
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
    note: '마네가 친구 모네의 집에 놀러 가 그 가족을 그린 날의 그림입니다. 그날 모네도 옆에서 그림을 그렸고, 르누아르까지 와서 같은 장면을 그렸다고 전해집니다.\n\n화면의 대부분이 초록인데 답답하지 않습니다. 햇빛이 닿는 쪽에는 **노랑을 섞고**, 그늘진 쪽에는 **파랑을 섞어** 두었기 때문이에요. 밝기만 다른 게 아니라 색 자체가 다릅니다.\n\n넓은 면을 한 가지 색으로 칠할 때 가장 흔한 결과는 평평해지는 것입니다. 명도만 조절하면 회색이 섞인 것처럼 탁해지고요.\n\n밝은 쪽엔 따뜻한 색을, 어두운 쪽엔 차가운 색을 — 정원 하나로 그 원리를 다 보여 주는 그림입니다.',
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
    quote: '색은 그 자체로 무언가를 표현한다.',
    quoteBy: '빈센트 반 고흐, 동생 테오에게 보낸 편지에서',
    note: '고흐는 모델을 쓸 돈이 없어 자기 얼굴을 많이 그렸습니다. 파리에 머문 2년 동안에만 서른 점 가까이 남겼어요.\n\n이 그림에서 눈이 가는 건 얼굴보다 **배경의 방향**입니다. 붓질이 얼굴을 중심으로 바깥을 향해 뻗어 나갑니다. 배경을 평평하게 칠하지 않고 방향을 주면, 인물이 그만큼 앞으로 밀려 나와요.\n\n인물화에서 배경은 남는 자리가 아닙니다. 어떻게 칠하느냐에 따라 인물이 가까워지기도 하고 뒤로 물러나기도 합니다.\n\n색 자체가 말을 한다고 믿은 사람이, 배경 하나도 그냥 두지 않았던 셈입니다.',
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
    note: '파리로 가기 전, 네덜란드 뉘넌에서 그린 그림입니다. 이 시기 고흐는 농민의 일상을 어두운 색으로만 그렸습니다. 우리가 아는 노랑과 파랑은 아직 없습니다.\n\n그런데도 형태가 분명히 읽힙니다. 갈색과 회색뿐인데 **밝기 차이를 크게** 벌려 두었기 때문이에요. 가장 밝은 데와 가장 어두운 데의 간격이 넓으면, 색이 없어도 입체가 섭니다.\n\n"색을 쓰기 전에 명암으로 먼저 세워 보라"는 말을 자주 듣습니다. 그 말이 무슨 뜻인지 보여 주는 그림이 이것입니다.\n\n몇 년 뒤 그는 세상에서 가장 색이 선명한 화가가 됩니다. 그 전에 이런 그림을 수백 장 그렸습니다.',
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
