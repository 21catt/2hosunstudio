'use client'
import { useState, useEffect } from 'react'
import { submitGameScore } from '../lib/gameScore'

// 조색 게임 — 목표색을 3원색(물감식 감산 혼합)으로 맞추는 미니게임. 냥밭 진입.
// 근접도는 제출해야 공개(눈으로 판단 → 색감 훈련). 5라운드 총점, 최고점 localStorage 기록.
// 스킨 = 다크 네온(게임 모달 자체 스킨, 앱 8색 테마와 무관).

// 물감식(감산) 3원색 세트 — refl = 각 물감이 반사하는 [R,G,B] 비율
const RYB = [
  { key: 'r', name: '빨강', hex: '#D21E2B', refl: [0.85, 0.10, 0.10] },
  { key: 'y', name: '노랑', hex: '#F3E01E', refl: [0.95, 0.90, 0.10] },
  { key: 'b', name: '파랑', hex: '#185FA5', refl: [0.10, 0.30, 0.80] },
]
// CMY — 인쇄식 감산 3원색(마젠타·시안·레몬옐로우). 빨·노·파 관례와 혼합 결과가 달라 난이도.
const CMY = [
  { key: 'm', name: '마젠타', hex: '#D6197D', refl: [0.90, 0.10, 0.62] },
  { key: 'c', name: '시안', hex: '#12A9C6', refl: [0.10, 0.72, 0.86] },
  { key: 'l', name: '레몬옐로우', hex: '#EBE83A', refl: [0.86, 0.93, 0.10] },
]
const WHITE = { key: 'w', name: '화이트', hex: '#ffffff' }
const BLACK = { key: 'k', name: '블랙', hex: '#222222' }
// 난이도: 3원색만 / 3원색+흑백(명도 조절) / CMY+흑백
const LEVELS = [
  { id: 'ryb', name: '기본', pig: RYB, bw: false, tag: '빨·노·파 3원색' },
  { id: 'rybbw', name: '흑백', pig: RYB, bw: true, tag: '빨·노·파 + 화이트·블랙' },
  { id: 'cmybw', name: 'CMY', pig: CMY, bw: true, tag: '마젠타·시안·레몬옐로우 + 흑백' },
]
const channelsOf = lvl => (lvl.bw ? [...lvl.pig, WHITE, BLACK] : lvl.pig)
const zeroAmounts = lvl => Object.fromEntries(channelsOf(lvl).map(p => [p.key, 0]))
const ROUNDS = 5
const BEST_KEY = '2hs_colormix_best'
// 배경 = 중성 회색(≈18% 그레이) — 색이 가장 정확히 보이는 무채색 바탕
const U = {
  bg: '#6e6e6e', panel: '#7c7c7c', line: 'rgba(0,0,0,0.2)', track: 'rgba(0,0,0,0.25)',
  tx: '#ffffff', tx2: '#efefef', mut: '#dadada', faint: '#c2c2c2', dim: 'rgba(255,255,255,0.32)',
  grad: 'linear-gradient(135deg,#A3E635,#22D3AA)', acc: '#dcff7a', onAcc: '#243208',
  glow: '0 8px 20px -6px rgba(90,200,120,0.5)',
}

function mixWith(a, lvl) { // a: 물감별 양 0..1 → [R,G,B] 0..255 (곱셈식 감산 + 흑백 틴트/셰이드)
  const chan = i => 255 * lvl.pig.reduce((acc, p) => acc * (1 - (a[p.key] || 0) * (1 - p.refl[i])), 1)
  let out = [chan(0), chan(1), chan(2)]
  if (lvl.bw) {
    const w = a.w || 0, k = a.k || 0
    out = out.map(v => v + (255 - v) * w) // 화이트 = 밝게(틴트)
    out = out.map(v => v * (1 - k))       // 블랙 = 어둡게(셰이드)
  }
  return out.map(v => Math.round(Math.max(0, Math.min(255, v))))
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

function randomTarget(round, rnd, lvl) {
  const amt = () => Math.round((0.15 + rnd() * 0.85) * 100) / 100
  const a = {}
  const keys = lvl.pig.map(p => p.key)
  keys.forEach(k => { a[k] = amt() })
  if (round <= 2) { const drop = keys[Math.floor(rnd() * keys.length)]; a[drop] = rnd() * 0.15 }
  else if (round === 3) { const drop = keys[Math.floor(rnd() * keys.length)]; a[drop] *= 0.5 }
  if (lvl.bw) {
    // 흑백은 가끔·소량만(항상 크게 섞이면 탁해짐) — 라운드 오를수록 등장 확률↑
    a.w = rnd() < (round >= 2 ? 0.6 : 0.35) ? Math.round(rnd() * 0.6 * 100) / 100 : 0
    a.k = rnd() < (round >= 3 ? 0.5 : 0.25) ? Math.round(rnd() * 0.45 * 100) / 100 : 0
    if (a.w > 0.2 && a.k > 0.2) { if (rnd() < 0.5) a.w *= 0.4; else a.k *= 0.4 } // 둘 다 크면 회색 → 하나 줄임
  }
  return mixWith(a, lvl)
}

export default function ColorMixGame({ open, onClose }) {
  const [phase, setPhase] = useState('play') // play | result | done
  const [round, setRound] = useState(1)
  const [diff, setDiff] = useState(0)        // 난이도 인덱스(LEVELS)
  const [amounts, setAmounts] = useState(() => zeroAmounts(LEVELS[0]))
  const [target, setTarget] = useState([200, 200, 200])
  const [scores, setScores] = useState([])
  const [best, setBest] = useState(0)
  const [lastAcc, setLastAcc] = useState(0)
  const lvl = LEVELS[diff]

  useEffect(() => {
    if (!open) return
    try { setBest(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0) } catch {}
    startNew()
  }, [open])

  function startNew(level = diff) {
    const l = LEVELS[level]
    setDiff(level)
    setPhase('play'); setRound(1); setScores([])
    setAmounts(zeroAmounts(l))
    setTarget(randomTarget(1, Math.random, l))
  }
  function submit() {
    const acc = accuracyOf(mixWith(amounts, lvl), target)
    setLastAcc(acc)
    setScores(prev => [...prev, acc])
    setPhase('result')
  }
  function next() {
    if (round >= ROUNDS) {
      const total = scores.reduce((s, v) => s + v, 0)
      if (total > best) { setBest(total); try { localStorage.setItem(BEST_KEY, String(total)) } catch {} }
      submitGameScore('colormix', total) // 리더보드 제출(본인 최고점만)
      setPhase('done')
      return
    }
    const nr = round + 1
    setRound(nr)
    setAmounts(zeroAmounts(lvl))
    setTarget(randomTarget(nr, Math.random, lvl))
    setPhase('play')
  }

  if (!open) return null

  const mine = mixWith(amounts, lvl)
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
            {/* 난이도 선택 — 바꾸면 새 판 시작 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {LEVELS.map((l, i) => {
                const on = diff === i
                return (
                  <button key={l.id} onClick={() => startNew(i)}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 12, cursor: 'pointer', fontFamily: 'Nunito,sans-serif',
                      border: on ? `1.5px solid ${U.acc}` : `1px solid ${U.line}`, background: on ? 'rgba(220,255,122,0.14)' : U.panel,
                      color: on ? U.acc : U.mut, fontSize: 11, fontWeight: 900 }}>{l.name}</button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: U.faint, letterSpacing: 1, marginBottom: 5 }}>TARGET</div>
                <div style={{ height: 80, borderRadius: 16, background: css(target), boxShadow: '0 2px 6px rgba(0,0,0,0.22)', border: '1px solid rgba(0,0,0,0.12)' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: U.faint, letterSpacing: 1, marginBottom: 5 }}>YOURS</div>
                <div style={{ height: 80, borderRadius: 16, background: css(mine), boxShadow: '0 2px 6px rgba(0,0,0,0.22)', border: '1px solid rgba(0,0,0,0.12)', transition: 'background 0.15s' }} />
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
              {channelsOf(lvl).map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: p.hex, flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.3)', border: p.key === 'w' ? '1px solid rgba(0,0,0,0.28)' : 'none' }} />
                  <span style={{ width: 42, flexShrink: 0, fontSize: 11, fontWeight: 800, color: U.tx2 }}>{p.name}</span>
                  <input type="range" min="0" max="100" value={Math.round((amounts[p.key] || 0) * 100)} disabled={phase === 'result'}
                    onChange={e => setAmounts(a => ({ ...a, [p.key]: (+e.target.value) / 100 }))}
                    style={{ flex: 1, accentColor: p.key === 'w' ? '#d8d8d8' : p.key === 'k' ? '#333' : p.hex }} />
                  <span style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 10.5, fontWeight: 900, color: U.mut, fontVariantNumeric: 'tabular-nums' }}>{Math.round((amounts[p.key] || 0) * 100)}%</span>
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
              {lvl.tag} · {lvl.bw ? '화이트=밝게, 블랙=어둡게 · ' : ''}목표색에 가깝게 섞어 제출!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
