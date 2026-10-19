import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { deliverToStaff } from '../../../lib/staffDeliver'
import { BOOKING_CUTOFF_HOURS } from '../../../lib/bookingWindow'
import {
  mergeRental, rentalHourPrice, rentalLongPrice, longEndDate, occupiedSeats,
  SEAT_IDS, pad2, parseYmd, won,
} from '../../../lib/rental'

export const dynamic = 'force-dynamic'

// 자리 대관 — 비회원 화면(/rental)과 메이트 자율창작 화면이 쓰는 서버 통로.
//   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD → 그 기간에 사용 중인 자리(이름·연락처 없이 날짜·시간·자리만)
//   POST → 신청 저장 + 운영진 알림. 금액·빈자리는 서버에서 다시 계산한다(화면 값은 믿지 않는다).
// 브라우저는 bookings·rental_requests 를 직접 못 읽는다(RLS) — 그래서 서비스 키로 여기서 모은다.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const clip = (v, n) => String(v ?? '').trim().slice(0, n)

// 서버(Vercel)는 UTC — 날짜·시각 판정은 한국 시간으로 고정한다
const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
const hoursUntilKst = (dateStr, hour) => (new Date(`${dateStr}T${pad2(hour)}:00:00+09:00`) - Date.now()) / 3600000

async function loadConfig() {
  const { data } = await supabaseAdmin.from('rental_settings').select('config').eq('id', 1).maybeSingle()
  return mergeRental(data?.config)
}

// 사용 중인 자리 — 메이트 예약(수업·자율창작) + 시간 대관(취소 제외)
// rentalOnly: 메이트 자율창작 화면은 예약을 이미 읽으니 대관 줄만 받는다(겹쳐 세면 자동 배정이 틀어진다)
async function occupancyRows(from, to, rentalOnly = false) {
  const [{ data: bk }, { data: rr }] = await Promise.all([
    rentalOnly ? Promise.resolve({ data: [] }) : supabaseAdmin.from('bookings').select('class_date, class_time, seat')
      .eq('status', 'booked').gte('class_date', from).lte('class_date', to),
    supabaseAdmin.from('rental_requests').select('date, start_hour, hours, seat')
      .eq('plan', 'hour').neq('status', 'cancelled').gte('date', from).lte('date', to),
  ])
  return [
    ...(bk || []).map(b => ({ date: b.class_date, time: b.class_time, seat: b.seat || null })),
    ...(rr || []).map(r => ({
      date: r.date, seat: r.seat,
      time: `${pad2(r.start_hour)}:00~${pad2(r.start_hour + r.hours)}:00`,
    })),
  ]
}

// 날짜 전체 잠금(타임 잠금은 수업 전용이라 대관에는 쓰지 않는다)
async function lockedDates(from, to) {
  const { data, error } = await supabaseAdmin.from('locked_dates').select('date, schedule_id')
    .gte('date', from).lte('date', to)
  if (error) return []
  return (data || []).filter(r => !r.schedule_id).map(r => r.date)
}

export async function GET(req) {
  const u = new URL(req.url)
  const from = u.searchParams.get('from'), to = u.searchParams.get('to')
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
    return NextResponse.json({ error: '날짜 형식이 맞지 않아요' }, { status: 400 })
  }
  if ((parseYmd(to) - parseYmd(from)) / 86400000 > 100) {
    return NextResponse.json({ error: '기간이 너무 길어요' }, { status: 400 })
  }
  const rentalOnly = u.searchParams.get('only') === 'rental'
  const [rows, locked] = await Promise.all([occupancyRows(from, to, rentalOnly), lockedDates(from, to)])
  return NextResponse.json({ rows, locked })
}

// 같은 곳에서 연달아 보내는 것만 막는 얕은 제한(서버 인스턴스 메모리)
const recent = new Map()
function tooFast(key) {
  const now = Date.now()
  const last = recent.get(key) || 0
  recent.set(key, now)
  if (recent.size > 2000) recent.clear()
  return now - last < 8000
}

export async function POST(req) {
  const b = await req.json().catch(() => ({}))
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (tooFast(`rental:${ip}`)) return NextResponse.json({ error: '조금 뒤에 다시 보내 주세요' }, { status: 429 })

  const cfg = await loadConfig()
  const name = clip(b.name, 30)
  const phone = clip(b.phone, 20)
  const plan = ['hour', 'week', 'month'].includes(b.plan) ? b.plan : null
  const medium = clip(b.medium, 30)
  const memo = clip(b.memo, 300)
  const date = clip(b.date, 10)

  if (!name) return NextResponse.json({ error: '이름을 적어 주세요' }, { status: 400 })
  if (phone.replace(/\D/g, '').length < 9) return NextResponse.json({ error: '연락처를 확인해 주세요' }, { status: 400 })
  if (!plan) return NextResponse.json({ error: '이용 방식을 골라 주세요' }, { status: 400 })
  if (!DATE_RE.test(date) || isNaN(parseYmd(date))) return NextResponse.json({ error: '날짜를 골라 주세요' }, { status: 400 })
  if (date < todayKst()) return NextResponse.json({ error: '지난 날짜예요' }, { status: 400 })
  if (b.agreed !== true) return NextResponse.json({ error: '유의사항 확인에 체크해 주세요' }, { status: 400 })

  const locked = await lockedDates(date, date)
  if (plan === 'hour' && locked.includes(date)) return NextResponse.json({ error: '이 날은 대관이 닫혀 있어요' }, { status: 409 })

  const seat = SEAT_IDS.includes(b.seat) ? b.seat : null
  let row

  if (plan === 'hour') {
    const start = parseInt(b.startHour, 10)
    const hours = parseInt(b.hours, 10)
    const open = Number(cfg.open_hour), close = Number(cfg.close_hour)
    if (!Number.isFinite(start) || start < open || start >= close) return NextResponse.json({ error: '시작 시간을 골라 주세요' }, { status: 400 })
    if (!Number.isFinite(hours) || hours < 1 || hours > Number(cfg.max_hours) || start + hours > close) {
      return NextResponse.json({ error: `운영 시간(${open}시~${close}시) 안에서 골라 주세요` }, { status: 400 })
    }
    if (hoursUntilKst(date, start) < BOOKING_CUTOFF_HOURS) {
      return NextResponse.json({ error: '시작 4시간 전부터는 신청할 수 없어요. 다른 시간을 골라 주세요' }, { status: 400 })
    }
    if (!seat) return NextResponse.json({ error: '자리를 골라 주세요' }, { status: 400 })
    const taken = occupiedSeats(await occupancyRows(date, date), date, start, hours)
    if (taken.has(seat)) return NextResponse.json({ error: `방금 ${seat} 자리가 찼어요. 다른 자리를 골라 주세요`, taken: [...taken] }, { status: 409 })
    const { total } = rentalHourPrice(cfg, date, start, hours)
    row = { name, phone, plan, medium, date, start_hour: start, hours, seat, rentals: [], amount: total, memo }
  } else {
    const ids = Array.isArray(b.rentals) ? b.rentals.map(String) : []
    const { items, total } = rentalLongPrice(cfg, plan, ids)
    row = {
      name, phone, plan, medium, date, end_date: longEndDate(plan, date), seat,
      rentals: items.map(r => ({ id: r.id, name: r.name, price: Number(r.price) || 0 })),
      amount: total, memo,
    }
  }

  const { data: saved, error } = await supabaseAdmin.from('rental_requests').insert(row).select('id').single()
  if (error) {
    console.error('rental insert', error)
    return NextResponse.json({ error: '신청을 저장하지 못했어요. 잠시 뒤 다시 시도하거나 운영진에게 연락해 주세요' }, { status: 500 })
  }

  // 운영진 알림 — 실패해도 신청은 이미 저장돼 관리자 화면에 보인다
  const when = plan === 'hour'
    ? `${date} ${pad2(row.start_hour)}:00~${pad2(row.start_hour + row.hours)}:00`
    : `${date} ~ ${row.end_date}`
  const planLabel = plan === 'hour' ? '시간' : cfg.plans[plan]?.label || plan
  const text = [
    `${name} · ${phone}`,
    `${planLabel} · ${medium || '작업 미선택'}`,
    `${when}${seat ? ` · ${seat}자리` : ''}`,
    row.rentals.length ? `대여: ${row.rentals.map(r => r.name).join(', ')}` : '',
    row.amount ? won(row.amount) : '금액 협의',
    memo ? `메모: ${memo}` : '',
  ].filter(Boolean).join('\n')
  try {
    await deliverToStaff({
      type: 'rental_request', title: '🪑 자리 대관 신청', text,
      link: 'https://2hosunstudio.vercel.app/admin/rental',
    })
  } catch (e) { console.error('rental notify', e) }

  return NextResponse.json({ ok: true, id: saved.id, amount: row.amount, end_date: row.end_date || null })
}
