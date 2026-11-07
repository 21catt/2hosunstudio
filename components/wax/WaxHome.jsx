'use client'
// 「왁뿌」 메인 홈 — 고양이 얼굴을 고르고(1) 그 위에 그리고(2) 왁스 3겹 색을 입혀(3) 손으로 파삭 부순다(4).
//   · 그리기 = 고른 고양이 위에 펜으로 꾸미기 · 「직접 그리기」를 고르면 빈 칸에 내 캐릭터 — 그린 모양대로 왁스가 감싼다
//   · 부순 정도 % · 단계(겹)마다 색 바꾸기 · 「원래대로」 = 왁스를 다시 입힌다
//   · 소리 = lib/waxSound(Web Audio 합성) · 진동 = navigator.vibrate(있는 기기만)
//   · 모바일 터치가 주 환경 — 손가락이 조금 빗나가도 가까운 조각이 깨지고, 끌면 지나간 자리가 깨진다
//   · 메인 화면 고르기(3D 홈 · 왁뿌 · 예전 홈) = HomeModePicker
import { useEffect, useRef, useState, useCallback } from 'react'
import { WaxEngine, WAX_COLORS, DEFAULT_WAX, STAGES, waxColor } from '../../lib/waxEngine'
import { crack, squish, coat, clear, buzz, unlockWaxSound, waxSoundOn, setWaxSound, scribble } from '../../lib/waxSound'
import { pixelCatImg, PROFILE_CAT_KEY } from '../../lib/pixelCats'
import HomeModePicker from './HomeModePicker'
import s from './wax.module.css'

const CAT_KEY = '2hs_wax_cat'
const COLOR_KEY = '2hs_wax_colors'
const ART_KEY = '2hs_wax_art_' // + 고양이 키 — 고양이마다 그린 그림을 따로 기억
const BASE_CATS = ['09-cat', '01-happy', '07-laugh']
const DRAW = 'draw' // 「직접 그리기」 = 빈 칸
const ART = 512 // 그림 캔버스 한 변(px)
const PENS = ['#2b2433', '#ffffff', '#e8434f', '#f59a2b', '#f6d24a', '#4cb86e', '#3f7fe0', '#f58ab8', '#8a5cd6', '#8b5a3c']
const SIZES = [['가늘게', 4], ['보통', 9], ['굵게', 18]]
const STEPS = [['pick', '고양이'], ['draw', '그리기'], ['coat', '왁스 색'], ['crush', '파삭']]

function loadColors() {
  try {
    const v = JSON.parse(localStorage.getItem(COLOR_KEY) || 'null')
    if (Array.isArray(v) && v.length === STAGES && v.every(k => WAX_COLORS.some(w => w.key === k))) return v
  } catch {}
  return [...DEFAULT_WAX]
}
function blank() { const c = document.createElement('canvas'); c.width = ART; c.height = ART; return c }

export default function WaxHome({ user }) {
  const [step, setStep] = useState('pick') // pick → draw → coat → crush
  const [cats, setCats] = useState(BASE_CATS)
  const [cat, setCat] = useState(BASE_CATS[0])
  const [colors, setColors] = useState(DEFAULT_WAX)
  const [stageTab, setStageTab] = useState(0) // 색을 고르는 단계(0 = 1단계 바깥)
  const [prog, setProg] = useState({ pct: 0, per: [] })
  const [sound, setSound] = useState(true)
  const [toast, setToast] = useState('')
  const [picker, setPicker] = useState(false)
  const [pen, setPen] = useState(PENS[0])
  const [size, setSize] = useState(9)
  const [eraser, setEraser] = useState(false)
  const [undoN, setUndoN] = useState(0)
  const wrapRef = useRef(null), cvRef = useRef(null), engRef = useRef(null)
  const baseRef = useRef(null)   // 고른 고양이 그림(직접 그리기 = null)
  const artRef = useRef(null)    // 그린 선만
  const srcRef = useRef(null)    // 고양이 + 선 = 엔진이 감싸는 그림
  const artDirty = useRef(false), undoRef = useRef([])
  const toastT = useRef(0)
  const colorsRef = useRef(colors), stepRef = useRef(step), catRef = useRef(cat)
  useEffect(() => { colorsRef.current = colors; stepRef.current = step; catRef.current = cat }, [colors, step, cat])

  // 저장된 고양이·색 · 프로필 고양이도 고를 수 있게
  useEffect(() => {
    let list = BASE_CATS
    try {
      const prof = localStorage.getItem(PROFILE_CAT_KEY)
      if (prof && !list.includes(prof)) list = [prof, ...list]
      const saved = localStorage.getItem(CAT_KEY)
      setCat(saved && (list.includes(saved) || saved === DRAW) ? saved : list[0])
    } catch {}
    setCats(list)
    setColors(loadColors())
    setSound(waxSoundOn())
  }, [])

  const say = useCallback((t) => {
    setToast(t); clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(''), 1600)
  }, [])

  // 엔진 만들기
  useEffect(() => {
    const eng = new WaxEngine(cvRef.current, {
      onBreak: ({ size, bright, chain }) => { crack(size, bright); buzz(chain ? 8 : 14 + Math.round(size * 12)) },
      onStageClear: (n) => {
        clear(n); buzz(40)
        setTimeout(() => say(n < STAGES ? `${n}단계 다 깼어요! 다음 겹으로` : '그림이 나왔어요 🐾'), 60)
      },
      onProgress: setProg,
    })
    engRef.current = eng
    if (process.env.NODE_ENV === 'development') window.__wax = eng // 개발 중 확인용
    return () => eng.stop()
  }, [say])

  // 고양이 + 그린 선 → 엔진이 감쌀 그림
  const compose = useCallback(() => {
    const src = srcRef.current, art = artRef.current
    if (!src || !art) return
    const g = src.getContext('2d')
    g.clearRect(0, 0, ART, ART)
    const base = baseRef.current
    if (base) { g.imageSmoothingEnabled = false; g.drawImage(base, 0, 0, ART, ART); g.imageSmoothingEnabled = true }
    g.drawImage(art, 0, 0)
  }, [])

  // 짓기(그림·크기가 바뀌면 다시 — 깨진 상태는 버린다)
  const rebuild = useCallback(() => {
    const eng = engRef.current, wrap = wrapRef.current, src = srcRef.current
    if (!eng || !wrap || !src) return
    const w = wrap.clientWidth
    const h = Math.round(Math.min(w * 1.0, Math.max(300, window.innerHeight * 0.52)))
    eng.setColors(colorsRef.current)
    eng.showWax = stepRef.current === 'coat' || stepRef.current === 'crush'
    eng.build(src, w, h, Math.min(2, window.devicePixelRatio || 1))
    artDirty.current = false
  }, [])

  function saveArt() {
    try { localStorage.setItem(ART_KEY + catRef.current, artRef.current.toDataURL('image/png')) } catch {}
  }

  // 고양이를 바꾸면: 그 고양이 그림 + 전에 그려 둔 선 불러오기
  useEffect(() => {
    if (!srcRef.current) { srcRef.current = blank(); artRef.current = blank() }
    const art = artRef.current
    art.getContext('2d').clearRect(0, 0, ART, ART)
    undoRef.current = []; setUndoN(0)
    let pending = 0
    const done = () => { if (--pending <= 0) { compose(); rebuild() } }
    pending++
    let saved = null
    try { saved = localStorage.getItem(ART_KEY + cat) } catch {}
    if (saved) {
      pending++
      const im = new Image()
      im.onload = () => { art.getContext('2d').drawImage(im, 0, 0, ART, ART); done() }
      im.onerror = done
      im.src = saved
    }
    if (cat === DRAW) { baseRef.current = null; done() }
    else {
      const img = new Image()
      img.onload = () => { baseRef.current = img; done() }
      img.onerror = done
      img.src = pixelCatImg(cat)
    }
    try { localStorage.setItem(CAT_KEY, cat) } catch {}
  }, [cat, compose, rebuild])

  useEffect(() => {
    let lastW = wrapRef.current?.clientWidth || 0
    const ro = new ResizeObserver(() => {
      const nw = wrapRef.current?.clientWidth || 0
      if (Math.abs(nw - lastW) > 30) { lastW = nw; rebuild() }
    })
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [rebuild])

  // 그리기를 마치고 나가면 그린 모양으로 왁스를 다시 짓는다
  useEffect(() => {
    if (step !== 'draw' && artDirty.current) rebuild()
    engRef.current?.setShowWax(step === 'coat' || step === 'crush')
  }, [step, rebuild])

  useEffect(() => {
    engRef.current?.setColors(colors)
    try { localStorage.setItem(COLOR_KEY, JSON.stringify(colors)) } catch {}
  }, [colors])

  function hasDrawing() {
    const d = artRef.current?.getContext('2d').getImageData(0, 0, ART, ART).data
    if (!d) return false
    for (let i = 3; i < d.length; i += 16) if (d[i] > 10) return true
    return false
  }
  function goCoat() {
    if (cat === DRAW && !hasDrawing()) { setStep('draw'); say('먼저 캐릭터를 그려 주세요 ✏️'); return }
    setStep('coat'); unlockWaxSound(); coat()
  }
  function goStep(k) { if (k === 'coat' || k === 'crush') { if (cat === DRAW && !hasDrawing()) { setStep('draw'); say('먼저 캐릭터를 그려 주세요 ✏️'); return } } setStep(k) }

  // ── 손 입력 ──
  //   그리기 단계: 그림 칸 위를 펜으로 · 부수기 단계: 탭 = 파삭 · 끌기 = 지나간 자리 · 꾹 = 말랑 눌렀다 한꺼번에
  const ptr = useRef(null)
  const local = (e) => { const r = cvRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  function toArt(x, y) {
    const [bx, by, bs] = engRef.current.catBox
    return [((x - bx) / bs) * ART, ((y - by) / bs) * ART, ART / bs]
  }
  function drawSeg(x0, y0, x1, y1) {
    const g = artRef.current.getContext('2d')
    const [ax, ay, k] = toArt(x0, y0), [bx, by] = toArt(x1, y1)
    g.save()
    g.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'
    g.strokeStyle = pen; g.fillStyle = pen
    g.lineWidth = size * k * (eraser ? 1.8 : 1); g.lineCap = 'round'; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx + 0.01, by); g.stroke()
    g.restore()
    artDirty.current = true
    compose()
  }

  function onDown(e) {
    unlockWaxSound()
    const eng = engRef.current
    if (!eng || !eng.catBox) return
    const [x, y] = local(e)
    if (step === 'draw') {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const g = artRef.current.getContext('2d')
      undoRef.current.push(g.getImageData(0, 0, ART, ART))
      if (undoRef.current.length > 20) undoRef.current.shift()
      setUndoN(undoRef.current.length)
      drawSeg(x, y, x, y)
      ptr.current = { x, y, drawing: true }
      return
    }
    if (step !== 'crush') { // 부수기 전에는 눌러도 말랑하게만
      eng.squash.v -= 0.06; squish(); return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const hitIt = eng.hit(x, y, 1)
    if (!hitIt) { eng.squash.v -= 0.04 }
    ptr.current = { x, y, moved: 0, t: performance.now(), held: false }
    ptr.current.timer = setTimeout(() => {
      const p = ptr.current
      if (!p || p.moved > 14) return
      p.held = true
      squish(); buzz(25)
      eng.squeeze(p.x, p.y)
    }, 420)
  }
  function onMove(e) {
    const p = ptr.current, eng = engRef.current
    if (!p || !eng) return
    const [x, y] = local(e)
    const d = Math.hypot(x - p.x, y - p.y)
    if (p.drawing) {
      if (d < 1.5) return
      drawSeg(p.x, p.y, x, y); scribble(Math.min(1, d / 30))
      p.x = x; p.y = y
      return
    }
    if (step !== 'crush') return
    p.moved += d
    if (d > 20) { eng.hit(x, y, 0.55); p.x = x; p.y = y }
  }
  function onUp() {
    const p = ptr.current
    if (p?.timer) clearTimeout(p.timer)
    if (p?.drawing) saveArt()
    ptr.current = null
  }

  function undoDraw() {
    const im = undoRef.current.pop()
    if (!im) return
    artRef.current.getContext('2d').putImageData(im, 0, 0)
    setUndoN(undoRef.current.length)
    artDirty.current = true; compose(); saveArt()
  }
  function clearDraw() {
    const g = artRef.current.getContext('2d')
    undoRef.current.push(g.getImageData(0, 0, ART, ART)); setUndoN(undoRef.current.length)
    g.clearRect(0, 0, ART, ART)
    artDirty.current = true; compose(); saveArt()
  }

  function restore() {
    engRef.current?.restore(); coat(); buzz(20)
    say('왁스를 다시 입혔어요')
  }
  function setStageColor(i, key) {
    setColors(prev => { const n = [...prev]; n[i] = key; return n })
    if (engRef.current) engRef.current.squash.v -= 0.03
  }
  function toggleSound() { const v = !sound; setWaxSound(v); setSound(v); if (v) { unlockWaxSound(); crack(0.3, 0.7) } }

  // 지금 깨는 단계 = 조각이 남은 가장 바깥 겹
  const curStage = Math.max(0, prog.per.findIndex(p => p.left > 0))
  const allDone = prog.per.length > 0 && prog.per.every(p => p.left === 0)

  return (
    <div className={s.page}>
      <header className={s.top}>
        <div>
          <div className={s.title}>왁뿌</div>
          <div className={s.sub}>왁스 뿌시기 · 2호선 스튜디오</div>
        </div>
        <div className={s.topBtns}>
          <button className={s.pill} onClick={toggleSound} aria-pressed={sound} aria-label={sound ? '소리 끄기' : '소리 켜기'}>{sound ? '🔊 소리' : '🔇 끔'}</button>
          {user && <button className={s.pill} onClick={() => setPicker(true)}>메인 화면</button>}
          {!user && <a className={s.pill} href="/login">로그인</a>}
        </div>
      </header>

      <div className={s.steps} role="tablist" aria-label="단계">
        {STEPS.map(([k, t], i) => (
          <button key={k} role="tab" aria-selected={step === k} className={`${s.step} ${step === k ? s.on : ''}`} onClick={() => goStep(k)}>
            <span className={s.stepN}>{i + 1}</span>{t}
          </button>
        ))}
      </div>

      {step === 'crush' && (
        <div className={s.meter} aria-live="polite">
          <div className={s.meterRow}>
            <span>부순 정도</span><b>{prog.pct}%</b>
          </div>
          <div className={s.bar}><i style={{ width: `${prog.pct}%` }} /></div>
          <div className={s.stageDots}>
            {prog.per.map((p, i) => (
              <span key={i} className={`${s.dot} ${p.left === 0 ? s.done : i === curStage ? s.now : ''}`}
                style={{ '--wc': waxColor(colors[i]).c }}>{i + 1}단계</span>
            ))}
          </div>
        </div>
      )}
      <div ref={wrapRef} className={`${s.stage} ${step === 'draw' ? s.drawing : ''}`}>
        <canvas ref={cvRef} className={s.cv}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
          onContextMenu={e => e.preventDefault()} aria-label={step === 'draw' ? '그림 그리기' : '왁스를 눌러 부수기'} />
        {step === 'draw' && <div className={s.drawFrame} aria-hidden="true" />}
        {toast && <div className={s.toast}>{toast}</div>}
      </div>

      <section className={s.panel}>
        {step === 'pick' && (
          <>
            <div className={s.hint}>왁스로 감쌀 얼굴을 골라요</div>
            <div className={s.cats}>
              {cats.map(k => (
                <button key={k} className={`${s.catBtn} ${cat === k ? s.catOn : ''}`} onClick={() => { setCat(k); unlockWaxSound(); squish() }} aria-pressed={cat === k} aria-label={`고양이 ${k}`}>
                  <img src={pixelCatImg(k)} alt="" width={56} height={56} />
                </button>
              ))}
              <button className={`${s.catBtn} ${s.drawTile} ${cat === DRAW ? s.catOn : ''}`} onClick={() => { setCat(DRAW); unlockWaxSound(); squish() }} aria-pressed={cat === DRAW}>
                <span aria-hidden="true">✏️</span><small>직접 그리기</small>
              </button>
            </div>
            <button className={s.primary} onClick={() => { setStep('draw'); unlockWaxSound() }}>{cat === DRAW ? '그리러 가기 →' : '그림 그리기 →'}</button>
          </>
        )}

        {step === 'draw' && (
          <>
            <div className={s.hint}>{cat === DRAW ? '점선 칸 안에 내 캐릭터를 그려요 · 그린 모양대로 왁스가 감싸요' : '고양이 얼굴 위에 그려 꾸며요'}</div>
            <div className={s.pens}>
              {PENS.map(c => (
                <button key={c} className={`${s.pen} ${!eraser && pen === c ? s.penOn : ''}`} style={{ '--pc': c }}
                  onClick={() => { setPen(c); setEraser(false) }} aria-label={`펜 색 ${c}`} aria-pressed={!eraser && pen === c} />
              ))}
            </div>
            <div className={s.tools}>
              {SIZES.map(([t, v]) => (
                <button key={v} className={`${s.tool} ${size === v ? s.toolOn : ''}`} onClick={() => setSize(v)} aria-pressed={size === v}>
                  <i style={{ width: Math.max(4, v * 0.8), height: Math.max(4, v * 0.8) }} />{t}
                </button>
              ))}
              <button className={`${s.tool} ${eraser ? s.toolOn : ''}`} onClick={() => setEraser(v => !v)} aria-pressed={eraser}>🧽 지우개</button>
            </div>
            <div className={s.row} style={{ marginBottom: 8 }}>
              <button className={s.ghost} onClick={undoDraw} disabled={!undoN}>↩ 되돌리기</button>
              <button className={s.ghost} onClick={clearDraw}>다 지우기</button>
            </div>
            <div className={s.row}>
              <button className={s.ghost} onClick={() => setStep('pick')}>← 얼굴</button>
              <button className={s.primary} onClick={goCoat}>왁스 색 고르기 →</button>
            </div>
          </>
        )}

        {step === 'coat' && (
          <>
            <div className={s.hint}>세 겹으로 입혀요 · 1단계가 가장 바깥이에요</div>
            <div className={s.stageTabs}>
              {Array.from({ length: STAGES }, (_, i) => (
                <button key={i} className={`${s.stageTab} ${stageTab === i ? s.on : ''}`} onClick={() => setStageTab(i)}
                  style={{ '--wc': waxColor(colors[i]).c }}>
                  <i />{i + 1}단계
                </button>
              ))}
            </div>
            <ColorChips value={colors[stageTab]} onPick={k => setStageColor(stageTab, k)} />
            <div className={s.row}>
              <button className={s.ghost} onClick={() => setStep('draw')}>← 그리기</button>
              <button className={s.primary} onClick={() => { setStep('crush'); unlockWaxSound(); say('톡 누르거나 쓱 문질러 부숴요') }}>파삭 부수기 →</button>
            </div>
          </>
        )}

        {step === 'crush' && (
          <>
            <div className={s.hint}>
              {allDone ? '다 부쉈어요! 「원래대로」로 다시 입혀요' : '톡 = 파삭 · 쓱 문지르기 = 바스락 · 꾹 누르기 = 한꺼번에'}
            </div>
            {!allDone && (
              <>
                <div className={s.subHint}>지금 {curStage + 1}단계 색 바꾸기</div>
                <ColorChips value={colors[curStage]} onPick={k => setStageColor(curStage, k)} />
              </>
            )}
            <div className={s.row}>
              <button className={s.ghost} onClick={() => setStep('coat')}>색 다시 고르기</button>
              <button className={s.primary} onClick={restore}>↺ 원래대로</button>
            </div>
          </>
        )}
      </section>

      {picker && <HomeModePicker current="wax" onClose={() => setPicker(false)} sheet />}
    </div>
  )
}

function ColorChips({ value, onPick }) {
  return (
    <div className={s.chips}>
      {WAX_COLORS.map(w => (
        <button key={w.key} className={`${s.chip} ${value === w.key ? s.chipOn : ''}`} onClick={() => onPick(w.key)} aria-pressed={value === w.key}>
          <i style={{ background: w.c, opacity: w.key === 'clear' ? 0.6 : 1 }} />{w.name}
        </button>
      ))}
    </div>
  )
}
