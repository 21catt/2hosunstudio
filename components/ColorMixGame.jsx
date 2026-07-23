'use client'
import { useState, useEffect } from 'react'

// 조색 게임 — 목표색을 3원색(물감식 감산 혼합)으로 맞추는 미니게임. 냥밭 진입.
// 근접도는 제출해야 공개(눈으로 판단 → 색감 훈련). 5라운드 총점, 최고점 localStorage 기록.
// 스킨 = 다크 네온(게임 모달 자체 스킨, 앱 8색 테마와 무관).

const PIGMENTS = [
  { key: 'r', name: '빨강', hex: '#D21E2B', refl: [0.85, 0.10, 0.10] },
  { key: 'y', name: '노랑', hex: '#F3E01E', refl: [0.95, 0.90, 0.10] },
  { key: 'b', name: '파랑', hex: '#185FA5', refl: [0.10, 0.30, 0.80] },
]
const ROUNDS = 5
const BEST_KEY = '2hs_colormix_best'
const U = {
  bg: '#13151d', panel: '#1b1e28', line: '#262a37', track: '#2a2d3a',
  tx: '#f4f5fa', tx2: '#c9ccd6', mut: '#8a8f9e', faint: '#6b7080', dim: '#3a3d4a',
  grad: 'linear-gradient(135deg,#A3E635,#22D3AA)', acc: '#A3E635', onAcc: '#0c1a12',
  glow: '0 8px 20px -6px rgba(90,200,120,0.55)',
}

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

function randomTarget(round, rnd) {
  const amt = () => Math.round((0.15 + rnd() * 0.85) * 100) / 100
  const a = { r: amt(), y: amt(), b: amt() }
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
  const gradText = { background: U.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
  const bigBtn = { width: '100%', padding: '14px', background: U.grad, color: U.onAcc, border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: U.glow }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,12,0.72)', zIndex: 1300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: U.bg, width: '100%', maxWidth: 400, borderRadius: '26px 26px 0 0', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 -20px 50px -20px rgba(0,0,0,0.6)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, background: U.grad }} />
            <span style={{ fontSize: 16, fontWeight: 900, color: U.tx, letterSpacing: '-0.3px' }}>조색 게임</span>
            {phase !== 'done' && <span style={{ fontSize: 10, fontWeight: 800, color: U.onAcc, background: U.acc, borderRadius: 20, padding: '2px 9px' }}>R.{round}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: U.faint, letterSpacing: 1 }}>BEST</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: U.mut, lineHeight: 1 }}>{best}</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${U.line}`, background: U.panel, color: U.mut, fontWeight: 900, fontSize: 13, cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        </div>

        {phase === 'done' ? (
          <div style={{ padding: '22px 22px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>{total >= ROUNDS * 90 ? '🏆' : total >= ROUNDS * 75 ? '🎉' : '🐾'}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: U.faint, letterSpacing: 1, margin: '8px 0 2px' }}>TOTAL SCORE</div>
            <div style={{ fontSize: 34, fontWeight: 900, ...gradText, lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 12, color: U.mut, fontWeight: 700, margin: '6px 0 3px' }}>/ {ROUNDS * 100} · 평균 {Math.round(total / ROUNDS)}%</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: U.acc, marginBottom: 18 }}>{total >= best ? '🎊 최고 기록 갱신!' : `최고 ${best}점`}</div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '13px', background: U.panel, color: U.tx2, border: `1px solid ${U.line}`, borderRadius: 15, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>닫기</button>
              <button onClick={startNew} style={{ flex: 1.6, padding: '13px', background: U.grad, color: U.onAcc, border: 'none', borderRadius: 15, fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: U.glow }}>다시하기 🔁</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '6px 16px 22px' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: U.faint, letterSpacing: 1, marginBottom: 5 }}>TARGET</div>
                <div style={{ height: 80, borderRadius: 16, background: css(target), boxShadow: `0 0 22px -4px ${css(target)}`, border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: U.faint, letterSpacing: 1, marginBottom: 5 }}>YOURS</div>
                <div style={{ height: 80, borderRadius: 16, background: css(mine), boxShadow: `0 0 22px -4px ${css(mine)}`, border: '1px solid rgba(255,255,255,0.08)', transition: 'background 0.15s, box-shadow 0.15s' }} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: U.mut, letterSpacing: 0.5 }}>근접도</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: phase === 'result' ? U.acc : U.faint }}>{phase === 'result' ? `${lastAcc}%` : '??'}</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: U.track, overflow: 'hidden' }}>
                <div style={{ width: `${phase === 'result' ? lastAcc : 0}%`, height: '100%', borderRadius: 6, background: U.grad, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <div style={{ background: U.panel, border: `1px solid ${U.line}`, borderRadius: 16, padding: '14px 13px', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14, opacity: phase === 'result' ? 0.6 : 1 }}>
              {PIGMENTS.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: p.hex, flexShrink: 0, boxShadow: `0 0 10px -1px ${p.hex}` }} />
                  <span style={{ width: 28, flexShrink: 0, fontSize: 11, fontWeight: 800, color: U.tx2 }}>{p.name}</span>
                  <input type="range" min="0" max="100" value={Math.round(amounts[p.key] * 100)} disabled={phase === 'result'}
                    onChange={e => setAmounts(a => ({ ...a, [p.key]: (+e.target.value) / 100 }))}
                    style={{ flex: 1, accentColor: p.hex }} />
                  <span style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 10.5, fontWeight: 900, color: U.mut, fontVariantNumeric: 'tabular-nums' }}>{Math.round(amounts[p.key] * 100)}%</span>
                </div>
              ))}
            </div>

            {phase === 'play' ? (
              <button onClick={submit} style={bigBtn}>제출하고 채점 →</button>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: U.panel, border: `1px solid ${U.line}`, borderRadius: 16, padding: '14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 26, letterSpacing: 3, color: U.acc }}>{'★'.repeat(starsOf(lastAcc))}<span style={{ color: U.dim }}>{'★'.repeat(3 - starsOf(lastAcc))}</span></div>
                  <div style={{ fontSize: 24, fontWeight: 900, ...gradText, marginTop: 2 }}>{lastAcc}%</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: U.mut, marginTop: 2 }}>
                    {lastAcc >= 95 ? '완벽에 가까워요! 🎯' : lastAcc >= 85 ? '아주 근접했어요!' : lastAcc >= 70 ? '비슷해요, 조금만 더!' : '더 연습해봐요 🐾'}
                  </div>
                </div>
                <button onClick={next} style={bigBtn}>{round >= ROUNDS ? '결과 보기' : '다음 라운드 →'}</button>
              </div>
            )}

            <div style={{ fontSize: 10, color: U.faint, fontWeight: 700, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              세 물감을 섞어 목표색에 가깝게 · 눈으로 판단하고 제출!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
