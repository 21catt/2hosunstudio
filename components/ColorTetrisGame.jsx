'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { submitGameScore } from '../lib/gameScore'

// 색채 테트리스 — 색상 블록과 명도(회색) 블록이 번갈아 내려온다.
// 색상 블록의 '밝기'에 맞는 명도 블록을 위·아래로 맞물리면(같은 밝기 레벨) 둘 다 사라진다.
// 밝기는 3레벨(어두움·중간·밝음). 꼭대기까지 차면 게임 오버. 점수/최고점 localStorage.
// 스킨 = 다크 네온(게임 모달 자체 스킨, 앱 8색 테마와 무관).

const COLS = 6, ROWS = 11, CELL = 30, GAP = 2, SPAWN = 2
const BEST_KEY = '2hs_colortetris_best'
const GRAY = ['#5b5b5b', '#8f8f8f', '#d0d0d0'] // 명도(회색) 블록: 밝기 0·1·2
// 색 블록 = 고정 밝기(판단 학습). 같은 색끼리 3매치, 회색은 같은 밝기 색에 닿으면 덩어리 제거.
const COLORS = [
  { hex: '#185FA5', level: 0 }, { hex: '#6A3B8F', level: 0 }, // 어두움
  { hex: '#D21E2B', level: 1 }, { hex: '#1D9E75', level: 1 }, // 중간
  { hex: '#F3E01E', level: 2 }, { hex: '#F5A7C4', level: 2 }, // 밝음
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
    let level, color
    if (kind === 'color') { const cd = COLORS[rnd(COLORS.length)]; level = cd.level; color = cd.hex }
    else { level = rnd(3); color = GRAY[level] }
    if (boardRef.current[0][SPAWN] != null) {
      overRef.current = true; setOver(true)
      setBest(b => { const nb = Math.max(b, scoreRef.current); try { localStorage.setItem(BEST_KEY, String(nb)) } catch {} return nb })
      submitGameScore('colortetris', scoreRef.current) // 리더보드 제출(본인 최고점만)
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

  // 연결 규칙: 같은 색끼리 / 색↔같은밝기 회색 은 이어짐. 회색↔회색 은 안 이어짐.
  // 덩어리 제거 = (회색 1개 이상 + 색 1개 이상) 또는 (같은 색 3개 이상). 회색만 있는 덩어리는 안 사라짐.
  const resolve = useCallback(() => {
    let cleared = 0
    while (true) {
      const B = boardRef.current
      const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false))
      const toClear = new Set()
      const link = (a, b) => {
        if (a.kind === 'value' && b.kind === 'value') return false
        if (a.kind === 'color' && b.kind === 'color') return a.color === b.color
        const col = a.kind === 'color' ? a : b, val = a.kind === 'value' ? a : b
        return col.level === val.level
      }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!B[r][c] || seen[r][c]) continue
        const comp = []; const stack = [[r, c]]; seen[r][c] = true
        while (stack.length) {
          const [y, x] = stack.pop(); comp.push([y, x])
          for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ny = y + dy, nx = x + dx
            if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS || seen[ny][nx] || !B[ny][nx]) continue
            if (link(B[y][x], B[ny][nx])) { seen[ny][nx] = true; stack.push([ny, nx]) }
          }
        }
        let colors = 0, grays = 0
        for (const [y, x] of comp) { if (B[y][x].kind === 'color') colors++; else grays++ }
        if ((grays > 0 && colors > 0) || colors >= 3) comp.forEach(([y, x]) => toClear.add(y * COLS + x))
      }
      if (toClear.size === 0) break
      toClear.forEach(i => { B[Math.floor(i / COLS)][i % COLS] = null })
      gravity()
      cleared += toClear.size
    }
    return cleared
  }, [gravity])

  const lockAndNext = useCallback(() => {
    const f = fallRef.current
    if (!f) { spawn(); return }
    boardRef.current[f.row][f.col] = { kind: f.kind, level: f.level, color: f.color }
    fallRef.current = null
    const cells = resolve()
    if (cells > 0) {
      scoreRef.current += cells * 6
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

          <div style={{ width: `${COLS * CELL + (COLS - 1) * GAP + 10}px`, maxWidth: '100%', marginTop: 14, background: U.panel, border: `1px solid ${U.line}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 900, color: U.tx }}>🎯 규칙</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, color: U.tx2 }}>
              <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 13, height: 13, borderRadius: 3, background: '#D21E2B' }} />)}</span>
              <span>같은 색 <b style={{ color: U.acc }}>3개</b> 이어지면 사라짐</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, color: U.tx2 }}>
              <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}><span style={{ width: 13, height: 13, borderRadius: 3, background: '#1D9E75' }} /><span style={{ width: 13, height: 13, borderRadius: 3, background: '#8f8f8f', boxShadow: `0 0 0 1.5px ${U.acc}` }} /></span>
              <span>회색이 <b style={{ color: U.acc }}>같은 밝기</b> 색에 닿으면 이어진 덩어리 통째로 사라짐</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, color: U.mut }}>
              <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}><span style={{ width: 13, height: 13, borderRadius: 3, background: '#8f8f8f' }} /><span style={{ width: 13, height: 13, borderRadius: 3, background: '#8f8f8f' }} /></span>
              <span>회색끼리는 안 사라져요</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
