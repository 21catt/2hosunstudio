'use client'
import { useState, useEffect } from 'react'

// 조색 게임 — 목표색을 3원색(물감식 감산 혼합)으로 맞추는 미니게임. 냥밭 진입.
// 근접도는 제출해야 공개(눈으로 판단 → 색감 훈련). 5라운드 총점, 최고점 localStorage 기록.

const PIGMENTS = [
  { key: 'r', name: '빨강', hex: '#D21E2B', refl: [0.85, 0.10, 0.10] },
  { key: 'y', name: '노랑', hex: '#F3E01E', refl: [0.95, 0.90, 0.10] },
  { key: 'b', name: '파랑', hex: '#185FA5', refl: [0.10, 0.30, 0.80] },
]
const ROUNDS = 5
const BEST_KEY = '2hs_colormix_best'

function mix(a) { // a: {r,y,b} 0..1 → [R,G,B] 0..255 (곱셈식 감산)
  const chan = i => Math.round(255 * PIGMENTS.reduce((acc, p) => acc * (1 - a[p.key] * (1 - p.refl[i])), 1))
  return [chan(0), chan(1), chan(2)]
}
const css = ([r, g, b]) => `rgb(${r},${g},${b})`

function rgb2lab([r, g, b]) {
  let R = r / 255, G = g / 255, B = b / 255
  const f = v => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92)
  R = f(R); G = f(G); B = f(B)
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722)
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const g2 = v => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  X = g2(X); Y = g2(Y); Z = g2(Z)
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
}
function deltaE(c1, c2) {
  const [l1, a1, b1] = rgb2lab(c1), [l2, a2, b2] = rgb2lab(c2)
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
}
function accuracyOf(mine, target) {
  return Math.max(0, Math.round(100 - deltaE(mine, target) * 2))
}
function starsOf(acc) { return acc >= 95 ? 3 : acc >= 85 ? 2 : acc >= 70 ? 1 : 0 }

// 라운드 목표 — 3원색을 랜덤 배합해 만든 색(그 색을 만들 수 있음이 보장됨). 라운드↑ = 3색 모두 섞여 탁해짐
function randomTarget(round, rnd) {
  const hard = Math.min(1, round / ROUNDS)
  const amt = () => Math.round((0.15 + rnd() * 0.85) * 100) / 100
  const a = { r: amt(), y: amt(), b: amt() }
  // 초반엔 한 색을 죽여 선명하게, 후반엔 세 색 다 섞어 미묘하게
  if (round <= 2) { const drop = ['r', 'y', 'b'][Math.floor(rnd() * 3)]; a[drop] = rnd() * 0.15 }
  else if (round === 3) { const drop = ['r', 'y', 'b'][Math.floor(rnd() * 3)]; a[drop] *= 0.5 }
  return mix(a)
}

export default function ColorMixGame({ open, onClose }) {
  const [phase, setPhase] = useState('play') // play | result | done
  const [round, setRound] = useState(1)
  const [amounts, setAmounts] = useState({ r: 0, y: 0, b: 0 })
  const [target, setTarget] = useState([200, 200, 200])
  const [scores, setScores] = useState([])
  const [best, setBest] = useState(0)
  const [lastAcc, setLastAcc] = useState(0)

  useEffect(() => {
    if (!open) return
    try { setBest(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0) } catch {}
    startNew()
  }, [open])

  function startNew() {
    setPhase('play'); setRound(1); setScores([])
    setAmounts({ r: 0, y: 0, b: 0 })
    setTarget(randomTarget(1, Math.random))
  }
  function submit() {
    const acc = accuracyOf(mix(amounts), target)
    setLastAcc(acc)
    setScores(prev => [...prev, acc])
    setPhase('result')
  }
  function next() {
    if (round >= ROUNDS) {
      const total = scores.reduce((s, v) => s + v, 0)
      if (total > best) { setBest(total); try { localStorage.setItem(BEST_KEY, String(total)) } catch {} }
      setPhase('done')
      return
    }
    const nr = round + 1
    setRound(nr)
    setAmounts({ r: 0, y: 0, b: 0 })
    setTarget(randomTarget(nr, Math.random))
    setPhase('play')
  }

  if (!open) return null

  const mine = mix(amounts)
  const total = scores.reduce((s, v) => s + v, 0)
  const AC = 'var(--ac)', ACT = 'var(--acTx)', ACB = 'var(--acBg)'

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(27,28,70,0.55)', zIndex: 1300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: '26px 26px 0 0', border: `3px solid ${AC}`, borderBottom: 'none', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '2px dashed var(--g1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🎨</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--td)' }}>조색 게임</span>
            {phase !== 'done' && <span style={{ fontSize: 11, fontWeight: 800, color: ACT, background: ACB, borderRadius: 20, padding: '2px 9px' }}>{round} / {ROUNDS}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--tmu)' }}>최고 {best}</span>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--g1)', background: '#fff', color: 'var(--tmu)', fontWeight: 900, fontSize: 13, cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        </div>

        {phase === 'done' ? (
          <div style={{ padding: '26px 22px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>{total >= ROUNDS * 90 ? '🏆' : total >= ROUNDS * 75 ? '🎉' : '🐾'}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--td)', margin: '10px 0 4px' }}>총 {total}점 / {ROUNDS * 100}</div>
            <div style={{ fontSize: 12, color: 'var(--tm)', fontWeight: 600, marginBottom: 4 }}>평균 근접도 {Math.round(total / ROUNDS)}%</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: ACT, marginBottom: 18 }}>{total >= best ? '🎊 최고 기록 갱신!' : `최고 기록 ${best}점`}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--g1)', color: 'var(--g5)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>닫기</button>
              <button onClick={startNew} style={{ flex: 1.6, padding: '12px', background: AC, color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>다시하기 🔁</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '14px 16px 22px' }}>
            {/* 목표색 vs 내 조색 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tmu)', marginBottom: 4 }}>목표색</div>
                <div style={{ height: 78, borderRadius: 14, background: css(target), border: '2px solid rgba(0,0,0,0.06)' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tmu)', marginBottom: 4 }}>내 조색</div>
                <div style={{ height: 78, borderRadius: 14, background: css(mine), border: '2px solid rgba(0,0,0,0.06)', transition: 'background 0.15s' }} />
              </div>
            </div>

            {/* 3원색 슬라이더 */}
            <div style={{ background: 'var(--bg)', borderRadius: 14, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14, opacity: phase === 'result' ? 0.6 : 1 }}>
              {PIGMENTS.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: p.hex, flexShrink: 0, border: '1.5px solid rgba(0,0,0,0.08)' }} />
                  <span style={{ width: 28, flexShrink: 0, fontSize: 11, fontWeight: 800, color: 'var(--td)' }}>{p.name}</span>
                  <input type="range" min="0" max="100" value={Math.round(amounts[p.key] * 100)} disabled={phase === 'result'}
                    onChange={e => setAmounts(a => ({ ...a, [p.key]: (+e.target.value) / 100 }))}
                    style={{ flex: 1, accentColor: p.hex }} />
                  <span style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 10.5, fontWeight: 900, color: 'var(--tm)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(amounts[p.key] * 100)}%</span>
                </div>
              ))}
            </div>

            {phase === 'play' ? (
              <button onClick={submit}
                style={{ width: '100%', padding: '13px', background: AC, color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: '2.5px 2.5px 0 rgb(var(--ac-rgb) / 0.3)' }}>
                제출하고 채점 →
              </button>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: ACB, borderRadius: 16, padding: '14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 26, letterSpacing: 3 }}>{'★'.repeat(starsOf(lastAcc))}{'☆'.repeat(3 - starsOf(lastAcc))}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: ACT, marginTop: 2 }}>{lastAcc}%</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginTop: 2 }}>
                    {lastAcc >= 95 ? '완벽에 가까워요! 🎯' : lastAcc >= 85 ? '아주 근접했어요!' : lastAcc >= 70 ? '비슷해요, 조금만 더!' : '더 연습해봐요 🐾'}
                  </div>
                </div>
                <button onClick={next}
                  style={{ width: '100%', padding: '13px', background: AC, color: '#fff', border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>
                  {round >= ROUNDS ? '결과 보기' : '다음 라운드 →'}
                </button>
              </div>
            )}

            <div style={{ fontSize: 10, color: 'var(--tmu)', fontWeight: 700, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              세 물감을 섞어 목표색에 가깝게 · 눈으로 판단하고 제출!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
