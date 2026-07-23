'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

// 색채 테트리스 — 색상 블록과 명도(회색) 블록이 번갈아 내려온다.
// 색상 블록의 '밝기'에 맞는 명도 블록을 위·아래로 맞물리면(같은 밝기 레벨) 둘 다 사라진다.
// 밝기는 3레벨(어두움·중간·밝음). 꼭대기까지 차면 게임 오버. 점수/최고점 localStorage.

const COLS = 6, ROWS = 11, CELL = 30, GAP = 2, SPAWN = 2
const BEST_KEY = '2hs_colortetris_best'
const GRAY = ['#4a4a4a', '#8a8a8a', '#cfcfcf'] // 밝기 0(어두움)·1(중간)·2(밝음) 명도 블록
const HUES = [
  ['#1E3A5F', '#0F5147', '#5C2B2B', '#3A2E6B'], // 어두운 색
  ['#D21E2B', '#1D9E75', '#6A3B8F', '#D85A30'], // 중간 밝기 색
  ['#F3E01E', '#F5A7C4', '#96C6E8', '#B0C043'], // 밝은 색
]
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
    if (boardRef.current[0][SPAWN] != null) { // 스폰 자리 막힘 = 게임 오버
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

  // 세로 인접(색상+명도, 같은 밝기) 쌍을 전부 제거 → 중력 → 연쇄 반복
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
      scoreRef.current += pairs * 10 + (pairs - 1) * 5 // 연쇄 보너스
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

  // 키보드(데스크톱 테스트)
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
  const AC = 'var(--ac)', ACT = 'var(--acTx)', ACB = 'var(--acBg)'
  const btn = { flex: 1, height: 46, borderRadius: 14, border: '2px solid var(--g2)', background: '#fff', color: 'var(--td)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito,sans-serif' }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(27,28,70,0.55)', zIndex: 1300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: '26px 26px 0 0', border: `3px solid ${AC}`, borderBottom: 'none', maxHeight: '94vh', overflowY: 'auto', boxSizing: 'border-box' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '2px dashed var(--g1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg,#1D9E75 50%,#7a7a7a 50%)' }} />
            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--td)' }}>색채 테트리스</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: ACT, background: ACB, borderRadius: 20, padding: '2px 9px' }}>{score}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--tmu)' }}>최고 {best}</span>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--g1)', background: '#fff', color: 'var(--tmu)', fontWeight: 900, fontSize: 13, cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS},${CELL}px)`, gap: GAP, background: '#eef0f4', padding: GAP, borderRadius: 10, border: '2px solid #e2e3ef' }}>
              {Array.from({ length: ROWS }).map((_, r) => Array.from({ length: COLS }).map((__, c) => {
                const isFall = f && f.row === r && f.col === c
                const cell = isFall ? { color: f.color } : boardRef.current[r][c]
                return <div key={`${r}-${c}`} style={{ width: CELL, height: CELL, borderRadius: 6, background: cell ? cell.color : '#e0e2ea', boxShadow: cell ? 'inset 0 2px 0 rgba(255,255,255,0.25)' : 'none' }} />
              }))}
            </div>

            {over && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.92)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{ fontSize: 34 }}>{score >= best && score > 0 ? '🏆' : '🐾'}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--td)' }}>게임 오버</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: ACT }}>{score}점 {score >= best && score > 0 ? '· 최고 기록!' : ''}</div>
                <button onClick={startGame} style={{ marginTop: 6, padding: '10px 22px', background: AC, color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>다시하기 🔁</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, width: `${COLS * CELL + (COLS - 1) * GAP + 8}px`, maxWidth: '100%', marginTop: 12 }}>
            <button onClick={() => moveH(-1)} style={btn} aria-label="왼쪽">◀</button>
            <button onClick={hardDrop} style={{ ...btn, flex: 1.4, background: ACB, borderColor: 'rgb(var(--ac-rgb) / 0.4)', color: ACT, fontWeight: 900, fontSize: 15 }}>▼ 내리기</button>
            <button onClick={() => moveH(1)} style={btn} aria-label="오른쪽">▶</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: 'var(--tm)' }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#D85A30' }} /> +
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#8a8a8a' }} /> = 같은 밝기 → 사라짐
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--tmu)', fontWeight: 700, textAlign: 'center', marginTop: 6, lineHeight: 1.5 }}>
            색 블록의 밝기에 맞는 회색(명도) 블록을 위·아래로 맞물리세요
          </div>
        </div>
      </div>
    </div>
  )
}
