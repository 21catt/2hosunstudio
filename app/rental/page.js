'use client'
// 자리 대관(/rental) — 로그인 없이 누구나 자리를 빌려 작업한다.
// 흐름: 소개 → 이용 방식 → 작업 → 날짜·자리 → 준비물·유의사항 → 고양이 → 확인 → 완료
// 문구·가격은 관리자 「자리대관」(/admin/rental)에서 고친다(lib/rental.js 의 config).
// ⚠️ 테마 변수(--ac 등)를 쓰지 않고 이 페이지 전용 색을 쓴다 — 방문자 테마에 따라 글씨가 흐려지지 않게.
import { useState, useEffect, useMemo } from 'react'
import {
  loadRentalSettings, mergeRental, RENTAL_SEATS, rentalHourPrice, rentalLongPrice, longEndDate,
  occupiedSeats, ymd, parseYmd, pad2, won, priceOrAsk,
} from '../../lib/rental'
import { BOOKING_CUTOFF_HOURS } from '../../lib/bookingWindow'

const C = {
  ink: '#141414', sub: '#5C5A55', faint: '#6E6B64', line: '#E4E1D9', line2: '#D6D2C8',
  lime: '#C9EC80', limeSoft: '#DDEBB8', olive: '#4F5F2B', beige: '#EEEBE4', beige2: '#F4F2ED',
  busy: '#DEDAD1', warn: '#9A4A2E', white: '#FFFFFF',
}
const FONT = "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif"
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const STEPS = ['plan', 'medium', 'when', 'guide', 'cats', 'confirm']

export default function RentalPage() {
  const [cfg, setCfg] = useState(() => mergeRental(null))
  const [step, setStep] = useState('intro')
  const [plan, setPlan] = useState('hour')
  const [medium, setMedium] = useState('oil')
  const [date, setDate] = useState(null)
  const [startHour, setStartHour] = useState(null)
  const [hours, setHours] = useState(2)
  const [seatRaw, setSeat] = useState(null)
  const [rentals, setRentals] = useState([])
  const [form, setForm] = useState({ name: '', phone: '', memo: '', agreed: false })
  const [occ, setOcc] = useState({ rows: [], locked: [] })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    loadRentalSettings().then(({ config }) => setCfg(config))
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap'
    document.head.appendChild(link)
    return () => link.remove()
  }, [])

  // 앞으로 3주 — 시간 이용 날짜 고르기
  const days = useMemo(() => {
    const out = [], d = new Date()
    for (let i = 0; i < 21; i++) { out.push(ymd(d)); d.setDate(d.getDate() + 1) }
    return out
  }, [])

  const [occTick, setOccTick] = useState(0)
  const loadOccupancy = () => setOccTick(t => t + 1)
  useEffect(() => {
    let alive = true
    fetch(`/api/rental?from=${days[0]}&to=${days[days.length - 1]}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) setOcc({ rows: j.rows || [], locked: j.locked || [] }) })
      .catch(() => { /* 빈자리 정보가 없으면 서버가 신청 때 다시 확인한다 */ })
    return () => { alive = false }
  }, [days, occTick])

  const isShort = plan === 'hour'
  const curMedium = cfg.media.find(m => m.id === medium) || cfg.media[0]
  const recSeats = (curMedium?.seats || '').split(',').map(s => s.trim()).filter(Boolean)
  const taken = isShort && date && startHour != null ? occupiedSeats(occ.rows, date, startHour, hours) : new Set()
  // 시간 칸이 바뀌어 고른 자리가 차 버리면 고른 적 없는 것으로 본다
  const seat = isShort && seatRaw && taken.has(seatRaw) ? null : seatRaw
  const hourPrice = isShort && date && startHour != null ? rentalHourPrice(cfg, date, startHour, hours) : null
  const longPrice = !isShort ? rentalLongPrice(cfg, plan, rentals) : null

  const open = Number(cfg.open_hour), close = Number(cfg.close_hour)
  const startHours = []
  for (let h = open; h < close; h++) startHours.push(h)
  const hourTooSoon = h => date && (new Date(`${date}T${pad2(h)}:00:00`) - nowMs) / 3600000 < BOOKING_CUTOFF_HOURS
  const maxHours = startHour == null ? Number(cfg.max_hours) : Math.min(Number(cfg.max_hours), close - startHour)

  const whenReady = isShort ? !!(date && startHour != null && seat) : !!date
  const formReady = form.name.trim() && form.phone.replace(/\D/g, '').length >= 9 && form.agreed

  async function submit() {
    if (!formReady || sending) return
    setSending(true); setError('')
    try {
      const r = await fetch('/api/rental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan, medium: curMedium?.name || '', date, startHour, hours, seat,
          rentals, name: form.name, phone: form.phone, memo: form.memo, agreed: form.agreed,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) {
        setError(j.error || '신청을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요')
        if (r.status === 409) { loadOccupancy(); setSeat(null) }
        return
      }
      setDone({ amount: j.amount, end: j.end_date })
      setStep('done')
    } catch {
      setError('인터넷 연결을 확인해 주세요')
    } finally { setSending(false) }
  }

  const go = s => { setStep(s); setError(''); window.scrollTo(0, 0) }
  const idx = STEPS.indexOf(step)
  const back = () => go(idx <= 0 ? 'intro' : STEPS[idx - 1])

  return (
    <div style={{ minHeight: '100vh', background: C.white, color: C.ink, fontFamily: FONT, position: 'relative', overflowX: 'hidden' }}>
      {step === 'intro' && <Intro cfg={cfg} onStart={() => go('plan')} />}

      {idx >= 0 && (
        <div style={{ padding: '18px 24px 28px', minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <Progress index={idx} total={STEPS.length} onBack={back} />

          {step === 'plan' && (
            <Section kicker="PLAN" title="얼마나 쓰실 건가요?">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { id: 'hour', name: '시간 이용', tag: '단기', price: `${won(cfg.rates.weekday_day)}~`,
                    sub: `평일 낮 ${won(cfg.rates.weekday_day)} · 평일 ${cfg.rates.evening_from}시 이후 ${won(cfg.rates.weekday_evening)} · 주말 ${won(cfg.rates.weekend)} (1시간)` },
                  { id: 'week', name: cfg.plans.week.label, tag: '장기', price: priceOrAsk(cfg.plans.week.price), sub: cfg.plans.week.note },
                  { id: 'month', name: cfg.plans.month.label, tag: '장기', price: priceOrAsk(cfg.plans.month.price), sub: cfg.plans.month.note },
                ].map(p => (
                  <button key={p.id} onClick={() => { setPlan(p.id); setSeat(null) }} style={choice(plan === p.id)}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 17, fontWeight: 700 }}>{p.name}</span>
                        <span style={tag(p.tag === '단기')}>{p.tag}</span>
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{p.price}</span>
                    </span>
                    <span style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>{p.sub}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16, background: C.beige, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, lineHeight: 1.6 }}>
                <div style={kicker}>{isShort ? '단기 이용 준비물' : '장기 이용 준비물'}</div>
                <div><span style={{ color: C.sub }}>가져올 것 </span>{isShort ? cfg.short.bring : cfg.long.bring}</div>
                <div><span style={{ color: C.sub }}>{isShort ? '스튜디오 것 사용 ' : '없으면 대여 '}</span>{isShort ? cfg.short.provided : '항목별 추가 비용'}</div>
              </div>
              <Hours cfg={cfg} />
            </Section>
          )}

          {step === 'medium' && (
            <Section kicker="MEDIUM" title="어떤 작업을 하시나요?" lead="재료에 맞는 자리를 먼저 추천해 드려요.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {cfg.media.map(m => (
                  <button key={m.id} onClick={() => setMedium(m.id)} style={{ ...choice(medium === m.id), minHeight: 80, gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: C.sub, lineHeight: 1.45 }}>{m.note}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16, background: C.beige, borderRadius: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: C.lime, border: `1.5px solid ${C.ink}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                  {recSeats.length ? recSeats.join('·') : '전체'}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <div style={{ fontSize: 12, color: C.olive, fontWeight: 500 }}>추천 자리</div>
                  {recSeats.length ? `${recSeats.join(' · ')} 자리 — ${RENTAL_SEATS.find(s => s.id === recSeats[0])?.label || ''}` : '어느 자리든 괜찮아요'}
                </div>
              </div>
            </Section>
          )}

          {step === 'when' && isShort && (
            <Section kicker="WHEN" title="언제, 어디에 앉을까요?">
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto', margin: '0 -24px', padding: '0 24px 4px' }}>
                {days.map(d => {
                  const dt = parseYmd(d), locked = occ.locked.includes(d), on = date === d
                  const wk = dt.getDay() === 0 || dt.getDay() === 6
                  return (
                    <button key={d} disabled={locked} onClick={() => { setDate(d); setStartHour(null) }}
                      aria-label={`${dt.getMonth() + 1}월 ${dt.getDate()}일 ${DOW[dt.getDay()]}요일${locked ? ' 휴무' : ''}`}
                      style={{ ...reset, flex: '0 0 50px', height: 62, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                        background: on ? C.ink : C.white, color: on ? C.white : locked ? C.line2 : C.ink, border: on ? 'none' : `1px solid ${C.line}`, cursor: locked ? 'default' : 'pointer' }}>
                      <span style={{ fontSize: 11, color: on ? C.lime : wk ? C.warn : C.sub }}>{DOW[dt.getDay()]}</span>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>{dt.getDate()}</span>
                      {locked && <span style={{ fontSize: 9 }}>휴무</span>}
                    </button>
                  )
                })}
              </div>

              {date && (
                <>
                  <Label>시작 시간 · {open}시 – {close - 1}시</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                    {startHours.map(h => {
                      const soon = hourTooSoon(h), on = startHour === h
                      return (
                        <button key={h} disabled={soon} onClick={() => { setStartHour(h); setHours(Math.min(hours, Math.min(Number(cfg.max_hours), close - h))) }}
                          style={{ ...reset, height: 44, borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: on ? 700 : 400,
                            background: on ? C.lime : C.white, border: on ? `1.5px solid ${C.ink}` : `1px solid ${C.line}`,
                            color: soon ? C.line2 : C.ink, cursor: soon ? 'default' : 'pointer' }}>
                          {h}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{cfg.hours_note} 시작 {BOOKING_CUTOFF_HOURS}시간 전까지 신청할 수 있어요.</div>
                </>
              )}

              {date && startHour != null && (
                <>
                  <Label>이용 시간</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Number(cfg.max_hours), 6)}, minmax(0, 1fr))`, gap: 6 }}>
                    {Array.from({ length: Number(cfg.max_hours) }, (_, i) => i + 1).map(n => {
                      const ok = n <= maxHours, on = hours === n
                      return (
                        <button key={n} disabled={!ok} onClick={() => setHours(n)}
                          style={{ ...reset, height: 40, borderRadius: 10, textAlign: 'center', fontSize: 13, fontWeight: on ? 500 : 400,
                            background: on ? C.ink : C.white, color: on ? C.white : ok ? C.ink : C.line2, border: on ? 'none' : `1px solid ${C.line}`, cursor: ok ? 'pointer' : 'default' }}>
                          {n}시간
                        </button>
                      )
                    })}
                  </div>
                  {hourPrice && (
                    <div style={{ fontSize: 12.5, color: C.olive, marginTop: 8 }}>
                      {hourPrice.lines.map(l => `${l.label} ${won(l.rate)} × ${l.count}`).join(' · ')}
                    </div>
                  )}
                  <Label>자리 · {startHour}시 – {startHour + hours}시 기준</Label>
                  <SeatMap taken={taken} seat={seat} rec={recSeats} onPick={setSeat} />
                </>
              )}
            </Section>
          )}

          {step === 'when' && !isShort && (
            <Section kicker="START" title="언제부터 쓰실 건가요?">
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: C.sub }}>
                시작일
                <input type="date" min={days[1]} value={date || ''} onChange={e => setDate(e.target.value || null)} style={input} />
              </label>
              {date && (
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  이용 기간 <b>{fmtDate(date)} – {fmtDate(longEndDate(plan, date))}</b>
                </div>
              )}
              <Label>희망 자리 (선택)</Label>
              <SeatMap taken={new Set()} seat={seat} rec={recSeats} onPick={s => setSeat(seat === s ? null : s)} />
              <div style={{ fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 1.55 }}>
                장기 이용은 수업 일정에 맞춰 운영진이 자리를 확정해 연락드려요. 운영 {open}:00 – {close}:00 · {cfg.hours_note}
              </div>
            </Section>
          )}

          {step === 'guide' && (
            <Section kicker={isShort ? 'SHORT TERM' : 'LONG TERM'} title="준비물과 약속">
              {isShort ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>가져올 것</div>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>{splitList(cfg.short.bring).map(x => <div key={x}>{x}</div>)}</div>
                  </div>
                  <div style={{ background: C.lime, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#3A3935', marginBottom: 6 }}>스튜디오 것 사용 가능</div>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>{splitList(cfg.short.provided).map(x => <div key={x}>{x}</div>)}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>모두 개인 준비</div>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.55 }}>{cfg.long.bring}</div>
                  </div>
                  {cfg.long.rentals.length > 0 && (
                    <>
                      <Label>없으면 대여 · 추가 비용</Label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {cfg.long.rentals.map(r => {
                          const on = rentals.includes(r.id)
                          return (
                            <button key={r.id} aria-pressed={on} onClick={() => setRentals(on ? rentals.filter(x => x !== r.id) : [...rentals, r.id])}
                              style={{ ...reset, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, padding: '0 14px', borderRadius: 12, fontSize: 14,
                                background: on ? C.beige : C.white, border: on ? `1.5px solid ${C.ink}` : `1px solid ${C.line}`, cursor: 'pointer' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                                  ...(on ? { background: C.ink, color: C.lime } : { border: `1.5px solid ${C.line2}` }) }}>{on ? '✓' : ''}</span>
                                {r.name}
                              </span>
                              <span style={{ fontSize: 13, color: '#3A3935' }}>{Number(r.price) > 0 ? `+ ${won(r.price)}` : '문의'}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
              <Rules title={isShort ? '단기 이용 유의사항' : '장기 이용 유의사항'} rules={isShort ? cfg.short.rules : cfg.long.rules} />
            </Section>
          )}

          {step === 'cats' && <Cats cfg={cfg} />}

          {step === 'confirm' && (
            <Section kicker="CONFIRM" title="마지막으로 확인할게요.">
              <Summary cfg={cfg} plan={plan} medium={curMedium} date={date} startHour={startHour} hours={hours} seat={seat} hourPrice={hourPrice} longPrice={longPrice} />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label="이름"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="홍길동" autoComplete="name" style={input} /></Field>
                <Field label="연락처"><input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" autoComplete="tel" style={input} /></Field>
                <Field label="작업 메모 (선택)"><input value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} placeholder="캔버스 크기, 필요한 것 등" style={input} /></Field>
              </div>
              <label style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.55, color: '#3A3935', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.agreed} onChange={e => setForm({ ...form, agreed: e.target.checked })} style={{ width: 20, height: 20, margin: '1px 0 0', accentColor: C.ink, flexShrink: 0 }} />
                <span>{isShort ? '단기' : '장기'} 이용 유의사항과 고양이 주의사항을 확인했어요.{!isShort && ` ${close}시 이후 이용은 따로 협의할게요.`}</span>
              </label>
              {error && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: C.warn, lineHeight: 1.5 }}>{error}</div>}
            </Section>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            {step === 'confirm' ? (
              <>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>{cfg.deposit_note}</div>
                <button onClick={submit} disabled={!formReady || sending} style={primary(!!formReady && !sending)}>{sending ? '보내는 중…' : '신청하기'}</button>
              </>
            ) : (
              <button
                onClick={() => go(STEPS[idx + 1])}
                disabled={step === 'when' && !whenReady}
                style={primary(!(step === 'when' && !whenReady))}>
                {step === 'when' && isShort && seat && hourPrice ? `${seat} · ${hours}시간 · ${won(hourPrice.total)}  다음` : step === 'cats' ? '알겠어요' : step === 'guide' ? '확인했어요' : '다음'}
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'done' && done && (
        <div style={{ padding: '72px 24px 32px', minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <Blob style={{ position: 'absolute', right: -60, top: -20, width: 260 }} />
          <div style={{ position: 'relative' }}>
            <div style={kicker}>RECEIVED</div>
            <h1 style={{ margin: '10px 0 0', fontSize: 30, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.04em' }}>신청이<br />전달됐어요.</h1>
            <p style={{ margin: '12px 0 0', fontSize: 15, color: '#3A3935', lineHeight: 1.6, fontWeight: 300 }}>운영진이 확인하고 연락드릴게요.</p>
          </div>
          <div style={{ marginTop: 32, background: C.beige, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
            <Row k="입금 금액" v={done.amount ? won(done.amount) : '운영진이 안내드려요'} strong />
            <Row k="은행" v={cfg.deposit.bank} />
            <Row k="계좌" v={cfg.deposit.account} />
            <Row k="예금주" v={cfg.deposit.holder} />
            {done.amount > 0 && (
              <button onClick={() => navigator.clipboard?.writeText(cfg.deposit.account.replace(/\D/g, ''))}
                style={{ ...reset, marginTop: 4, height: 44, borderRadius: 12, border: `1px solid ${C.ink}`, textAlign: 'center', fontSize: 14, fontWeight: 500, cursor: 'pointer', background: C.white }}>
                계좌번호 복사
              </button>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.55, marginTop: 12 }}>{cfg.deposit_note}</div>
          <a href="/intro" style={{ ...primaryBase, marginTop: 'auto', background: C.ink, color: C.white, textDecoration: 'none' }}>2호선 스튜디오 둘러보기</a>
        </div>
      )}
    </div>
  )
}

// ── 화면 조각 ─────────────────────────────────────────────

function Intro({ cfg, onStart }) {
  const r = cfg.rates
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px 0', position: 'relative', zIndex: 2 }}>
        <a href="/intro" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, textDecoration: 'none' }}>2호선 스튜디오</a>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.olive, border: '1px solid #A9C46A', borderRadius: 999, padding: '5px 12px' }}>자리 대관</span>
      </header>
      <div style={{ position: 'relative', height: 300 }}>
        <Blob style={{ position: 'absolute', right: -40, top: 0, width: 290 }} />
        <div style={{ position: 'absolute', left: 24, top: 60, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={kicker}>OPEN STUDIO</div>
          <h1 style={{ margin: 0, fontSize: 36, lineHeight: 1.22, fontWeight: 700, letterSpacing: '-0.04em' }}>빈 자리 하나,<br />오늘의 작업실.</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, fontWeight: 300, color: '#3A3935' }}>유화, 동양화, 아크릴.<br />각자의 재료로, 같은 공간에서.</p>
        </div>
      </div>
      <div style={{ padding: '0 24px' }}>
        <InfoRow k="위치" v="신도림역 1번 출구 3분" />
        <InfoRow k="이용 시간" v={`${pad2(cfg.open_hour)}:00 – ${cfg.close_hour}:00`} sub={cfg.hours_note} />
        <InfoRow k="이용료" v={`시간당 ${won(r.weekday_day)}부터`} sub="주 · 월 이용권 있음" />
        <InfoRow k="좌석" v="A – E 5석 · 창가 자연광" />
        <InfoRow k="함께 있는 친구" v="작업실 고양이 3마리" sub="알레르기가 있다면 미리 확인해 주세요" warn last />
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 28, position: 'relative' }}>
        <div style={{ position: 'relative', background: C.beige, padding: '28px 24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <svg aria-hidden="true" width="150" height="100%" style={{ position: 'absolute', right: 0, top: 0, height: '100%' }}>
            <defs><pattern id="sq" width="22" height="22" patternUnits="userSpaceOnUse"><rect x="6" y="6" width="11" height="11" fill={C.limeSoft} /></pattern></defs>
            <rect width="150" height="100%" fill="url(#sq)" />
          </svg>
          <p style={{ margin: 0, fontSize: 13, color: C.sub, position: 'relative' }}>질문 몇 개, 1분이면 끝나요.</p>
          <button onClick={onStart} style={{ ...primaryBase, position: 'relative', justifyContent: 'space-between', padding: '0 22px', background: C.ink, color: C.white, cursor: 'pointer' }}>
            자리 신청하기
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function Cats({ cfg }) {
  const names = cfg.cats.names || []
  const fills = [C.lime, C.beige, C.limeSoft]
  return (
    <Section kicker="STUDIO CATS" title={<>작업실엔 고양이 셋이<br />함께 지내요.</>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 72, height: 72, borderRadius: ['46% 54% 50% 50% / 52% 46% 54% 48%', '52% 48% 46% 54% / 48% 54% 46% 52%', '50% 50% 54% 46% / 46% 52% 48% 54%'][i], background: fills[i], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 9.5 6.5 3.5l4 3.6h3l4-3.6 1 6c1.4 2 1.4 5.2 0 7.2-1.8 2.6-10.2 2.6-12 0-1.4-2-1.4-5.2 0-7.2z" />
                <path d="M9.5 12.5v.5M14.5 12.5v.5M11.2 15h1.6l-.8.8z" />
              </svg>
            </div>
            {names[i] && <span style={{ fontSize: 13, fontWeight: 500 }}>{names[i]}</span>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, border: `1.5px solid ${C.ink}`, borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.warn} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.2" /></svg>
        <span style={{ fontSize: 13, lineHeight: 1.55 }}>{cfg.cats.allergy}</span>
      </div>
      <Rules rules={cfg.cats.rules} />
      {cfg.cats.footnote && <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.55, color: C.sub }}>{cfg.cats.footnote}</p>}
    </Section>
  )
}

function Summary({ cfg, plan, medium, date, startHour, hours, seat, hourPrice, longPrice }) {
  const short = plan === 'hour'
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: C.beige, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <Blob style={{ position: 'absolute', right: -34, top: -38, width: 120 }} />
      <Row k="이용 방식" v={short ? '시간 이용 · 단기' : `${cfg.plans[plan].label} · 장기`} />
      <Row k="작업" v={medium?.name || '-'} />
      {short ? (
        <>
          <Row k="날짜" v={fmtDate(date)} />
          <Row k="시간" v={`${pad2(startHour)}:00 – ${pad2(startHour + hours)}:00 · ${hours}시간`} />
          <Row k="자리" v={`${seat} · ${RENTAL_SEATS.find(s => s.id === seat)?.label || ''}`} />
        </>
      ) : (
        <>
          <Row k="기간" v={`${fmtDate(date)} – ${fmtDate(longEndDate(plan, date))}`} />
          <Row k="이용 시간" v={`${pad2(cfg.open_hour)}:00 – ${cfg.close_hour}:00`} />
          <Row k="희망 자리" v={seat ? `${seat} · ${RENTAL_SEATS.find(s => s.id === seat)?.label}` : '운영진과 정하기'} />
        </>
      )}
      <div style={{ height: 1, background: C.line2, margin: '4px 0' }} />
      {short && hourPrice?.lines.map(l => <Row key={l.label + l.rate} k={`${l.label} ${won(l.rate)} × ${l.count}`} v={won(l.rate * l.count)} small />)}
      {short && <Row k={splitList(cfg.short.provided).join(' · ')} v="스튜디오 제공" small />}
      {!short && <Row k={cfg.plans[plan].label} v={priceOrAsk(longPrice.base)} small />}
      {!short && longPrice.items.map(r => <Row key={r.id} k={`대여 · ${r.name}`} v={Number(r.price) > 0 ? `+ ${won(r.price)}` : '문의'} small />)}
      <Row k="합계" v={(short ? hourPrice?.total : longPrice.total) ? won(short ? hourPrice.total : longPrice.total) : '운영진이 안내드려요'} strong />
    </div>
  )
}

function SeatMap({ taken, seat, rec, onPick }) {
  const pos = { A: [80, 100], B: [170, 100], C: [295, 120], D: [385, 120], E: [290, 220] }
  return (
    <div style={{ background: C.beige, borderRadius: 18, padding: '12px 10px 10px' }}>
      <div style={{ textAlign: 'center', fontSize: 10, color: C.sub, letterSpacing: 2, marginBottom: 4 }}>─── 창가 ───</div>
      <svg viewBox="0 0 560 300" style={{ width: '100%', display: 'block' }} role="group" aria-label="자리 배치도">
        <path d="M 40 60 L 250 60 L 250 100 L 540 100 L 540 270 L 200 270 L 200 230 L 40 230 Z" fill="#F7F4EC" stroke={C.line2} strokeWidth="1.2" />
        <rect x="455" y="150" width="70" height="90" rx="20" fill="#E2D8C4" />
        <text x="490" y="200" textAnchor="middle" fontSize="12" fill={C.faint}>테이블</text>
        <line x1="40" y1="210" x2="22" y2="210" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
        <text x="18" y="200" fontSize="12" fill={C.sub} textAnchor="end">입구</text>
        {RENTAL_SEATS.map(s => {
          const [x, y] = pos[s.id]
          const busy = taken.has(s.id), on = seat === s.id, isRec = rec.includes(s.id)
          return (
            <g key={s.id} role="button" tabIndex={busy ? -1 : 0} aria-label={`${s.id} 자리 ${s.label}${busy ? ' 사용 중' : ''}${on ? ' 선택됨' : ''}`}
              aria-disabled={busy} onClick={() => !busy && onPick(s.id)}
              onKeyDown={e => { if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(s.id) } }}
              style={{ cursor: busy ? 'not-allowed' : 'pointer', outline: 'none' }}>
              <rect x={x - 8} y={y - 8} width="58" height="58" rx="12"
                fill={on ? C.lime : busy ? C.busy : C.white} stroke={on ? C.ink : busy ? 'none' : isRec ? C.olive : '#CFCAC0'}
                strokeWidth={on ? 2.5 : isRec ? 2 : 1.4} strokeDasharray={!on && !busy && isRec ? '5 4' : undefined} />
              <text x={x + 21} y={y + 26} textAnchor="middle" fontSize="20" fontWeight={on ? 700 : 500} fill={busy ? C.faint : C.ink}>{s.id}</text>
              <text x={x + 21} y={y + 68} textAnchor="middle" fontSize="11" fill={on ? C.ink : busy ? C.faint : C.sub} fontWeight={on ? 700 : 400}>
                {busy ? '사용 중' : on ? '내 자리' : isRec ? '추천' : s.label}
              </text>
            </g>
          )
        })}
        <text x="370" y="292" textAnchor="middle" fontSize="11" fill={C.sub} letterSpacing="3">─── 창가 ───</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11, color: C.sub, marginTop: 4 }}>
        <Legend fill={C.white} border="#CFCAC0" t="가능" />
        <Legend fill={C.lime} border={C.ink} t="내 자리" />
        <Legend fill={C.busy} t="사용 중" />
      </div>
    </div>
  )
}

function Progress({ index, total, onBack }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onBack} aria-label="뒤로" style={{ ...reset, width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div style={{ flexGrow: 1, display: 'flex', gap: 5 }}>
        {Array.from({ length: total }, (_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= index ? C.ink : C.line }} />)}
      </div>
      <div style={{ fontSize: 12, color: C.sub }}>{index + 1} / {total}</div>
    </header>
  )
}

function Section({ kicker: k, title, lead, children }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={kicker}>{k}</div>
      <h1 style={{ margin: '8px 0 0', fontSize: 25, lineHeight: 1.35, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</h1>
      {lead && <p style={{ margin: '8px 0 0', fontSize: 14, color: C.sub, fontWeight: 300 }}>{lead}</p>}
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  )
}

function Rules({ title, rules }) {
  return (
    <div style={{ marginTop: 18 }}>
      {title && <div style={{ ...kicker, paddingBottom: 6 }}>{title}</div>}
      {rules.filter(Boolean).map((r, i, arr) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderTop: `1px solid ${C.line}`, borderBottom: i === arr.length - 1 ? `1px solid ${C.line}` : 'none', fontSize: 14, lineHeight: 1.55 }}>
          <span style={{ color: C.olive, fontWeight: 700 }}>{pad2(i + 1)}</span><span>{r}</span>
        </div>
      ))}
    </div>
  )
}

function Hours({ cfg }) {
  return <div style={{ marginTop: 14, fontSize: 13, color: C.sub }}>운영 {pad2(cfg.open_hour)}:00 – {cfg.close_hour}:00 · {cfg.hours_note}</div>
}

function InfoRow({ k, v, sub, warn, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: `1px solid ${C.line}`, borderBottom: last ? `1px solid ${C.line}` : 'none', fontSize: 14 }}>
      <span style={{ color: C.sub, flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}{sub && <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: warn ? C.warn : C.sub }}>{sub}</span>}</span>
    </div>
  )
}

function Row({ k, v, strong, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: small ? 13 : 14, color: small ? '#3A3935' : C.ink, position: 'relative' }}>
      <span style={{ color: small ? '#3A3935' : C.sub }}>{k}</span>
      <span style={{ fontWeight: strong ? 700 : small ? 400 : 500, fontSize: strong ? 21 : undefined, textAlign: 'right' }}>{v}</span>
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 12.5, color: C.sub, margin: '18px 0 8px' }}>{children}</div>
}

function Field({ label, children }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#3A3935' }}>{label}{children}</label>
}

function Legend({ fill, border, t }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: fill, border: border ? `1px solid ${border}` : 'none' }} />{t}</span>
}

function Blob({ style }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 300 330" style={style}>
      <path d="M150 18c52-8 96 22 102 70 5 38-26 58-22 94 4 34 50 52 44 92-7 46-62 62-112 54-48-8-66-44-104-62C24 248-4 214 8 170c12-42 56-52 62-90 6-36 34-56 80-62z" fill={C.lime} />
    </svg>
  )
}

// ── 스타일·도우미 ───────────────────────────────────────────
const reset = { all: 'unset', boxSizing: 'border-box', fontFamily: FONT, color: C.ink }
const kicker = { fontSize: 12, fontWeight: 500, letterSpacing: '0.14em', color: C.olive }
const input = { height: 48, boxSizing: 'border-box', border: `1px solid ${C.line2}`, borderRadius: 12, padding: '0 14px', fontSize: 15, fontFamily: FONT, color: C.ink, background: C.white, width: '100%' }
const primaryBase = { ...reset, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 56, borderRadius: 14, fontSize: 16, fontWeight: 500 }
const primary = on => ({ ...primaryBase, background: on ? C.ink : C.line, color: on ? C.white : C.faint, cursor: on ? 'pointer' : 'default' })
const choice = on => ({ ...reset, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, width: '100%', padding: '16px 18px', borderRadius: 16, textAlign: 'left', cursor: 'pointer',
  background: on ? C.lime : C.white, border: on ? `1.5px solid ${C.ink}` : `1.5px solid ${C.line}` })
const tag = dark => ({ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, ...(dark ? { background: C.ink, color: C.white } : { background: C.white, color: C.ink, border: `1px solid ${C.ink}` }) })
const splitList = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean)
function fmtDate(s) {
  if (!s) return '-'
  const d = parseYmd(s)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`
}
