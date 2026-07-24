'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { submitGameScore } from '../lib/gameScore'

// 색채 테트리스 — 색상 블록과 명도(회색) 블록이 번갈아 내려온다.
// 색상 블록의 '밝기'에 맞는 명도 블록을 맞물리면(같은 밝기 레벨) 이어진 덩어리가 사라진다.
// 단계(스테이지)마다 목표 제거 수를 채우면 → 축하 연출 → 다음 단계로. 단계가 오를수록
// 색채와 명도가 점점 다양해진다: 원색 → 주황·2차색 → 틴트(화이트 섞임) → 셰이드(블랙 섞임)
// → 미묘하게만 차이나는 색(색 지각 난이도). 최고점·최고 단계 localStorage + 리더보드 제출.
// 스킨 = 중성 회색 바탕(색·명도가 가장 정확히 보이는 무채색).

const COLS = 8, ROWS = 13, CELL = 27, GAP = 2, SPAWN = 3
const PAD = GAP + 3 // 보드 border+padding 오프셋(파티클 정렬용)
const BEST_KEY = '2hs_colortetris_best'
const STAGE_KEY = '2hs_colortetris_stage'
// 명도(회색) 램프 — 밝기 레벨 0(어두움)…4(밝음). 단계가 오를수록 위 버킷이 열린다.
const GRAY = ['#3c3c3c', '#606060', '#8a8a8a', '#b2b2b2', '#d8d8d8']

// 색 블록 = 고정 밝기(판단 학습). level = 밝기 버킷(GRAY와 대응), tier = 등장 단계(0-based), tag = 종류.
// 같은 색(정확히 같은 hex)끼리 3매치, 회색은 같은 밝기(level) 색에 닿으면 이어진 덩어리 통째 제거.
const COLORS = [
  // 1단계 — 원색(밝기 2단: 0·1)
  { hex: '#16407a', level: 0, tier: 0, tag: '원색' },
  { hex: '#cf2130', level: 1, tier: 0, tag: '원색' },
  { hex: '#1e9e74', level: 1, tier: 0, tag: '원색' },
  // 2단계 — 2차색·주황(밝기 3단: +2)
  { hex: '#5a2d86', level: 0, tier: 1, tag: '보라' },
  { hex: '#e8862a', level: 2, tier: 1, tag: '주황' },
  { hex: '#f4d01c', level: 2, tier: 1, tag: '노랑' },
  // 3단계 — 틴트(화이트 섞인 파스텔, 밝기 4단: +3) + 번트 오렌지
  { hex: '#b85c22', level: 1, tier: 2, tag: '번트오렌지' },
  { hex: '#8fbce6', level: 3, tier: 2, tag: '틴트·하늘' },
  { hex: '#f7b9d1', level: 3, tier: 2, tag: '틴트·분홍' },
  // 4단계 — 셰이드(블랙 섞인 딥톤, 밝기 5단: +4)
  { hex: '#6a121b', level: 0, tier: 3, tag: '셰이드·마룬' },
  { hex: '#0f4636', level: 0, tier: 3, tag: '셰이드·딥그린' },
  { hex: '#b9e6d0', level: 4, tier: 3, tag: '민트' },
  { hex: '#f6dca6', level: 4, tier: 3, tag: '크림' },
  // 5단계 — 미묘하게만 차이나는 색(거의 같은 hue — 색 지각 난이도)
  { hex: '#dd7a2c', level: 2, tier: 4, tag: '주황(미묘)' },
  { hex: '#cf3a2a', level: 1, tier: 4, tag: '빨강(미묘)' },
  { hex: '#f0c4d6', level: 4, tier: 4, tag: '분홍(미묘)' },
]

// 단계 정의: goal = 이번 단계에서 제거할 블록 수, levels = 활성 밝기 버킷 수, note = 축하 안내.
const STAGES = [
  { goal: 12, levels: 2, note: '원색과 명도로 시작' },
  { goal: 16, levels: 3, note: '주황·보라·노랑, 명도 3단 추가' },
  { goal: 20, levels: 4, note: '틴트(화이트 섞인 색), 명도 4단' },
  { goal: 24, levels: 5, note: '셰이드(블랙 섞인 딥톤), 명도 5단' },
  { goal: 28, levels: 5, note: '미묘하게만 다른 색 — 눈이 예민해져요' },
]
const stageConf = idx => STAGES[Math.min(idx, STAGES.length - 1)]
const stageGoal = idx => {
  const base = stageConf(idx).goal
  return idx < STAGES.length ? base : base + (idx - STAGES.length + 1) * 4
}
const stageLevels = idx => stageConf(idx).levels
const stageSpeed = idx => Math.max(220, 780 - idx * 70)
// 이 단계까지 열린 색들(밝기 버킷 활성 범위 안). newTier = 이번 단계에 새로 등장한 것.
const unlockedColors = idx => COLORS.filter(c => c.tier <= idx && c.level < stageLevels(idx))

// 배경·보드 = 중성 회색 — 색·명도가 가장 정확히 보이는 무채색 바탕
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
  const speedRef = useRef(780)
  const timerRef = useRef(null)
  const [, force] = useState(0)
  const render = useCallback(() => force(n => n + 1), [])
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [best, setBest] = useState(0)
  const [fx, setFx] = useState([]) // 블록 깨짐 파티클 버스트
  const stageRef = useRef(0)          // 현재 단계(0-based)
  const [stageIdx, setStageIdx] = useState(0)
  const clearedRef = useRef(0)        // 이번 단계 누적 제거 수
  const [stageProg, setStageProg] = useState(0)
  const stageClearRef = useRef(false) // 축하 중 = 낙하 정지
  const [stageClear, setStageClear] = useState(null) // { stage } 축하 오버레이
  const [bestStage, setBestStage] = useState(0)
  const [showIntro, setShowIntro] = useState(false) // 시작 전 규칙 안내
  const [shaking, setShaking] = useState(false)      // 제거 시 보드 흔들림
  const [scorePop, setScorePop] = useState(null)     // +점수 팝업

  const spawn = useCallback(() => {
    const idx = stageRef.current
    const levels = stageLevels(idx)
    const pool = unlockedColors(idx)
    const kind = Math.random() < 0.5 ? 'color' : 'value'
    let level, color
    if (kind === 'color') { const cd = pool[rnd(pool.length)]; level = cd.level; color = cd.hex }
    else { level = rnd(levels); color = GRAY[level] }
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

  const enterStageClear = useCallback(() => {
    stageClearRef.current = true
    clearTimeout(timerRef.current)
    const reached = stageRef.current + 1 // 방금 클리어한 단계(1-based)
    setBestStage(b => { const nb = Math.max(b, reached); try { localStorage.setItem(STAGE_KEY, String(nb)) } catch {} return nb })
    // 클리어 보너스 점수 + 단계 기록
    scoreRef.current += 40 + stageRef.current * 20
    setScore(scoreRef.current)
    setBest(b => { const nb = Math.max(b, scoreRef.current); try { localStorage.setItem(BEST_KEY, String(nb)) } catch {} return nb })
    submitGameScore('colortetris', scoreRef.current)
    setStageClear({ stage: stageRef.current })
    render()
  }, [render])

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
      clearedRef.current += cleared
      setStageProg(clearedRef.current)
      const id = Date.now() + Math.random()
      setFx(prev => [...prev, { id, cells: bursts.slice(0, 48) }])
      setTimeout(() => setFx(prev => prev.filter(b => b.id !== id)), 560)
      setShaking(true); setTimeout(() => setShaking(false), 300)
      setScorePop({ id, amount: gained }); setTimeout(() => setScorePop(p => (p && p.id === id ? null : p)), 700)
      // 이번 단계 목표 달성 → 축하 연출(낙하 정지, 다음 단계 대기)
      if (clearedRef.current >= stageGoal(stageRef.current)) { enterStageClear(); return }
    }
    spawn()
  }, [resolve, spawn, enterStageClear])

  const step = useCallback(() => {
    const f = fallRef.current
    if (!f) { spawn(); return }
    if (f.row + 1 < ROWS && boardRef.current[f.row + 1][f.col] == null) { f.row++; return }
    lockAndNext()
  }, [lockAndNext, spawn])

  const loop = useCallback(() => {
    if (overRef.current || stageClearRef.current) return
    step(); render()
    timerRef.current = setTimeout(loop, speedRef.current)
  }, [step, render])

  const startGame = useCallback(() => {
    clearTimeout(timerRef.current)
    boardRef.current = makeBoard(); fallRef.current = null
    overRef.current = false; setOver(false)
    stageClearRef.current = false; setStageClear(null)
    scoreRef.current = 0; setScore(0)
    stageRef.current = 0; setStageIdx(0)
    clearedRef.current = 0; setStageProg(0)
    speedRef.current = stageSpeed(0); setShowIntro(false)
    spawn(); render()
    timerRef.current = setTimeout(loop, speedRef.current)
  }, [spawn, render, loop])

  const nextStage = useCallback(() => {
    stageClearRef.current = false; setStageClear(null)
    stageRef.current += 1; setStageIdx(stageRef.current)
    clearedRef.current = 0; setStageProg(0)
    boardRef.current = makeBoard(); fallRef.current = null // 새 단계 = 깨끗한 보드
    speedRef.current = stageSpeed(stageRef.current)
    spawn(); render()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(loop, speedRef.current)
  }, [spawn, render, loop])

  useEffect(() => {
    if (!open) { clearTimeout(timerRef.current); return }
    try {
      setBest(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0)
      setBestStage(parseInt(localStorage.getItem(STAGE_KEY) || '0', 10) || 0)
    } catch {}
    // 시작 전 규칙 안내 — 빈 보드 위에 인트로 표시, '시작하기' 누르면 startGame
    clearTimeout(timerRef.current)
    boardRef.current = makeBoard(); fallRef.current = null
    overRef.current = false; setOver(false)
    stageClearRef.current = false; setStageClear(null)
    scoreRef.current = 0; setScore(0)
    stageRef.current = 0; setStageIdx(0)
    clearedRef.current = 0; setStageProg(0)
    setShowIntro(true); render()
    return () => clearTimeout(timerRef.current)
  }, [open]) // eslint-disable-line

  const moveH = useCallback(dx => {
    const f = fallRef.current; if (!f || overRef.current || stageClearRef.current) return
    const nc = f.col + dx
    if (nc >= 0 && nc < COLS && boardRef.current[f.row][nc] == null) { f.col = nc; render() }
  }, [render])
  const hardDrop = useCallback(() => {
    const f = fallRef.current; if (!f || overRef.current || stageClearRef.current) return
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
  const goal = stageGoal(stageIdx)
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
          @keyframes ctConfetti { 0%{transform:translate(0,-10px) rotate(0);opacity:0} 12%{opacity:1} 100%{transform:translate(var(--cx),260px) rotate(540deg);opacity:0} }
          @keyframes ctBadgePop { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
          @keyframes ctSwatchIn { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
          @keyframes ctRing { 0%,100%{box-shadow:0 0 0 2px ${U.acc}} 50%{box-shadow:0 0 0 4px ${U.acc}} }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#1D9E75 50%,#8f8f8f 50%)' }} />
            <span style={{ fontSize: 16, fontWeight: 900, color: U.tx, letterSpacing: '-0.3px' }}>색채 테트리스</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: U.onAcc, background: U.acc, borderRadius: 20, padding: '2px 9px' }}>{stageIdx + 1}단계</span>
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

        {/* 단계 진행 게이지 — 이번 단계 목표 대비 제거 수 */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: U.faint, letterSpacing: 0.5 }}>이번 단계 목표</span>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: U.tx2 }}>{Math.min(stageProg, goal)} / {goal}</span>
          </div>
          <div style={{ height: 7, borderRadius: 6, background: U.empty, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (stageProg / goal) * 100)}%`, background: U.grad, borderRadius: 6, transition: 'width 0.25s ease' }} />
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
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 14, height: 14, borderRadius: 3, background: '#cf2130' }} />)}</span>
                    <span>같은 색 <b style={{ color: U.acc }}>3개</b> 이어지면 사라짐</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#eaeaea' }}>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: '#1e9e74' }} /><span style={{ width: 14, height: 14, borderRadius: 3, background: '#8a8a8a', boxShadow: `0 0 0 1.5px ${U.acc}` }} /></span>
                    <span>회색이 <b style={{ color: U.acc }}>같은 밝기</b> 색에 닿으면 덩어리 통째 사라짐</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#eaeaea' }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>🏁</span>
                    <span>목표만큼 없애면 <b style={{ color: U.acc }}>단계 클리어</b> → 다음 단계로</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#c7c7c7', fontWeight: 700, lineHeight: 1.5 }}>단계가 오르면 색채와 명도가 다양해져요: 원색 → 주황·2차색 → 틴트 → 셰이드 → 미묘한 색</div>
                  {bestStage > 0 && <div style={{ fontSize: 10.5, fontWeight: 900, color: U.acc }}>최고 기록 · {bestStage}단계 도달</div>}
                </div>
                <button onClick={() => startGame()} style={{ marginTop: 4, padding: '12px 30px', background: U.grad, color: U.onAcc, border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: U.glow }}>시작하기 ▶</button>
              </div>
            )}

            {stageClear && (
              <StageClearOverlay stage={stageClear.stage} score={score} onNext={nextStage} />
            )}

            {over && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,16,22,0.9)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}>
                <div style={{ fontSize: 34 }}>{score >= best && score > 0 ? '🏆' : '🐾'}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: U.tx }}>게임 오버</div>
                <div style={{ fontSize: 20, fontWeight: 900, background: U.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{score}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: U.mut }}>{stageIdx + 1}단계 도달 · 최고 {bestStage}단계</div>
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
              <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 13, height: 13, borderRadius: 3, background: '#cf2130' }} />)}</span>
              <span>같은 색 <b style={{ color: U.acc }}>3개</b> 이어지면 사라짐</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, color: U.tx2 }}>
              <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}><span style={{ width: 13, height: 13, borderRadius: 3, background: '#1e9e74' }} /><span style={{ width: 13, height: 13, borderRadius: 3, background: '#8a8a8a', boxShadow: `0 0 0 1.5px ${U.acc}` }} /></span>
              <span>회색이 <b style={{ color: U.acc }}>같은 밝기</b> 색에 닿으면 이어진 덩어리 통째로 사라짐</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, color: U.mut }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>🏁</span>
              <span>목표 {goal}개 없애면 단계 클리어 · 단계 오를수록 색·명도 다양해짐</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 단계 클리어 축하 오버레이 — 컨페티 + 이번 단계까지 열린 색·명도 팔레트(축하 이미지)
function StageClearOverlay({ stage, score, onNext }) {
  const cleared = stage + 1                 // 방금 클리어한 단계(1-based)
  const nextIdx = stage + 1                 // 다음 단계 인덱스
  const unlocked = unlockedColors(stage)    // 이번 단계까지 열린 색
  const nextNew = unlockedColors(nextIdx).filter(c => !unlocked.some(u => u.hex === c.hex)) // 다음 단계 새 색
  const levels = stageLevels(stage)
  // 밝기 레벨(행)별로 회색 + 색 스와치 나열 = "색채 + 명도" 확장을 한눈에
  const rows = Array.from({ length: levels }, (_, lv) => ({
    lv, gray: GRAY[lv], colors: unlocked.filter(c => c.level === lv),
  })).filter(row => row.colors.length > 0).reverse() // 밝은 명도 위로
  const confettiColors = unlocked.map(c => c.hex)
  const nextNote = stageConf(nextIdx).note

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,16,22,0.94)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '16px 14px', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 10, boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* 컨페티 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {Array.from({ length: 18 }).map((_, i) => {
          const col = confettiColors[i % confettiColors.length] || '#dcff7a'
          const left = (i * 53) % 100
          const dx = ((i % 5) - 2) * 24
          return <span key={i} style={{ position: 'absolute', left: `${left}%`, top: -12, width: 8, height: 8, borderRadius: 2, background: col, '--cx': `${dx}px`, animation: `ctConfetti ${1.1 + (i % 4) * 0.25}s ease-in ${(i % 6) * 0.09}s forwards` }} />
        })}
      </div>

      <div style={{ fontSize: 30, animation: 'ctBadgePop 0.5s ease-out' }}>🎉</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>{cleared}단계 클리어!</div>

      {/* 축하 이미지 = 마스터한 색·명도 팔레트 */}
      <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map(row => (
          <div key={row.lv} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: row.gray, flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }} title="명도" />
            <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
            {row.colors.map((c, k) => (
              <span key={c.hex} style={{ width: 16, height: 16, borderRadius: 4, background: c.hex, boxShadow: c.tier === stage ? undefined : 'inset 0 1px 0 rgba(255,255,255,0.2)', animation: c.tier === stage ? `ctSwatchIn 0.3s ease-out ${k * 0.05}s backwards, ctRing 1.4s ease-in-out ${0.3 + k * 0.05}s infinite` : `ctSwatchIn 0.3s ease-out ${k * 0.04}s backwards` }} title={c.tag} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#cfcfcf' }}>지금까지 색 {unlocked.length}종 · 명도 {rows.length}단</div>

      {nextNew.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color: U.acc, background: 'rgba(220,255,122,0.1)', border: '1px solid rgba(220,255,122,0.3)', borderRadius: 10, padding: '6px 10px' }}>
          <span style={{ display: 'flex', gap: 3 }}>{nextNew.slice(0, 5).map(c => <span key={c.hex} style={{ width: 12, height: 12, borderRadius: 3, background: c.hex }} />)}</span>
          <span>다음 단계 · {nextNote}</span>
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 800, color: '#b7b7b7' }}>점수 {score}</div>
      <button onClick={onNext} style={{ marginTop: 2, padding: '11px 28px', background: U.grad, color: U.onAcc, border: 'none', borderRadius: 15, fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', boxShadow: U.glow }}>다음 단계 ▶</button>
    </div>
  )
}
