'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

// 색채 테트리스 — 색상 블록과 명도(회색) 블록이 번갈아 내려온다.
// 색상 블록의 '밝기'에 맞는 명도 블록을 위·아래로 맞물리면(같은 밝기 레벨) 둘 다 사라진다.
// 밝기는 3레벨(어두움·중간·밝음). 꼭대기까지 차면 게임 오버. 점수/최고점 localStorage.
// 스킨 = 다크 네온(게임 모달 자체 스킨, 앱 8색 테마와 무관).

const COLS = 6, ROWS = 11, CELL = 30, GAP = 2, SPAWN = 2
const BEST_KEY = '2hs_colortetris_best'
const GRAY = ['#5b5b5b', '#8f8f8f', '#d0d0d0'] // 밝기 0(어두움)·1(중간)·2(밝음) 명도 블록
const HUES = [
  ['#1E3A5F', '#0F5147', '#5C2B2B', '#3A2E6B'], // 어두운 색
  ['#D21E2B', '#1D9E75', '#6A3B8F', '#D85A30'], // 중간 밝기 색
  ['#F3E01E', '#F5A7C4', '#96C6E8', '#B0C043'], // 밝은 색
]
const U = {
  bg: '#13151d', panel: '#1b1e28', board: '#16181f', empty: '#23262f', line: '#262a37',
  tx: '#f4f5fa', tx2: '#c9ccd6', mut: '#8a8f9e', faint: '#6b7080',
  grad: 'linear-gradient(135deg,#A3E635,#22D3AA)', acc: '#A3E635', onAcc: '#0c1a12',
  glow: '0 8px 20px -6px rgba(90,200,120,0.55)',
}
const makeBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null))
const rnd = n => Math.floor(Math.random() * n)

export default function ColorTetrisGame({ open, onClose }) {
  const boardRef = useRef(makeBoard())
  const fallRef = useRef(null)
  const overRef = useRef(false)
  const scoreRef = useRef(0)
  const speedRef = useRef(760)
  const timerRef = useRef(null)
  const [, force] = useState(0)
  const render = useCallback(() => force(n => n + 1), [])
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [best, setBest] = useState(0)

  const spawn = useCallback(() => {
    const kind = Math.random() < 0.5 ? 'color' : 'value'
    const level = rnd(3)
    const color = kind === 'color' ? HUES[level][rnd(HUES[level].length)] : GRAY[level]
    if (boardRef.current[0][SPAWN] != null) {
      overRef.current = true; setOver(true)
      setBest(b => { const nb = Math.max(b, scoreRef.current); try { localStorage.setItem(BEST_KEY, String(nb)) } catch {} return nb })
      return
    }
    fallRef.current = { col: SPAWN, row: 0, kind, level, color }
  }, [])

  const gravity = useCallback(() => {
    for (let c = 0; c < COLS; c++) {
      const stack = []
      for (let r = 0; r < ROWS; r++) if (boardRef.current[r][c]) stack.push(boardRef.current[r][c])
      for (let r = ROWS - 1, k = stack.length - 1; r >= 0; r--, k--) boardRef.current[r][c] = k >= 0 ? stack[k] : null
    }
  }, [])

  const resolve = useCallback(() => {
    let pairs = 0
    while (true) {
      const clear = new Set()
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS - 1; r++) {
        const a = boardRef.current[r][c], b = boardRef.current[r + 1][c]
        if (a && b && a.level === b.level && a.kind !== b.kind) { clear.add(r * COLS + c); clear.add((r + 1) * COLS + c) }
      }
      if (clear.size === 0) break
      clear.forEach(i => { boardRef.current[Math.floor(i / COLS)][i % COLS] = null })
      gravity()
      pairs += clear.size / 2
    }
    return pairs
  }, [gravity])

  const lockAndNext = useCallback(() => {
    const f = fallRef.current
    if (!f) { spawn(); return }
    boardRef.current[f.row][f.col] = { kind: f.kind, level: f.level, color: f.color }
    fallRef.current = null
    const pairs = resolve()
    if (pairs > 0) {
      scoreRef.current += pairs * 10 + (pairs - 1) * 5
      setScore(scoreRef.current)
      speedRef.current = Math.max(240, 760 - Math.floor(scoreRef.current / 120) * 45)
    }
    spawn()
  }, [resolve, spawn])

  const step = useCallback(() => {
    const f = fallRef.current
    if (!f) { spawn(); return }
    if (f.row + 1 < ROWS && boardRef.current[f.row + 1][f.col] == null) { f.row++; return }
    lockAndNext()
  }, [lockAndNext, spawn])

  const loop = useCallback(() => {
    if (overRef.current) return
    step(); render()
    timerRef.current = setTimeout(loop, speedRef.current)
  }, [step, render])

  const startGame = useCallback(() => {
    clearTimeout(timerRef.current)
    boardRef.current = makeBoard(); fallRef.current = null
    overRef.current = false; setOver(false)
    scoreRef.current = 0; setScore(0); speedRef.current = 760
    spawn(); render()
    timerRef.current = setTimeout(loop, speedRef.current)
  }, [spawn, render, loop])

  useEffect(() => {
    if (!open) { clearTimeout(timerRef.current); return }
    try { setBest(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0) } catch {}
    startGame()
    return () => clearTimeout(timerRef.current)
  }, [open]) // eslint-disable-line

  const moveH = useCallback(dx => {
    const f = fallRef.current; if (!f || overRef.current) return
    const nc = f.col + dx
    if (nc >= 0 && nc < COLS && boardRef.current[f.row][nc] == null) { f.col = nc; render() }
  }, [render])
  const hardDrop = useCallback(() => {
    const f = fallRef.current; if (!f || overRef.current) return
    while (f.row + 1 < ROWS && boardRef.current[f.row + 1][f.col] == null) f.row++
    lockAndNext(); render()
  }, [lockAndNext, render])

  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'ArrowLeft') moveH(-1)
      else if (e.key === 'ArrowRight') moveH(1)
      else if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); hardDrop() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, moveH, hardDrop])

  if (!open) return null
  const f = fallRef.current
  const sideBtn = { flex: 1, height: 46, borderRadius: 14, border: `1px solid ${U.line}`, background: U.panel, color: U.tx2, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito,sans-serif' }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,12,0.72)', zIndex: 1300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: U.bg, width: '100%', maxWidth: 400, borderRadius: '26px 26px 0 0', maxHeight: '94vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 -20px 50px -20px rgba(0,0,0,0.6)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#1D9E75 50%,#8f8f8f 50%)' }} />
            <span style={{ fontSize: 16, fontWeight: 900, color: U.tx, letterSpacing: '-0.3px' }}>색채 테트리스</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: U.faint, letterSpacing: 1 }}>SCORE</div>
              <div style={{ fontSize: 15, fontWeight: 900, background: U.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', lineHeight: 1 }}>{score}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: U.mut }}>최고 {best}</span>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${U.line}`, background: U.panel, color: U.mut, fontWeight: 900, fontSize: 13, cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '10px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS},${CELL}px)`, gap: GAP, background: U.board, padding: GAP + 2, borderRadius: 12, border: `1px solid ${U.line}` }}>
              {Array.from({ length: ROWS }).map((_, r) => Array.from({ length: COLS }).map((__, c) => {
                const isFall = f && f.row === r && f.col === c
                const cell = isFall ? { color: f.color } : boardRef.current[r][c]
                return <div key={`${r}-${c}`} style={{ width: CELL, height: CELL, borderRadius: 6, background: cell ? cell.color : U.empty, boxShadow: cell ? `inset 0 2px 0 rgba(255,255,255,0.22), 0 0 8px -2px ${cell.color}` : 'none' }} />
              }))}
            </div>

            {over && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,16,22,0.9)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}>
                <div style={{ fontSize: 34 }}>{score >= best && score > 0 ? '🏆' : '🐾'}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: U.tx }}>게임 오버</div>
                <div style={{ fontSize: 20, fontWeight: 900, background: U.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{score}</div>
                {score >= best && score > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: U.acc }}>최고 기록!</div>}
                <button onClick={startGame} style={{ marginTop: 6, padding: '11px 24px', background: U.grad, color: U.onAcc, border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: U.glow }}>다시하기 🔁</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, width: `${COLS * CELL + (COLS - 1) * GAP + 10}px`, maxWidth: '100%', marginTop: 14 }}>
            <button onClick={() => moveH(-1)} style={sideBtn} aria-label="왼쪽">◀</button>
            <button onClick={hardDrop} style={{ flex: 1.5, height: 46, borderRadius: 14, border: 'none', background: U.grad, color: U.onAcc, fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: U.glow }}>▼ 내리기</button>
            <button onClick={() => moveH(1)} style={sideBtn} aria-label="오른쪽">▶</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 10, fontWeight: 800, color: U.tx2 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: '#D85A30' }} /> +
            <span style={{ width: 14, height: 14, borderRadius: 4, background: '#8f8f8f' }} /> = 같은 밝기 → 사라짐
          </div>
          <div style={{ fontSize: 10, color: U.faint, fontWeight: 700, textAlign: 'center', marginTop: 6, lineHeight: 1.5 }}>
            색 블록의 밝기에 맞는 회색(명도) 블록을 위·아래로 맞물리세요
          </div>
        </div>
      </div>
    </div>
  )
}
