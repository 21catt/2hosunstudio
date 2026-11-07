'use client'
// 「왁뿌」 꾸미기 화면 — 얼굴 고르기(1) → 그리기(2) → 왁스 색(3) → 파삭(4).
//   · 말랑이·왁스·부수기 = 3D 장면 public/wax-squish(이 화면에 iframe 으로, 3D 홈 배경으로도 같은 파일)
//     잡고 구부리기·비틀기·두 손가락 꾹 · 톡 = 금 → 한 번 더 = 파삭 · 빈 곳 끌기 = 돌려 보기
//   · 설정은 같은 출처 localStorage(2hs_wax_cat · 2hs_wax_art_<고양이> · 2hs_wax_colors)에 두고, 바뀌면 장면에 알린다
//   · 그리기 = 고른 고양이 위에 꾸미기 · 「직접 그리기」 = 빈 칸 — 그린 모양이 그대로 3D 말랑이가 된다
//   · 메인 화면 고르기(3D 홈 · 왁뿌 · 예전 홈) = HomeModePicker
import { useEffect, useRef, useState, useCallback } from 'react'
import { squish, unlockWaxSound, waxSoundOn, setWaxSound, scribble } from '../../lib/waxSound'
import { pixelCatImg, PROFILE_CAT_KEY } from '../../lib/pixelCats'
import HomeModePicker from './HomeModePicker'
import s from './wax.module.css'

export const WAX_COLORS = [
  { key: 'clear', name: '투명', c: '#f3efe6' }, { key: 'milk', name: '우유', c: '#fff6e8' }, { key: 'butter', name: '버터', c: '#f6d877' },
  { key: 'pink', name: '핑크', c: '#f5a6c3' }, { key: 'sky', name: '하늘', c: '#a3d1f2' }, { key: 'mint', name: '민트', c: '#a6e2c4' },
  { key: 'lavender', name: '라벤더', c: '#c7b4f1' }, { key: 'peach', name: '복숭아', c: '#f8bc98' }, { key: 'cocoa', name: '코코아', c: '#b4896b' },
]
const waxColor = k => WAX_COLORS.find(w => w.key === k) || WAX_COLORS[1]
const DEFAULT_WAX = ['sky', 'pink', 'butter'] // 1단계(바깥) · 2단계 · 3단계(안쪽)
const STAGES = 3
const CAT_KEY = '2hs_wax_cat'
const COLOR_KEY = '2hs_wax_colors'
const ART_KEY = '2hs_wax_art_' // + 고양이 키 — 고양이마다 그린 그림을 따로 기억
const BASE_CATS = ['09-cat', '01-happy', '07-laugh']
const DRAW = 'draw' // 「직접 그리기」 = 빈 칸
const ART = 512
const PENS = ['#2b2433', '#ffffff', '#e8434f', '#f59a2b', '#f6d24a', '#4cb86e', '#3f7fe0', '#f58ab8', '#8a5cd6', '#8b5a3c']
const SIZES = [['가늘게', 10], ['보통', 22], ['굵게', 44]] // 그림 칸(512) 기준 굵기
const STEPS = [['pick', '얼굴'], ['draw', '그리기'], ['coat', '왁스 색'], ['crush', '파삭']]

function loadColors() {
  try {
    const v = JSON.parse(localStorage.getItem(COLOR_KEY) || 'null')
    if (Array.isArray(v) && v.length === STAGES && v.every(k => WAX_COLORS.some(w => w.key === k))) return v
  } catch {}
  return [...DEFAULT_WAX]
}
function blank() { const c = document.createElement('canvas'); c.width = ART; c.height = ART; return c }

export default function WaxHome({ user }) {
  const [step, setStep] = useState('pick')
  const [cats, setCats] = useState(BASE_CATS)
  const [cat, setCat] = useState(null)
  const [colors, setColors] = useState(DEFAULT_WAX)
  const [stageTab, setStageTab] = useState(0)
  const [prog, setProg] = useState({ pct: 0, per: [] })
  const [sound, setSound] = useState(true)
  const [picker, setPicker] = useState(false)
  const [pen, setPen] = useState(PENS[0])
  const [size, setSize] = useState(22)
  const [eraser, setEraser] = useState(false)
  const [undoN, setUndoN] = useState(0)
  const [toast, setToast] = useState('')
  const frameRef = useRef(null), padRef = useRef(null)
  const baseRef = useRef(null), artRef = useRef(null), undoRef = useRef([])
  const toastT = useRef(0)

  const say = useCallback((t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 1600) }, [])
  const toFrame = useCallback(msg => { try { frameRef.current?.contentWindow?.postMessage(msg, window.location.origin) } catch {} }, [])

  // 저장된 고양이·색 · 프로필 고양이도 고를 수 있게
  useEffect(() => {
    let list = BASE_CATS, pick = BASE_CATS[0]
    try {
      const prof = localStorage.getItem(PROFILE_CAT_KEY)
      if (prof && !list.includes(prof)) list = [prof, ...list]
      const saved = localStorage.getItem(CAT_KEY)
      pick = saved && (list.includes(saved) || saved === DRAW) ? saved : list[0]
    } catch {}
    setCats(list); setCat(pick); setColors(loadColors()); setSound(waxSoundOn())
  }, [])

  // 장면 소식: 부순 정도
  useEffect(() => {
    const on = e => { if (e.origin === window.location.origin && e.data?.wax === 'progress') setProg({ pct: e.data.pct, per: e.data.per }) }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])

  // 그리기 칸 다시 그리기(고양이 + 선)
  const paint = useCallback(() => {
    const pad = padRef.current; if (!pad || !artRef.current) return
    const g = pad.getContext('2d')
    g.clearRect(0, 0, pad.width, pad.height)
    if (baseRef.current) { g.imageSmoothingEnabled = false; g.drawImage(baseRef.current, 0, 0, pad.width, pad.height); g.imageSmoothingEnabled = true }
    g.drawImage(artRef.current, 0, 0, pad.width, pad.height)
  }, [])

  // 고양이를 바꾸면 그 고양이 그림 + 전에 그려 둔 선
  useEffect(() => {
    if (!cat) return
    try { localStorage.setItem(CAT_KEY, cat) } catch {}
    if (!artRef.current) artRef.current = blank()
    const art = artRef.current
    art.getContext('2d').clearRect(0, 0, ART, ART)
    undoRef.current = []; setUndoN(0)
    baseRef.current = null
    let saved = null
    try { saved = localStorage.getItem(ART_KEY + cat) } catch {}
    if (saved) { const im = new Image(); im.onload = () => { art.getContext('2d').drawImage(im, 0, 0, ART, ART); paint() }; im.src = saved }
    if (cat !== DRAW) { const im = new Image(); im.onload = () => { baseRef.current = im; paint() }; im.src = pixelCatImg(cat) }
    paint()
    toFrame({ wax: 'config' })
  }, [cat, paint, toFrame])

  useEffect(() => { try { localStorage.setItem(COLOR_KEY, JSON.stringify(colors)) } catch {} ; toFrame({ wax: 'colors' }) }, [colors, toFrame])
  useEffect(() => { toFrame({ wax: 'phase', phase: step === 'draw' ? 'pick' : step }); if (step === 'draw') paint() }, [step, toFrame, paint])

  function saveArt() { try { localStorage.setItem(ART_KEY + cat, artRef.current.toDataURL('image/png')) } catch {} }
  function hasDrawing() {
    const d = artRef.current?.getContext('2d').getImageData(0, 0, ART, ART).data
    if (!d) return false
    for (let i = 3; i < d.length; i += 16) if (d[i] > 10) return true
    return false
  }
  function goStep(k) {
    if ((k === 'coat' || k === 'crush') && cat === DRAW && !hasDrawing()) { setStep('draw'); say('먼저 캐릭터를 그려 주세요 ✏️'); return }
    if (step === 'draw' && k !== 'draw') toFrame({ wax: 'config' }) // 그린 모양으로 3D 를 다시 짓는다
    unlockWaxSound()
    if (k === 'crush') say('잡고 구부리거나 비틀어 부숴요 · 톡 = 금')
    setStep(k)
  }

  // ── 그리기 칸 ──
  const ptr = useRef(null)
  function padXY(e) { const r = padRef.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * ART, (e.clientY - r.top) / r.height * ART] }
  function seg(a, b) {
    const g = artRef.current.getContext('2d')
    g.save()
    g.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'
    g.strokeStyle = pen; g.lineWidth = size * (eraser ? 1.6 : 1); g.lineCap = 'round'; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] + 0.01, b[1]); g.stroke()
    g.restore(); paint()
  }
  function padDown(e) {
    unlockWaxSound()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const g = artRef.current.getContext('2d')
    undoRef.current.push(g.getImageData(0, 0, ART, ART)); if (undoRef.current.length > 20) undoRef.current.shift()
    setUndoN(undoRef.current.length)
    const p = padXY(e); seg(p, p); ptr.current = p
  }
  function padMove(e) {
    if (!ptr.current) return
    const p = padXY(e), d = Math.hypot(p[0] - ptr.current[0], p[1] - ptr.current[1])
    if (d < 2) return
    seg(ptr.current, p); scribble(Math.min(1, d / 60)); ptr.current = p
  }
  function padUp() { if (ptr.current) saveArt(); ptr.current = null }
  function undoDraw() { const im = undoRef.current.pop(); if (!im) return; artRef.current.getContext('2d').putImageData(im, 0, 0); setUndoN(undoRef.current.length); paint(); saveArt() }
  function clearDraw() { const g = artRef.current.getContext('2d'); undoRef.current.push(g.getImageData(0, 0, ART, ART)); setUndoN(undoRef.current.length); g.clearRect(0, 0, ART, ART); paint(); saveArt() }

  function setStageColor(i, key) { setColors(prev => { const n = [...prev]; n[i] = key; return n }) }
  function toggleSound() { const v = !sound; setWaxSound(v); setSound(v); if (v) { unlockWaxSound(); squish() } }

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
          <div className={s.meterRow}><span>부순 정도</span><b>{prog.pct}%</b></div>
          <div className={s.bar}><i style={{ width: `${prog.pct}%` }} /></div>
          <div className={s.stageDots}>
            {prog.per.map((p, i) => (
              <span key={i} className={`${s.dot} ${p.left === 0 ? s.done : i === curStage ? s.now : ''}`} style={{ '--wc': waxColor(colors[i]).c }}>{i + 1}단계</span>
            ))}
          </div>
        </div>
      )}

      <div className={s.stage}>
        <iframe ref={frameRef} src="/wax-squish/index.html" title="왁뿌 3D" className={s.frame}
          onLoad={() => { toFrame({ wax: 'config' }); toFrame({ wax: 'phase', phase: step === 'draw' ? 'pick' : step }) }} />
        {step === 'draw' && (
          <div className={s.padWrap}>
            <canvas ref={padRef} width={ART} height={ART} className={s.pad}
              onPointerDown={padDown} onPointerMove={padMove} onPointerUp={padUp} onPointerCancel={padUp} onContextMenu={e => e.preventDefault()}
              aria-label="그림 그리기" />
          </div>
        )}
        {toast && <div className={s.toast}>{toast}</div>}
      </div>

      <section className={s.panel}>
        {step === 'pick' && (
          <>
            <div className={s.hint}>3D 말랑이로 만들 얼굴을 골라요</div>
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
            <button className={s.primary} onClick={() => goStep('draw')}>{cat === DRAW ? '그리러 가기 →' : '그림 그리기 →'}</button>
          </>
        )}

        {step === 'draw' && (
          <>
            <div className={s.hint}>{cat === DRAW ? '칸 안에 내 캐릭터를 그려요 · 그린 모양 그대로 3D 말랑이가 돼요' : '고양이 얼굴 위에 그려 꾸며요'}</div>
            <div className={s.pens}>
              {PENS.map(c => (
                <button key={c} className={`${s.pen} ${!eraser && pen === c ? s.penOn : ''}`} style={{ '--pc': c }}
                  onClick={() => { setPen(c); setEraser(false) }} aria-label={`펜 색 ${c}`} aria-pressed={!eraser && pen === c} />
              ))}
            </div>
            <div className={s.tools}>
              {SIZES.map(([t, v]) => (
                <button key={v} className={`${s.tool} ${size === v ? s.toolOn : ''}`} onClick={() => setSize(v)} aria-pressed={size === v}>
                  <i style={{ width: Math.max(4, v / 3), height: Math.max(4, v / 3) }} />{t}
                </button>
              ))}
              <button className={`${s.tool} ${eraser ? s.toolOn : ''}`} onClick={() => setEraser(v => !v)} aria-pressed={eraser}>🧽 지우개</button>
            </div>
            <div className={s.row} style={{ marginBottom: 8 }}>
              <button className={s.ghost} onClick={undoDraw} disabled={!undoN}>↩ 되돌리기</button>
              <button className={s.ghost} onClick={clearDraw}>다 지우기</button>
            </div>
            <div className={s.row}>
              <button className={s.ghost} onClick={() => goStep('pick')}>← 얼굴</button>
              <button className={s.primary} onClick={() => goStep('coat')}>왁스 입히기 →</button>
            </div>
          </>
        )}

        {step === 'coat' && (
          <>
            <div className={s.hint}>세 겹으로 입혀요 · 1단계가 가장 바깥이에요</div>
            <div className={s.stageTabs}>
              {Array.from({ length: STAGES }, (_, i) => (
                <button key={i} className={`${s.stageTab} ${stageTab === i ? s.on : ''}`} onClick={() => setStageTab(i)} style={{ '--wc': waxColor(colors[i]).c }}>
                  <i />{i + 1}단계
                </button>
              ))}
            </div>
            <ColorChips value={colors[stageTab]} onPick={k => setStageColor(stageTab, k)} />
            <div className={s.row}>
              <button className={s.ghost} onClick={() => goStep('draw')}>← 그리기</button>
              <button className={s.primary} onClick={() => goStep('crush')}>파삭 부수기 →</button>
            </div>
          </>
        )}

        {step === 'crush' && (
          <>
            <div className={s.hint}>{allDone ? '다 부쉈어요! 「원래대로」로 다시 입혀요' : '잡고 구부리기 · 가장자리 위아래 = 비틀기 · 두 손가락 꾹 · 톡 = 금'}</div>
            {!allDone && (
              <>
                <div className={s.subHint}>지금 {curStage + 1}단계 색 바꾸기</div>
                <ColorChips value={colors[curStage]} onPick={k => setStageColor(curStage, k)} />
              </>
            )}
            <div className={s.row}>
              <button className={s.ghost} onClick={() => goStep('coat')}>색 다시 고르기</button>
              <button className={s.primary} onClick={() => toFrame({ wax: 'reset' })}>↺ 원래대로</button>
            </div>
          </>
        )}
      </section>

      {picker && <HomeModePicker onClose={() => setPicker(false)} sheet />}
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
