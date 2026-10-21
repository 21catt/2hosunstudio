// 냥이 말 걸기 — 젤리성 홈·3D 냥밭의 냥이가 수강생에게 건네는 말(2026-10-21)
//
// 사용자 지시: "케슬젤리에 있는 고양이와 냥밭 고양이들이 대사를 수강생에게 보내면 좋을 듯 —
//   간단한 아무 인사부터 다음에는 어떤 그림을 그리고 싶은지 등등" + "질문에 고른 답은 선생님(관리자 화면)에서도 볼 수 있게".
//
// 이 파일 = 규칙만(순수 함수 + 답 저장). 그림은 components/CatTalk.jsx.
//   · 대사 순서 = 인사 → (수업·냥밭 소식) → 물어보는 말(하루 한 번까지)
//   · 수업 이야기는 실제 기록만 쓴다(예약·강사가 적은 「다음에 진행할 것」·마지막 출석). 지어내지 않는다.
//   · 답 저장 = auth user_metadata.cat_answers(최근 30개) — 표·마이그레이션 없이 바로 쓴다.
//     선생님 화면은 서버(/api/admin/cat-answers)가 서비스 키로 모아 읽는다.

export const CAT_QUESTIONS = [
  { id: 'next_drawing', text: '다음엔 어떤 그림 그리고 싶어요?', title: '다음에 그리고 싶은 그림',
    options: ['인물', '풍경', '정물', '동물', '아직 몰라요'] },
  { id: 'hard_part', text: '요즘 그림 그릴 때 제일 어려운 건 뭐예요?', title: '요즘 어려운 것',
    options: ['형태', '명암', '색', '시간 부족', '괜찮아요'] },
  { id: 'mood', text: '오늘 기분은 어때요?', title: '오늘 기분',
    options: ['좋아요', '그저 그래요', '피곤해요'] },
]

const REPLY = {
  인물: '사람 그리기 좋죠! 선생님께 살짝 전해 둘게요', 풍경: '풍경 좋아요. 창밖도 한번 봐요', 정물: '정물이면 제 당근 그려 줘요 🥕',
  동물: '동물이라니… 혹시 저요?', '아직 몰라요': '천천히 정해도 돼요. 선생님께 같이 물어봐요',
  형태: '형태는 선을 길게 보는 게 먼저래요', 명암: '명암은 눈을 가늘게 뜨고 보면 쉬워져요', 색: '색은 적게 쓸수록 예뻐져요',
  '시간 부족': '5분 낙서도 그림이에요!', 괜찮아요: '다행이다냥',
  좋아요: '저도 덩달아 좋아요 🐾', '그저 그래요': '그런 날엔 쉬운 선부터 그어 봐요', 피곤해요: '오늘은 푹 쉬어요. 그림은 기다려 줘요',
}
export const replyFor = a => REPLY[a] || '고마워요! 잘 기억해 둘게요'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const pad = n => String(n).padStart(2, '0')
export const ymdOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 864e5)
const clip = (t, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t)
// 받침이 있으면 '이', 없으면 '가' — 작물 이름 뒤 조사
const ga = w => { const c = (w || '').charCodeAt((w || '').length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? '이' : '가' }

function greeting(name, now) {
  const h = now.getHours(), who = name ? `${name}님` : ''
  const day = now.getDay()
  if (h >= 5 && h < 11) return `좋은 아침이에요${who ? `, ${who}` : ''}! 오늘도 반가워요 🐾`
  if (h >= 11 && h < 14) return `${who ? `${who}, ` : ''}점심은 드셨어요? 저는 방금 당근 먹었어요`
  if (h >= 14 && h < 18) return day === 5 ? '금요일이다냥! 주말엔 뭐 그려요?' : `${who ? `${who}, ` : ''}오후도 힘내요. 저는 낮잠 한숨 잤어요`
  if (h >= 18 && h < 22) return `${who ? `${who}, ` : ''}저녁이에요. 오늘 하루도 수고 많으셨어요`
  return '밤이 깊었네요. 무리하지 말고 푹 자요 🌙'
}

// 물어볼 질문 하나 — 날마다 돌아가며, 오늘 이미 답했으면 없음
export function questionForToday(now, answeredToday) {
  if (answeredToday) return null
  const n = Math.floor(new Date(`${ymdOf(now)}T00:00:00`).getTime() / 864e5)
  return CAT_QUESTIONS[((n % CAT_QUESTIONS.length) + CAT_QUESTIONS.length) % CAT_QUESTIONS.length]
}

// ctx = { place:'castle'|'farm', name, loggedIn, now, nextBooking:{class_name,class_date,class_time}|null,
//         nextPlan, lastAttended:'YYYY-MM-DD'|null, farm:{cropName, ready, stage, stages, weeds}|null, answeredToday }
// → [{ id, text, q? }]
export function buildCatLines(ctx) {
  const now = ctx.now || new Date()
  const today = ymdOf(now)
  const out = [{ id: 'hello', text: greeting(ctx.name, now) }]
  if (!ctx.loggedIn) {
    out.push({ id: 'guest', text: '가입하고 수업 들으러 오면 제가 밭에서 기다릴게요' })
    return out
  }
  const nb = ctx.nextBooking
  if (nb?.class_date) {
    const d = dayDiff(today, nb.class_date), cls = nb.class_name || '수업'
    const t = (nb.class_time || '').slice(0, 5)
    if (d === 0) out.push({ id: 'today', text: `오늘 ${cls} 수업 있죠?${t ? ` ${t}에` : ''} 만나요!` })
    else if (d === 1) out.push({ id: 'tomorrow', text: `내일 ${cls} 수업이에요. 기다릴게요` })
    else if (d > 1 && d <= 7) out.push({ id: 'week', text: `${DOW[new Date(`${nb.class_date}T00:00:00`).getDay()]}요일에 ${cls} 수업 있죠? 기다릴게요` })
  }
  if (ctx.nextPlan) out.push({ id: 'plan', text: `선생님이 다음엔 「${clip(ctx.nextPlan)}」 해 보자고 하셨대요` })
  if (!nb && ctx.lastAttended && dayDiff(ctx.lastAttended, today) > 30) out.push({ id: 'miss', text: '한동안 못 봤어요… 보고 싶었다냥' })
  const f = ctx.farm
  if (f) {
    if (f.ready) out.push({ id: 'ripe', text: `${f.cropName}${ga(f.cropName)} 다 익었어요! 수확하러 와요` })
    else if (f.stages && f.stage >= 0) out.push({ id: 'grow', text: `출석 ${f.stages - f.stage}번만 더 하면 ${f.cropName}${ga(f.cropName)} 다 자라요` })
    if (f.weeds > 0) out.push({ id: 'weed', text: '잡초가 좀 났어요. 같이 뽑을래요?' })
  }
  const q = questionForToday(now, ctx.answeredToday)
  if (q) out.push({ id: `q:${q.id}`, text: q.text, q })
  return out
}

// 오늘 이미 답했나 — 메타의 답 목록에서
export function answeredOn(answers, day) {
  return (answers || []).some(a => a?.at && ymdOf(new Date(a.at)) === day) // 기기 날짜 기준(저장은 UTC)
}

// 답 저장 — 내 메타에 붙인다(최근 30개). 실패해도 냥이 대답은 그대로(조용히).
export async function saveCatAnswer(supabase, { question, answer, place }) {
  const { data } = await supabase.auth.getUser()
  const u = data?.user
  if (!u) return false
  const prev = Array.isArray(u.user_metadata?.cat_answers) ? u.user_metadata.cat_answers : []
  const row = { q: question.id, a: answer, place: place || '', at: new Date().toISOString() }
  const { error } = await supabase.auth.updateUser({ data: { cat_answers: [...prev, row].slice(-30) } })
  return !error
}

export const questionTitle = id => CAT_QUESTIONS.find(q => q.id === id)?.title || id
