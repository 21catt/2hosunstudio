// 자리 대관(/rental) — 비회원도 시간·주·월 단위로 자리를 빌린다.
// 문구·가격·준비물·유의사항·고양이 안내는 전부 rental_settings 한 줄(id = 1)의 config 에 있고,
// 관리자 「자리대관」(/admin/rental) 에서 고친다. 표가 없거나 비어 있으면 DEFAULT_RENTAL 로 보인다.
//
// ⚠️ 가격 계산은 화면과 서버(/api/rental)가 이 파일의 rentalHourPrice 를 같이 쓴다 —
//    화면 금액과 저장 금액이 어긋나지 않게.
import { supabase } from './supabase'

// 자리 — 메이트 자율창작 평면도(app/student/free)와 같은 5석
export const RENTAL_SEATS = [
  { id: 'A', label: '창가·자연광' },
  { id: 'B', label: '창가·자연광' },
  { id: 'C', label: '중앙' },
  { id: 'D', label: '중앙' },
  { id: 'E', label: '창가' },
]
export const SEAT_IDS = RENTAL_SEATS.map(s => s.id)

export const RENTAL_STATUS = {
  pending:   { label: '입금 대기', color: '#9A5B00', bg: '#FAEEDA' },
  confirmed: { label: '확정',     color: '#3D5A12', bg: '#E4F4C4' },
  cancelled: { label: '취소',     color: '#6E6B64', bg: '#ECEAE4' },
}

export const DEFAULT_RENTAL = {
  open_hour: 7,
  close_hour: 22,
  hours_note: '그 외 시간은 협의 후 이용할 수 있어요.',
  max_hours: 6,
  rates: { weekday_day: 6000, weekday_evening: 8000, evening_from: 17, weekend: 10000 },
  plans: {
    week:  { label: '주 이용', price: 0, note: '1주 단위 · 운영 시간 안에서 이용' },
    month: { label: '월 이용', price: 0, note: '한 달 단위 · 운영 시간 안에서 이용' },
  },
  media: [
    { id: 'oil',     name: '유화',         note: '이젤 · 자연광',       seats: 'A,B' },
    { id: 'east',    name: '동양화',       note: '수묵 · 채색 · 넓은 면', seats: 'D,E' },
    { id: 'acrylic', name: '아크릴',       note: '이젤 · 테이블 모두',    seats: '' },
    { id: 'water',   name: '수채화',       note: '물 사용 · 평면 작업',   seats: 'D,E' },
    { id: 'draw',    name: '드로잉 · 크로키', note: '연필 · 목탄 · 콩테',   seats: '' },
    { id: 'etc',     name: '기타',         note: '조소 · 디지털 · 그 외', seats: '' },
  ],
  short: {
    bring: '붓, 캔버스, 물감',
    provided: '유화 세척도구, 팔레트',
    rules: [
      '스튜디오 세척도구·팔레트는 퇴실 전 닦아서 제자리에 둬요.',
      '오일·용제, 물감 묻은 휴지는 지정 폐기함에 버려요.',
      '작품과 개인 재료는 당일 가져가요.',
      '수업 시간엔 수강생과 공간을 함께 써요. 최대 5인.',
      '예약 시간이 끝나기 전에 자리를 처음처럼 정리해요.',
    ],
  },
  long: {
    bring: '붓, 캔버스, 물감, 세척도구, 팔레트, 휴지',
    rentals: [
      { id: 'wash',    name: '유화 세척도구 세트', price: 0 },
      { id: 'palette', name: '팔레트',          price: 0 },
      { id: 'tissue',  name: '휴지 · 키친타월',   price: 0 },
    ],
    rules: [
      '스튜디오 세척도구·팔레트는 장기 이용자에게 제공되지 않아요. 필요하면 대여해 주세요.',
      '개인 용제·오일은 뚜껑을 닫아 두고, 폐기는 지정 폐기함에.',
      '작품·재료 보관 위치는 운영진과 정해요.',
      '이용 기간이 끝나면 개인 물품을 모두 정리해요.',
    ],
  },
  cats: {
    names: ['', '', ''],
    allergy: '고양이 알레르기가 있다면 신청 전에 꼭 알려주세요. 털은 작업실 어디에나 있어요.',
    rules: [
      '용제·오일·테레빈은 쓰지 않을 때 꼭 뚜껑을 닫아요. 고양이에게 해로워요.',
      '젖은 캔버스와 팔레트는 바닥 말고 높은 곳에. 발자국이 찍혀요.',
      '출입문은 드나들 때마다 바로 닫아 주세요.',
      '간식이나 음식은 주지 말아 주세요.',
      '자는 고양이는 깨우지 않고, 억지로 안지 않아요.',
    ],
    footnote: '마르기 전 화면에 털이 붙을 수 있어요. 마무리 전에 한 번 살펴봐 주세요.',
  },
  deposit: { bank: '국민은행', account: '392801-04-209666', holder: '양승민 (2호선스튜디오)' },
  deposit_note: '입금이 확인되면 확정돼요. 24시간 안에 입금이 없으면 취소될 수 있어요.',
}

// 저장된 값 위에 기본값을 깐다 — 새 항목이 생겨도 예전 저장본이 화면을 깨뜨리지 않게.
// 배열은 통째로 저장값이 이긴다(관리자가 지운 줄이 되살아나지 않게).
export function mergeRental(saved) {
  const deep = (base, over) => {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base
    if (base && typeof base === 'object') {
      const out = { ...base }
      for (const k of Object.keys(over || {})) out[k] = k in base ? deep(base[k], over[k]) : over[k]
      return out
    }
    return over === undefined || over === null ? base : over
  }
  return deep(DEFAULT_RENTAL, saved || {})
}

export async function loadRentalSettings() {
  const { data, error } = await supabase.from('rental_settings').select('config').eq('id', 1).maybeSingle()
  if (error) return { config: mergeRental(null), error }
  return { config: mergeRental(data?.config), error: null }
}

export async function saveRentalSettings(config) {
  return supabase.from('rental_settings').upsert({ id: 1, config, updated_at: new Date().toISOString() })
}

// ── 날짜·가격 ──────────────────────────────────────────────
export const pad2 = n => String(n).padStart(2, '0')
export const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
export const parseYmd = s => new Date(`${s}T00:00:00`)
const isWeekend = d => d.getDay() === 0 || d.getDay() === 6

export function hourRate(cfg, date, hour) {
  const r = cfg.rates
  if (isWeekend(date)) return Number(r.weekend) || 0
  if (hour >= Number(r.evening_from)) return Number(r.weekday_evening) || 0
  return Number(r.weekday_day) || 0
}

export function hourRateLabel(cfg, date, hour) {
  if (isWeekend(date)) return '주말'
  return hour >= Number(cfg.rates.evening_from) ? '평일 저녁' : '평일 낮'
}

// 시간 이용 금액 + 줄별 내역 [{ label, rate, count }]
export function rentalHourPrice(cfg, dateStr, startHour, hours) {
  const date = parseYmd(dateStr)
  const lines = new Map()
  let total = 0
  for (let h = startHour; h < startHour + hours; h++) {
    const rate = hourRate(cfg, date, h)
    const label = hourRateLabel(cfg, date, h)
    total += rate
    const key = `${label}|${rate}`
    lines.set(key, { label, rate, count: (lines.get(key)?.count || 0) + 1 })
  }
  return { total, lines: [...lines.values()] }
}

// 장기 이용 금액 — 이용권 + 고른 대여 품목
export function rentalLongPrice(cfg, plan, rentalIds = []) {
  const base = Number(cfg.plans?.[plan]?.price) || 0
  const items = (cfg.long.rentals || []).filter(r => rentalIds.includes(r.id))
  const total = base + items.reduce((s, r) => s + (Number(r.price) || 0), 0)
  return { base, items, total }
}

// 장기 이용 종료일 — 주 7일, 월은 다음 달 같은 날 하루 전
export function longEndDate(plan, startStr) {
  const d = parseYmd(startStr)
  if (plan === 'week') d.setDate(d.getDate() + 6)
  else { d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1) }
  return ymd(d)
}

export const won = n => `${(Number(n) || 0).toLocaleString()}원`
export const priceOrAsk = n => (Number(n) > 0 ? won(n) : '문의')

// "14:00~18:00" → [14, 18]
export function timeRange(t) {
  const [s, e] = String(t || '').split('~')
  const sh = parseInt(s, 10), eh = parseInt(e, 10)
  return Number.isFinite(sh) && Number.isFinite(eh) ? [sh, eh] : null
}

// 이 시간대(시작~끝)에 사용 중인 자리 — rows: [{ date, time, seat }]
// 자리 없는 수업 예약은 메이트와 같은 순서(D→E→C→B→A)로 자동 배정된 것으로 본다.
export function occupiedSeats(rows, dateStr, startHour, hours) {
  const taken = new Set()
  for (let h = startHour; h < startHour + hours; h++) {
    const here = rows.filter(r => {
      if (r.date !== dateStr) return false
      const tr = timeRange(r.time)
      return tr && h >= tr[0] && h < tr[1]
    })
    const atHour = new Set(here.filter(r => r.seat).map(r => r.seat))
    const order = ['D', 'E', 'C', 'B', 'A']
    let i = 0
    here.filter(r => !r.seat).forEach(() => {
      while (i < order.length && atHour.has(order[i])) i++
      if (i < order.length) atHour.add(order[i++])
    })
    atHour.forEach(s => taken.add(s))
  }
  return taken
}
