'use client'
// 관리자 — 자리 대관. 들어온 신청을 확정·취소하고, /rental 에 보이는 문구·가격·안내를 고친다.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { HEADER_BG } from '../../../lib/adminTheme'
import { loadRentalSettings, saveRentalSettings, mergeRental, RENTAL_STATUS, pad2, won } from '../../../lib/rental'

export default function AdminRentalPage() {
  const router = useRouter()
  const [tab, setTab] = useState('requests')
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState(() => mergeRental(null))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)
  const [reqs, setReqs] = useState([])
  const [filter, setFilter] = useState('open')
  const [today] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10))

  async function loadRequests() {
    const { data, error } = await supabase.from('rental_requests').select('*')
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
    if (error) { setMissing(true); return }
    setReqs(data || [])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/login'); return }
      const [{ config, error }] = await Promise.all([loadRentalSettings(), loadRequests()])
      if (error) setMissing(true)
      setCfg(config)
      setLoading(false)
    })
  }, [])

  async function setStatus(r, status) {
    if (status === 'cancelled' && !confirm(`${r.name}님 신청을 취소할까요? 자리가 다시 열려요.`)) return
    const { error } = await supabase.from('rental_requests').update({ status }).eq('id', r.id)
    if (error) { alert('바꾸지 못했어요: ' + error.message); return }
    setReqs(prev => prev.map(x => x.id === r.id ? { ...x, status } : x))
  }

  // ── 설정 편집 ──
  function upd(path, value) {
    setCfg(prev => {
      const next = structuredClone(prev)
      const keys = path.split('.')
      let o = next
      keys.slice(0, -1).forEach(k => { o = o[k] })
      o[keys.at(-1)] = value
      return next
    })
    setDirty(true)
  }
  async function save() {
    setSaving(true)
    // 빈 줄·빈 항목은 저장하지 않는다
    const clean = structuredClone(cfg)
    for (const k of ['short', 'long', 'cats']) clean[k].rules = (clean[k].rules || []).map(x => x.trim()).filter(Boolean)
    clean.media = clean.media.filter(m => m.name.trim())
    clean.long.rentals = clean.long.rentals.filter(r => r.name.trim())
    const { error } = await saveRentalSettings(clean)
    setSaving(false)
    if (error) { alert('저장하지 못했어요: ' + error.message + '\n\nmigration-rental.sql 을 먼저 실행했는지 확인해 주세요.'); return }
    setCfg(clean)
    setDirty(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 32 }}>🐱</div>

  const shown = reqs.filter(r =>
    filter === 'all' ? true
      : filter === 'pending' ? r.status === 'pending'
      : r.status !== 'cancelled' && (r.end_date || r.date) >= today)
  const pendingCnt = reqs.filter(r => r.status === 'pending').length

  return (
    <>
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span onClick={() => router.push('/admin')} style={{ fontSize: 20, fontWeight: 900, color: '#fff', cursor: 'pointer', lineHeight: 1 }} title="홈">‹</span>
          <span className="header-title">자리 대관</span>
        </div>
      </div>

      <div style={{ background: 'var(--page)', borderRadius: '24px 24px 0 0', marginTop: -8, padding: '16px 16px 120px', minHeight: '80vh' }}>
        <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 12 }}>
          누구나 로그인 없이 <b>/rental</b> 에서 신청해요.
          <span onClick={() => window.open('/rental', '_blank')} style={{ color: 'var(--ac)', fontWeight: 800, cursor: 'pointer', marginLeft: 6 }}>신청 페이지 열기 ↗</span>
          <span onClick={() => navigator.clipboard?.writeText('https://2hosunstudio.vercel.app/rental').then(() => alert('링크를 복사했어요'))} style={{ color: 'var(--ac)', fontWeight: 800, cursor: 'pointer', marginLeft: 10 }}>링크 복사</span>
        </div>

        {missing && (
          <div className="p-card" style={{ padding: 14, marginBottom: 14, border: '1.5px solid #D98A2B', fontSize: 13, lineHeight: 1.6 }}>
            ⚠️ 아직 저장 공간이 없어요. Supabase SQL Editor 에서 <b>migration-rental.sql</b> 을 한 번 실행해 주세요.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--g1)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {[['requests', `신청${pendingCnt ? ` · 대기 ${pendingCnt}` : ''}`], ['settings', '안내 · 가격 설정']].map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 0', borderRadius: 9, border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
              background: tab === k ? 'var(--surf)' : 'transparent', color: tab === k ? 'var(--td)' : 'var(--tm)' }}>{t}</button>
          ))}
        </div>

        {tab === 'requests' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[['open', '다가오는'], ['pending', '입금 대기'], ['all', '전체']].map(([k, t]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ ...chip, background: filter === k ? 'var(--ac)' : 'var(--surf)', color: filter === k ? '#fff' : 'var(--td)' }}>{t}</button>
              ))}
            </div>
            {shown.length === 0 && <div style={{ textAlign: 'center', color: 'var(--tmu)', fontSize: 13, padding: '40px 0' }}>신청이 없어요.</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              {shown.map(r => {
                const st = RENTAL_STATUS[r.status] || RENTAL_STATUS.pending
                const when = r.plan === 'hour'
                  ? `${r.date} · ${pad2(r.start_hour)}:00–${pad2(r.start_hour + r.hours)}:00 (${r.hours}시간)`
                  : `${r.date} ~ ${r.end_date}`
                return (
                  <div key={r.id} className="p-card" style={{ padding: 14, opacity: r.status === 'cancelled' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--td)' }}>{r.name}</div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 10, color: st.color, background: st.bg }}>{st.label}</span>
                    </div>
                    <a href={`tel:${r.phone}`} style={{ fontSize: 13, color: 'var(--ac)', fontWeight: 700, textDecoration: 'none' }}>{r.phone}</a>
                    <div style={{ fontSize: 13, color: 'var(--td)', lineHeight: 1.65, marginTop: 6 }}>
                      <div>{r.plan === 'hour' ? '시간 이용' : r.plan === 'week' ? '주 이용' : '월 이용'} · {r.medium || '작업 미선택'}{r.seat ? ` · ${r.seat}자리` : ''}</div>
                      <div>{when}</div>
                      {r.rentals?.length > 0 && <div>대여: {r.rentals.map(x => x.name).join(', ')}</div>}
                      <div style={{ fontWeight: 800 }}>{r.amount ? won(r.amount) : '금액 협의'}</div>
                      {r.memo && <div style={{ color: 'var(--tm)' }}>메모: {r.memo}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {r.status !== 'confirmed' && <button onClick={() => setStatus(r, 'confirmed')} style={{ ...smallBtn, background: 'var(--ac)', color: '#fff', border: 'none' }}>입금 확인 · 확정</button>}
                      {r.status === 'confirmed' && <button onClick={() => setStatus(r, 'pending')} style={smallBtn}>대기로</button>}
                      {r.status !== 'cancelled' && <button onClick={() => setStatus(r, 'cancelled')} style={{ ...smallBtn, color: '#c0392b', marginLeft: 'auto' }}>취소</button>}
                      {r.status === 'cancelled' && <button onClick={() => setStatus(r, 'pending')} style={smallBtn}>되살리기</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'settings' && (
          <>
            <Title>⏰ 운영 시간</Title>
            <Card>
              <Pair>
                <Num label="여는 시각" value={cfg.open_hour} onChange={v => upd('open_hour', v)} unit="시" />
                <Num label="닫는 시각" value={cfg.close_hour} onChange={v => upd('close_hour', v)} unit="시" />
              </Pair>
              <Num label="한 번에 최대 이용 시간" value={cfg.max_hours} onChange={v => upd('max_hours', v)} unit="시간" />
              <Text label="그 외 시간 안내" value={cfg.hours_note} onChange={v => upd('hours_note', v)} />
            </Card>

            <Title>💰 시간 요금 (1시간)</Title>
            <Card>
              <Pair>
                <Num label="평일 낮" value={cfg.rates.weekday_day} onChange={v => upd('rates.weekday_day', v)} unit="원" />
                <Num label="평일 저녁" value={cfg.rates.weekday_evening} onChange={v => upd('rates.weekday_evening', v)} unit="원" />
              </Pair>
              <Pair>
                <Num label="저녁 요금 시작" value={cfg.rates.evening_from} onChange={v => upd('rates.evening_from', v)} unit="시부터" />
                <Num label="주말" value={cfg.rates.weekend} onChange={v => upd('rates.weekend', v)} unit="원" />
              </Pair>
            </Card>

            <Title>🗓 주 · 월 이용권</Title>
            <Card>
              {['week', 'month'].map(k => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <Pair>
                    <Text label="이름" value={cfg.plans[k].label} onChange={v => upd(`plans.${k}.label`, v)} />
                    <Num label="가격 (0 = 문의)" value={cfg.plans[k].price} onChange={v => upd(`plans.${k}.price`, v)} unit="원" />
                  </Pair>
                  <Text label="설명" value={cfg.plans[k].note} onChange={v => upd(`plans.${k}.note`, v)} />
                </div>
              ))}
            </Card>

            <Title>🎨 작업 종류</Title>
            <Card>
              <Hint>추천 자리는 A~E 를 쉼표로 (비우면 어느 자리든)</Hint>
              {cfg.media.map((m, i) => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 0.7fr auto', gap: 6, marginBottom: 6 }}>
                  <input value={m.name} onChange={e => upd('media', cfg.media.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="이름" style={input} />
                  <input value={m.note} onChange={e => upd('media', cfg.media.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="설명" style={input} />
                  <input value={m.seats} onChange={e => upd('media', cfg.media.map((x, j) => j === i ? { ...x, seats: e.target.value.toUpperCase() } : x))} placeholder="A,B" style={input} />
                  <button onClick={() => upd('media', cfg.media.filter((_, j) => j !== i))} style={{ ...smallBtn, color: '#c0392b' }} aria-label={`${m.name} 삭제`}>✕</button>
                </div>
              ))}
              <button onClick={() => upd('media', [...cfg.media, { id: `m${Date.now()}`, name: '', note: '', seats: '' }])} style={addBtn}>＋ 작업 추가</button>
            </Card>

            <Title>⚡ 단기(시간) 이용</Title>
            <Card>
              <Text label="가져올 것 (쉼표로)" value={cfg.short.bring} onChange={v => upd('short.bring', v)} />
              <Text label="스튜디오 것 사용 가능 (쉼표로)" value={cfg.short.provided} onChange={v => upd('short.provided', v)} />
              <Lines label="유의사항 (한 줄에 하나)" value={cfg.short.rules} onChange={v => upd('short.rules', v)} />
            </Card>

            <Title>📦 장기(주·월) 이용</Title>
            <Card>
              <Text label="개인 준비물" value={cfg.long.bring} onChange={v => upd('long.bring', v)} />
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--td)', margin: '4px 0 6px' }}>대여 품목 · 추가 비용 (0 = 문의)</div>
              {cfg.long.rentals.map((r, i) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr auto', gap: 6, marginBottom: 6 }}>
                  <input value={r.name} onChange={e => upd('long.rentals', cfg.long.rentals.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={input} />
                  <input type="number" inputMode="numeric" value={r.price} onChange={e => upd('long.rentals', cfg.long.rentals.map((x, j) => j === i ? { ...x, price: Number(e.target.value) || 0 } : x))} style={input} />
                  <button onClick={() => upd('long.rentals', cfg.long.rentals.filter((_, j) => j !== i))} style={{ ...smallBtn, color: '#c0392b' }} aria-label={`${r.name} 삭제`}>✕</button>
                </div>
              ))}
              <button onClick={() => upd('long.rentals', [...cfg.long.rentals, { id: `r${Date.now()}`, name: '', price: 0 }])} style={addBtn}>＋ 대여 품목 추가</button>
              <div style={{ height: 12 }} />
              <Lines label="유의사항 (한 줄에 하나)" value={cfg.long.rules} onChange={v => upd('long.rules', v)} />
            </Card>

            <Title>🐈 작업실 고양이</Title>
            <Card>
              <Pair>
                {[0, 1, 2].map(i => (
                  <Text key={i} label={`${i + 1}번 이름`} value={cfg.cats.names[i] || ''} onChange={v => upd('cats.names', [0, 1, 2].map(j => j === i ? v : (cfg.cats.names[j] || '')))} />
                ))}
              </Pair>
              <Area label="알레르기 안내" value={cfg.cats.allergy} onChange={v => upd('cats.allergy', v)} />
              <Lines label="주의사항 (한 줄에 하나)" value={cfg.cats.rules} onChange={v => upd('cats.rules', v)} />
              <Area label="덧붙임" value={cfg.cats.footnote} onChange={v => upd('cats.footnote', v)} />
            </Card>

            <Title>🏦 입금 안내</Title>
            <Card>
              <Pair>
                <Text label="은행" value={cfg.deposit.bank} onChange={v => upd('deposit.bank', v)} />
                <Text label="예금주" value={cfg.deposit.holder} onChange={v => upd('deposit.holder', v)} />
              </Pair>
              <Text label="계좌번호" value={cfg.deposit.account} onChange={v => upd('deposit.account', v)} />
              <Area label="입금 안내 문구" value={cfg.deposit_note} onChange={v => upd('deposit_note', v)} />
            </Card>
          </>
        )}
      </div>

      {tab === 'settings' && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390, padding: '10px 16px 20px', background: 'linear-gradient(transparent, var(--page) 35%)' }}>
          <button onClick={save} disabled={!dirty || saving}
            style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 900, fontFamily: 'inherit',
              background: dirty ? 'var(--ac)' : 'var(--g1)', color: dirty ? '#fff' : 'var(--tmu)', cursor: dirty ? 'pointer' : 'default' }}>
            {saving ? '저장 중…' : dirty ? '저장하기' : '저장됨'}
          </button>
        </div>
      )}
    </>
  )
}

function Title({ children }) { return <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--td)', margin: '0 2px 8px' }}>{children}</div> }
function Card({ children }) { return <div className="p-card" style={{ padding: 14, marginBottom: 20 }}>{children}</div> }
function Hint({ children }) { return <div style={{ fontSize: 11, color: 'var(--tmu)', marginBottom: 8 }}>{children}</div> }
function Pair({ children }) { return <div style={{ display: 'flex', gap: 8 }}>{children}</div> }
function Lbl({ label, children }) {
  return <label style={{ display: 'block', flex: 1, minWidth: 0, marginBottom: 10 }}><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--td)', marginBottom: 6 }}>{label}</div>{children}</label>
}
function Text({ label, value, onChange }) { return <Lbl label={label}><input value={value ?? ''} onChange={e => onChange(e.target.value)} style={input} /></Lbl> }
function Area({ label, value, onChange }) { return <Lbl label={label}><textarea value={value ?? ''} onChange={e => onChange(e.target.value)} rows={2} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} /></Lbl> }
function Num({ label, value, onChange, unit }) {
  return (
    <Lbl label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" inputMode="numeric" value={value ?? 0} onChange={e => onChange(Number(e.target.value) || 0)} style={input} />
        {unit && <span style={{ fontSize: 12, color: 'var(--tm)', flexShrink: 0 }}>{unit}</span>}
      </div>
    </Lbl>
  )
}
// 한 줄에 하나 — 편집 중엔 빈 줄을 살려 두고(줄 추가가 되게), 저장할 때 화면에서 빈 줄은 거른다
function Lines({ label, value, onChange }) {
  return <Lbl label={label}><textarea value={(value || []).join('\n')} onChange={e => onChange(e.target.value.split('\n'))} rows={Math.max(3, (value || []).length + 1)} style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} /></Lbl>
}

const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surf)', fontSize: 14, fontFamily: 'inherit', color: 'var(--td)', outline: 'none' }
const smallBtn = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surf)', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--td)' }
const chip = { padding: '7px 13px', borderRadius: 20, border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }
const addBtn = { width: '100%', padding: 10, borderRadius: 10, border: '1.5px dashed var(--g3)', background: 'transparent', color: 'var(--acTx)', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }
