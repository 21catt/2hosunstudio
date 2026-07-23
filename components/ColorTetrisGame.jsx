'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { submitGameScore } from '../lib/gameScore'

// 색채 테트리스 — 색상 블록과 명도(회색) 블록이 번갈아 내려온다.
// 색상 블록의 '밝기'에 맞는 명도 블록을 위·아래로 맞물리면(같은 밝기 레벨) 둘 다 사라진다.
// 밝기는 3레벨(어두움·중간·밝음). 꼭대기까지 차면 게임 오버. 점수/최고점 localStorage.
// 스킨 = 다크 네온(게임 모달 자체 스킨, 앱 8색 테마와 무관).

const COLS = 8, ROWS = 13, CELL = 27, GAP = 2, SPAWN = 3
const PAD = GAP + 3 // 보드 border+padding 오프셋(파티클 정렬용)
const BEST_KEY = '2hs_colortetris_best'
const GRAY = ['#5b5b5b', '#8f8f8f', '#d0d0d0'] // 명도(회색) 블록: 밝기 0·1·2
// 색 블록 = 고정 밝기(판단 학습). 같은 색끼리 3매치, 회색은 같은 밝기 색에 닿으면 덩어리 제거.
const COLORS = [
  { hex: '#185FA5', level: 0 }, { hex: '#6A3B8F', level: 0 }, // 어두움
  { hex: '#D21E2B', level: 1 }, { hex: '#1D9E75', level: 1 }, // 중간
  { hex: '#F3E01E', level: 2 }, { hex: '#F5A7C4', level: 2 }, // 밝음
]
// 배경·보드 = 중성 회색(≈18% 그레이) — 색·명도가 가장 정확히 보이는 무채색 바탕
const U = {
  bg: '#6e6e6e', panel: '#7c7c7c', board: '#808080', empty: '#767676', line: 'rgba(0,0,0,0.2)',
  tx: '#ffffff', tx2: '#efefef', mut: '#dadada', faint: '#c2c2c2',
  grad: 'linear-gradient(135deg,#A3E635,#22D3AA)', acc: '#dcff7a', onAcc: '#243208',
  glow: '0 8px 20px -6px rgba(90,200,120,0.5)',
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
  const [fx, setFx] = useState([]) // 블록 깨짐 파티클 버스트
  const levelRef = useRef(1)
  const [level, setLevel] = useState(1)
  const [showIntro, setShowIntro] = useState(false) // 시작 전 규칙 안내
  const [shaking, setShaking] = useState(false)      // 제거 시 보드 흔들림
  const [scorePop, setScorePop] = useState(null)     // +점수 팝업

  const spawn = useCallback(() => {
    // 난이도: 5레벨 미만 = 밝기 2단계(어두움·중간)·색 4종, 5레벨 이상 = 밝기 3단계·색 6종
    const brightLevels = levelRef.current >= 5 ? 3 : 2
    const pool = COLORS.filter(cd => cd.level < brightLevels)
    const kind = Math.random() < 0.5 ? 'color' : 'value'
    let level, color
    if (kind === 'color') { const cd = pool[rnd(pool.length)]; level = cd.level; color = cd.hex }
    else { level = rnd(brightLevels); color = GRAY[level] }
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
    const bursts = []
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
      toClear.forEach(i => {
        const r = Math.floor(i / COLS), c = i % COLS
        if (B[r][c]) bursts.push({ r, c, color: B[r][c].color })
        B[r][c] = null
      })
      gravity()
      cleared += toClear.size
    }
    return { cleared, bursts }
  }, [gravity])

  const lockAndNext = useCallback(() => {
    const f = fallRef.current
    if (!f) { spawn(); return }
    boardRef.current[f.row][f.col] = { kind: f.kind, level: f.level, color: f.color }
    fallRef.current = null
    const { cleared, bursts } = resolve()
    if (cleared > 0) {
      const gained = cleared * 6
      scoreRef.current += gained
      setScore(scoreRef.current)
      // 레벨: 점수 120마다 +1. 레벨 오르면 속도 상승(난이도 점증)
      const nl = 1 + Math.floor(scoreRef.current / 120)
      if (nl !== levelRef.current) { levelRef.current = nl; setLevel(nl) }
      speedRef.current = Math.max(230, 780 - (levelRef.current - 1) * 55)
      const id = Date.now() + Math.random()
      setFx(prev => [...prev, { id, cells: bursts.slice(0, 48) }])
      setTimeout(() => setFx(prev => prev.filter(b => b.id !== id)), 560)
      setShaking(true); setTimeout(() => setShaking(false), 300)
      setScorePop({ id, amount: gained }); setTimeout(() => setScorePop(p => (p && p.id === id ? null : p)), 700)
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
    scoreRef.current = 0; setScore(0); speedRef.current = 780
    levelRef.current = 1; setLevel(1); setShowIntro(false)
    spawn(); render()
    timerRef.current = setTimeout(loop, speedRef.current)
  }, [spawn, render, loop])

  useEffect(() => {
    if (!open) { clearTimeout(timerRef.current); return }
    try { setBest(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0) } catch {}
    // 시작 전 규칙 안내 — 빈 보드 위에 인트로 표시, '시작하기' 누르면 startGame
    clearTimeout(timerRef.current)
    boardRef.current = makeBoard(); fallRef.current = null
    overRef.current = false; setOver(false)
    scoreRef.current = 0; setScore(0); levelRef.current = 1; setLevel(1)
    setShowIntro(true); render()
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
        <style>{`
          @keyframes ctPop { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.95);opacity:0} }
          @keyframes ctFlash { 0%{transform:scale(.5);opacity:.9} 100%{transform:scale(2.5);opacity:0} }
          @keyframes ctShard { 0%{transform:translate(0,0) scale(1) rotate(0);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(.25) rotate(160deg);opacity:0} }
          @keyframes ctShake { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-3px,2px)} 40%{transform:translate(3px,-2px)} 60%{transform:translate(-2px,-2px)} 80%{transform:translate(2px,2px)} }
          @keyframes ctScorePop { 0%{transform:translate(-50%,0) scale(.6);opacity:0} 25%{transform:translate(-50%,-8px) scale(1.2);opacity:1} 100%{transform:translate(-50%,-36px) scale(1);opacity:0} }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#1D9E75 50%,#8f8f8f 50%)' }} />
            <span style={{ fontSize: 16, fontWeight: 900, color: U.tx, letterSpacing: '-0.3px' }}>색채 테트리스</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: U.onAcc, background: U.acc, borderRadius: 20, padding: '2px 9px' }}>Lv.{level}</span>
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

          <div style={{ position: 'relative', animation: shaking ? 'ctShake 0.3s ease-in-out' : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS},${CELL}px)`, gap: GAP, background: U.board, padding: GAP + 2, borderRadius: 12, border: `1px solid ${U.line}` }}>
              {Array.from({ length: ROWS }).map((_, r) => Array.from({ length: COLS }).map((__, c) => {
                const isFall = f && f.row === r && f.col === c
                const cell = isFall ? { color: f.color } : boardRef.current[r][c]
                return <div key={`${r}-${c}`} style={{ width: CELL, height: CELL, borderRadius: 6, background: cell ? cell.color : U.empty, boxShadow: cell ? 'inset 0 2px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.22)' : 'none' }} />
              }))}
            </div>

            {/* 블록 깨짐 파티클 — 팡! 터지는 통쾌함 */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
              {fx.flatMap(b => b.cells.map((cell, k) => {
                const x = PAD + cell.c * (CELL + GAP), y = PAD + cell.r * (CELL + GAP)
                return (
                  <div key={`${b.id}-${k}`} style={{ position: 'absolute', left: x, top: y, width: CELL, height: CELL }}>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: 6, background: cell.color, animation: 'ctPop 0.46s ease-out forwards' }} />
                    <span style={{ position: 'absolute', inset: -4, borderRadius: 9, border: '2px solid rgba(255,255,255,0.95)', animation: 'ctFlash 0.44s ease-out forwards' }} />
                    {[[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], si) => (
                      <span key={si} style={{ position: 'absolute', left: CELL / 2 - 3, top: CELL / 2 - 3, width: 6, height: 6, borderRadius: 2, background: cell.color, '--dx': `${sx * 30}px`, '--dy': `${sy * 30}px`, animation: 'ctShard 0.55s ease-out forwards' }} />
                    ))}
                  </div>
                )
              }))}
            </div>

            {scorePop && (
              <div key={scorePop.id} style={{ position: 'absolute', left: '50%', top: '34%', zIndex: 8, pointerEvents: 'none', fontSize: 22, fontWeight: 900, color: '#fff', textShadow: `0 0 10px ${U.acc}, 0 2px 4px rgba(0,0,0,0.5)`, animation: 'ctScorePop 0.7s ease-out forwards' }}>+{scorePop.amount}</div>
            )}

            {showIntro && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,16,22,0.93)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '18px 14px', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 9, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>🎯 규칙</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, alignSelf: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#eaeaea' }}>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 14, height: 14, borderRadius: 3, background: '#D21E2B' }} />)}</span>
                    <span>같은 색 <b style={{ color: U.acc }}>3개</b> 이어지면 사라짐</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#eaeaea' }}>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: '#1D9E75' }} /><span style={{ width: 14, height: 14, borderRadius: 3, background: '#8f8f8f', boxShadow: `0 0 0 1.5px ${U.acc}` }} /></span>
                    <span>회색이 <b style={{ color: U.acc }}>같은 밝기</b> 색에 닿으면 덩어리 통째 사라짐</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#b8b8b8' }}>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: '#8f8f8f' }} /><span style={{ width: 14, height: 14, borderRadius: 3, background: '#8f8f8f' }} /></span>
                    <span>회색끼리는 안 사라져요</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#9a9a9a', fontWeight: 700, lineHeight: 1.5 }}>레벨이 오르면 색·명도가 다양해지고 빨라져요 (5레벨↑)</div>
                </div>
                <button onClick={() => startGame()} style={{ marginTop: 4, padding: '12px 30px', background: U.grad, color: U.onAcc, border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: U.glow }}>시작하기 ▶</button>
              </div>
            )}

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
