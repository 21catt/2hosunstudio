'use client'
// 3D 홈 「장면」 패널의 왁뿌 설정 — 해변·우리 스튜디오처럼 홈 화면 안에서 전부(2026-11-07 사용자 지시 — 따로 화면·메인 고르기 없음).
//   · 얼굴(고양이 · 직접 그리기) · 그리기(홈 위 시트) · 왁스 3겹 색 · 부서지는 세기 · 원래대로 · 부순 정도
//   · 설정은 같은 출처 localStorage(2hs_wax_cat · 2hs_wax_art_<고양이> · 2hs_wax_colors · 2hs_wax_power) — 바뀌면 장면(iframe)에 알린다
import { useCallback, useEffect, useRef, useState } from 'react'
import { pixelCatImg, PROFILE_CAT_KEY } from '../../lib/pixelCats'
import { scribble, unlockWaxSound } from '../../lib/waxSound'

export const WAX_COLORS = [
  { key: 'clear', name: '투명', c: '#f3efe6' }, { key: 'milk', name: '우유', c: '#fff6e8' }, { key: 'butter', name: '버터', c: '#f6d877' },
  { key: 'pink', name: '핑크', c: '#f5a6c3' }, { key: 'sky', name: '하늘', c: '#a3d1f2' }, { key: 'mint', name: '민트', c: '#a6e2c4' },
  { key: 'lavender', name: '라벤더', c: '#c7b4f1' }, { key: 'peach', name: '복숭아', c: '#f8bc98' }, { key: 'cocoa', name: '코코아', c: '#b4896b' },
]
const DEFAULT_WAX = ['clear', 'clear', 'clear'] // 1단계(바깥) · 2단계 · 3단계(안쪽) — 자료처럼 투명 왁스
const CAT_KEY = '2hs_wax_cat', COLOR_KEY = '2hs_wax_colors', ART_KEY = '2hs_wax_art_', POWER_KEY = '2hs_wax_power'
const BEAR = 'bear' // 왁뿌 곰 = 자료 사진의 크림색 곰 판(기본)
const BASE_CATS = [BEAR, '09-cat', '01-happy', '07-laugh']
// 곰 얼굴 그림(그리기 시트 바탕·고르기 칸) — 장면(public/wax-squish bearCanvas)과 같은 모양
const BEAR_SVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="#efd99c"><circle cx="256" cy="300" r="176"/><circle cx="140" cy="128" r="78"/><circle cx="372" cy="128" r="78"/></g></svg>')
const faceImg = k => k === BEAR ? BEAR_SVG : pixelCatImg(k)
const DRAW = 'draw'
const ART = 512
const PENS = ['#2b2433', '#ffffff', '#e8434f', '#f59a2b', '#f6d24a', '#4cb86e', '#3f7fe0', '#f58ab8', '#8a5cd6', '#8b5a3c']
const SIZES = [['가늘게', 10], ['보통', 22], ['굵게', 44]]
export const DEFAULT_POWER = 0.5

function loadColors() {
  try {
    const v = JSON.parse(localStorage.getItem(COLOR_KEY) || 'null')
    if (Array.isArray(v) && v.length === 3 && v.every(k => WAX_COLORS.some(w => w.key === k))) return v
  } catch {}
  return [...DEFAULT_WAX]
}
const powerWord = p => p < 0.2 ? '살살' : p < 0.45 ? '사각' : p < 0.7 ? '파삭' : p < 0.9 ? '와삭' : '와장창'

export default function WaxScenePanel({ s, send }) {
  const [cats, setCats] = useState(BASE_CATS)
  const [cat, setCat] = useState(null)
  const [colors, setColors] = useState(DEFAULT_WAX)
  const [layer, setLayer] = useState(0)
  const [power, setPower] = useState(DEFAULT_POWER)
  const [prog, setProg] = useState(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    let list = BASE_CATS, pick = BASE_CATS[0], pw = DEFAULT_POWER
    try {
      // 장면과 같은 한 번 옮기기 — 옛 기본(고양이 09 · 하늘·핑크·버터)이면 자료 기본(곰 · 투명)으로
      if (!localStorage.getItem('2hs_wax_v2')) {
        localStorage.setItem('2hs_wax_v2', '1')
        if ((localStorage.getItem(CAT_KEY) || '09-cat') === '09-cat') localStorage.setItem(CAT_KEY, BEAR)
        const oc = localStorage.getItem(COLOR_KEY); if (!oc || oc === '["sky","pink","butter"]') localStorage.setItem(COLOR_KEY, JSON.stringify(DEFAULT_WAX))
      }
      const prof = localStorage.getItem(PROFILE_CAT_KEY)
      if (prof && !list.includes(prof)) list = [prof, ...list]
      const saved = localStorage.getItem(CAT_KEY)
      pick = saved && (list.includes(saved) || saved === DRAW) ? saved : list[0]
      const p = parseFloat(localStorage.getItem(POWER_KEY))
      if (Number.isFinite(p)) pw = Math.max(0, Math.min(1, p))
    } catch {}
    setCats(list); setCat(pick); setColors(loadColors()); setPower(pw)
  }, [])
  useEffect(() => {
    const on = e => { if (e.origin === window.location.origin && e.data?.wax === 'progress') setProg(e.data) }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])

  function pickCat(k) {
    setCat(k)
    try { localStorage.setItem(CAT_KEY, k) } catch {}
    send({ wax: 'config' })
    if (k === DRAW) { let has = false; try { has = !!localStorage.getItem(ART_KEY + DRAW) } catch {} ; if (!has) setDrawing(true) }
  }
  function pickColor(key) {
    setColors(prev => {
      const n = [...prev]; n[layer] = key
      try { localStorage.setItem(COLOR_KEY, JSON.stringify(n)) } catch {}
      send({ wax: 'colors' })
      return n
    })
  }
  function changePower(v) {
    setPower(v)
    try { localStorage.setItem(POWER_KEY, String(v)) } catch {}
    send({ wax: 'power', v })
  }

  const chip = on => `${s.chip} ${s.glass} ${on ? s.chipOn : ''}`
  const allDone = prog?.per?.length && prog.per.every(p => p.left === 0)

  return (<>
    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>얼굴</div>
    <div className={s.row} style={{ flexWrap: 'wrap', gap: 6 }}>
      {cats.map(k => (
        <button key={k} className={chip(cat === k)} aria-pressed={cat === k} aria-label={k === BEAR ? '왁뿌 곰' : `고양이 ${k}`} onClick={() => pickCat(k)}
          style={{ padding: 3, width: 44, height: 44, display: 'grid', placeItems: 'center' }}>
          <img src={faceImg(k)} alt="" width={36} height={36} style={{ imageRendering: k === BEAR ? 'auto' : 'pixelated' }} />
        </button>
      ))}
      <button className={chip(cat === DRAW)} aria-pressed={cat === DRAW} onClick={() => pickCat(DRAW)} style={{ height: 44 }}>✏️ 직접 그리기</button>
    </div>
    <button className={`${s.chip} ${s.glass}`} onClick={() => { unlockWaxSound(); setDrawing(true) }}>
      {cat === DRAW ? '✏️ 내 캐릭터 그리기' : cat === BEAR ? '✏️ 곰 위에 그려 꾸미기' : '✏️ 얼굴 위에 그려 꾸미기'}
    </button>

    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>왁스 색 · 1단계가 가장 바깥</div>
    <div className={s.row} style={{ gap: 6 }}>
      {[0, 1, 2].map(i => {
        const w = WAX_COLORS.find(x => x.key === colors[i]) || WAX_COLORS[1]
        return (
          <button key={i} className={chip(layer === i)} aria-pressed={layer === i} onClick={() => setLayer(i)}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: w.c, marginRight: 5, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }} />{i + 1}단계
          </button>
        )
      })}
    </div>
    <div className={s.row} style={{ flexWrap: 'wrap', gap: 5 }}>
      {WAX_COLORS.map(w => (
        <button key={w.key} aria-label={`${layer + 1}단계 ${w.name}`} aria-pressed={colors[layer] === w.key} onClick={() => pickColor(w.key)}
          style={{ width: 28, height: 28, borderRadius: 14, border: colors[layer] === w.key ? '2.5px solid #2b2433' : '1.5px solid rgba(43,36,51,0.15)',
            background: w.c, opacity: w.key === 'clear' ? 0.7 : 1, cursor: 'pointer', padding: 0 }} />
      ))}
    </div>

    <label className={s.slider}>부서지는 세기 · {powerWord(power)}
      <input type="range" min="0" max="1" step="0.01" value={power} onChange={e => changePower(+e.target.value)} style={{ accentColor: '#e0a24a' }}
        aria-label="부서지는 세기 — 살살부터 와장창까지" />
    </label>
    <div style={{ fontSize: 11, opacity: 0.7, marginTop: -4 }}>살살 = 여러 번 구부려야 금이 가요 · 와장창 = 톡 한 번에 크게 터져요</div>

    <div className={s.row}>
      <button className={`${s.chip} ${s.glass}`} onClick={() => send({ wax: 'reset' })}>↺ 원래대로</button>
      {prog && <span style={{ fontSize: 12, alignSelf: 'center', opacity: 0.8 }}>{allDone ? '다 부쉈어요 🐾' : `부순 정도 ${prog.pct}%`}</span>}
    </div>

    {drawing && cat && <WaxDrawSheet cat={cat} onClose={() => { setDrawing(false); send({ wax: 'config' }) }} />}
  </>)
}

// 그리기 — 홈 화면 위 시트(장면은 뒤에 그대로). 닫으면 그린 모양으로 3D 를 다시 짓는다.
function WaxDrawSheet({ cat, onClose }) {
  const padRef = useRef(null), artRef = useRef(null), baseRef = useRef(null), undoRef = useRef([]), ptr = useRef(null)
  const [pen, setPen] = useState(PENS[0])
  const [size, setSize] = useState(22)
  const [eraser, setEraser] = useState(false)
  const [undoN, setUndoN] = useState(0)

  const paint = useCallback(() => {
    const pad = padRef.current; if (!pad || !artRef.current) return
    const g = pad.getContext('2d')
    g.clearRect(0, 0, pad.width, pad.height)
    if (baseRef.current) { g.imageSmoothingEnabled = cat === BEAR; g.drawImage(baseRef.current, 0, 0, pad.width, pad.height); g.imageSmoothingEnabled = true }
    g.drawImage(artRef.current, 0, 0, pad.width, pad.height)
  }, [cat])
  useEffect(() => {
    const art = document.createElement('canvas'); art.width = art.height = ART; artRef.current = art
    let saved = null; try { saved = localStorage.getItem(ART_KEY + cat) } catch {}
    if (saved) { const im = new Image(); im.onload = () => { art.getContext('2d').drawImage(im, 0, 0, ART, ART); paint() }; im.src = saved }
    if (cat !== DRAW) { const im = new Image(); im.onload = () => { baseRef.current = im; paint() }; im.src = faceImg(cat) }
    paint()
  }, [cat, paint])

  const save = () => { try { localStorage.setItem(ART_KEY + cat, artRef.current.toDataURL('image/png')) } catch {} }
  const xy = e => { const r = padRef.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * ART, (e.clientY - r.top) / r.height * ART] }
  function seg(a, b) {
    const g = artRef.current.getContext('2d')
    g.save(); g.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'
    g.strokeStyle = pen; g.lineWidth = size * (eraser ? 1.6 : 1); g.lineCap = 'round'; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] + 0.01, b[1]); g.stroke(); g.restore(); paint()
  }
  function down(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const g = artRef.current.getContext('2d')
    undoRef.current.push(g.getImageData(0, 0, ART, ART)); if (undoRef.current.length > 20) undoRef.current.shift(); setUndoN(undoRef.current.length)
    const p = xy(e); seg(p, p); ptr.current = p
  }
  function move(e) { if (!ptr.current) return; const p = xy(e), d = Math.hypot(p[0] - ptr.current[0], p[1] - ptr.current[1]); if (d < 2) return; seg(ptr.current, p); scribble(Math.min(1, d / 60)); ptr.current = p }
  function up() { if (ptr.current) save(); ptr.current = null }
  function undo() { const im = undoRef.current.pop(); if (!im) return; artRef.current.getContext('2d').putImageData(im, 0, 0); setUndoN(undoRef.current.length); paint(); save() }
  function clearAll() { const g = artRef.current.getContext('2d'); undoRef.current.push(g.getImageData(0, 0, ART, ART)); setUndoN(undoRef.current.length); g.clearRect(0, 0, ART, ART); paint(); save() }

  const btn = on => ({ minHeight: 34, padding: '0 11px', borderRadius: 999, border: '1px solid rgba(43,36,51,0.12)', background: on ? '#2b2433' : 'rgba(255,255,255,0.9)',
    color: on ? '#fff' : '#2b2433', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' })
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(30,22,40,0.28)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="왁뿌 그리기"
        style={{ width: 'min(420px, 100%)', background: 'rgba(255,250,245,0.97)', borderRadius: '24px 24px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 30px rgba(60,40,80,0.18)', color: '#2b2433', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <b>{cat === DRAW ? '내 캐릭터 그리기' : '얼굴 위에 그리기'}</b>
          <button style={btn(true)} onClick={onClose}>다 그렸어요</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{cat === DRAW ? '그린 모양 그대로 말랑한 3D 가 돼요' : '고양이 얼굴 위에 그려 꾸며요'}</div>
        <canvas ref={padRef} width={ART} height={ART} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onContextMenu={e => e.preventDefault()} aria-label="그림 그리기"
          style={{ width: 'min(300px, 72vw)', aspectRatio: '1', alignSelf: 'center', borderRadius: 18, touchAction: 'none', cursor: 'crosshair',
            background: 'repeating-conic-gradient(#f4eff7 0 25%, #fff 0 50%) 0 0 / 20px 20px', boxShadow: 'inset 0 0 0 1px rgba(43,36,51,0.1)' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {PENS.map(c => (
            <button key={c} aria-label={`펜 색 ${c}`} aria-pressed={!eraser && pen === c} onClick={() => { setPen(c); setEraser(false) }}
              style={{ width: 26, height: 26, borderRadius: 13, background: c, padding: 0, cursor: 'pointer',
                border: !eraser && pen === c ? '2.5px solid #7f6bd6' : '1.5px solid rgba(43,36,51,0.18)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {SIZES.map(([t, v]) => <button key={v} style={btn(size === v && !eraser)} onClick={() => { setSize(v); setEraser(false) }}>{t}</button>)}
          <button style={btn(eraser)} onClick={() => setEraser(v => !v)}>🧽 지우개</button>
          <button style={btn(false)} onClick={undo} disabled={!undoN}>↩</button>
          <button style={btn(false)} onClick={clearAll}>다 지우기</button>
        </div>
      </div>
    </div>
  )
}
