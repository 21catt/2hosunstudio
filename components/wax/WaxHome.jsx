'use client'
// 「왁뿌」 메인 홈 — 고양이 얼굴을 고르고(1) 왁스 3겹 색을 입혀(2) 손으로 파삭 부순다(3).
//   · 부순 정도 % · 단계(겹)마다 색 바꾸기 · 「원래대로」 = 왁스를 다시 입힌다
//   · 소리 = lib/waxSound(Web Audio 합성) · 진동 = navigator.vibrate(있는 기기만)
//   · 모바일 터치가 주 환경 — 손가락이 조금 빗나가도 가까운 조각이 깨지고, 끌면 지나간 자리가 깨진다
//   · 메인 화면 고르기(3D 홈 · 왁뿌 · 예전 홈) = HomeModePicker
import { useEffect, useRef, useState, useCallback } from 'react'
import { WaxEngine, WAX_COLORS, DEFAULT_WAX, STAGES, waxColor } from '../../lib/waxEngine'
import { crack, squish, coat, clear, buzz, unlockWaxSound, waxSoundOn, setWaxSound } from '../../lib/waxSound'
import { pixelCatImg, PROFILE_CAT_KEY } from '../../lib/pixelCats'
import HomeModePicker from './HomeModePicker'
import s from './wax.module.css'

const CAT_KEY = '2hs_wax_cat'
const COLOR_KEY = '2hs_wax_colors'
const BASE_CATS = ['09-cat', '01-happy', '07-laugh']

function loadColors() {
  try {
    const v = JSON.parse(localStorage.getItem(COLOR_KEY) || 'null')
    if (Array.isArray(v) && v.length === STAGES && v.every(k => WAX_COLORS.some(w => w.key === k))) return v
  } catch {}
  return [...DEFAULT_WAX]
}

export default function WaxHome({ user }) {
  const [step, setStep] = useState('pick') // pick → coat → crush
  const [cats, setCats] = useState(BASE_CATS)
  const [cat, setCat] = useState(BASE_CATS[0])
  const [colors, setColors] = useState(DEFAULT_WAX)
  const [stageTab, setStageTab] = useState(0) // 색을 고르는 단계(0 = 1단계 바깥)
  const [prog, setProg] = useState({ pct: 0, per: [] })
  const [sound, setSound] = useState(true)
  const [toast, setToast] = useState('')
  const [picker, setPicker] = useState(false)
  const wrapRef = useRef(null), cvRef = useRef(null), engRef = useRef(null), imgRef = useRef(null)
  const toastT = useRef(0)
  const colorsRef = useRef(colors), stepRef = useRef(step)
  useEffect(() => { colorsRef.current = colors; stepRef.current = step }, [colors, step])

  // 저장된 고양이·색 · 프로필 고양이도 고를 수 있게
  useEffect(() => {
    let list = BASE_CATS
    try {
      const prof = localStorage.getItem(PROFILE_CAT_KEY)
      if (prof && !list.includes(prof)) list = [prof, ...list]
      const saved = localStorage.getItem(CAT_KEY)
      setCat(saved && list.includes(saved) ? saved : list[0])
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
        setTimeout(() => say(n < STAGES ? `${n}단계 다 깼어요! 다음 겹으로` : '고양이가 나왔어요 🐾'), 60)
      },
      onProgress: setProg,
    })
    engRef.current = eng
    if (process.env.NODE_ENV === 'development') window.__wax = eng // 개발 중 확인용
    return () => eng.stop()
  }, [say])

  // 고양이 그림 불러와 짓기(크기 바뀌면 다시)
  const rebuild = useCallback(() => {
    const eng = engRef.current, wrap = wrapRef.current, img = imgRef.current
    if (!eng || !wrap || !img || !img.complete || !img.naturalWidth) return
    const w = wrap.clientWidth
    const h = Math.round(Math.min(w * 1.0, Math.max(300, window.innerHeight * 0.52)))
    eng.setColors(colorsRef.current)
    eng.showWax = stepRef.current !== 'pick'
    eng.build(img, w, h, Math.min(2, window.devicePixelRatio || 1))
  }, [])

  useEffect(() => {
    const img = new Image()
    img.src = pixelCatImg(cat)
    imgRef.current = img
    img.onload = () => rebuild()
    try { localStorage.setItem(CAT_KEY, cat) } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat])

  useEffect(() => {
    let lastW = wrapRef.current?.clientWidth || 0
    const ro = new ResizeObserver(() => {
      const nw = wrapRef.current?.clientWidth || 0
      if (Math.abs(nw - lastW) > 30) { lastW = nw; rebuild() }
    })
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [rebuild])

  useEffect(() => { engRef.current?.setShowWax(step !== 'pick') }, [step])

  useEffect(() => {
    engRef.current?.setColors(colors)
    try { localStorage.setItem(COLOR_KEY, JSON.stringify(colors)) } catch {}
  }, [colors])

  // ── 손 입력: 탭 = 파삭 · 끌기 = 지나간 자리 · 꾹 = 말랑 눌렀다 한꺼번에 ──
  const ptr = useRef(null)
  const local = (e) => { const r = cvRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  function onDown(e) {
    unlockWaxSound()
    const eng = engRef.current
    if (!eng) return
    if (step !== 'crush') { // 부수기 전에는 눌러도 말랑하게만
      eng.squash.v -= 0.06; squish(); return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const [x, y] = local(e)
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
    if (!p || !eng || step !== 'crush') return
    const [x, y] = local(e)
    const d = Math.hypot(x - p.x, y - p.y)
    p.moved += d
    if (d > 20) { eng.hit(x, y, 0.55); p.x = x; p.y = y }
  }
  function onUp() { if (ptr.current) clearTimeout(ptr.current.timer); ptr.current = null }

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
        {[['pick', '고양이'], ['coat', '왁스 색'], ['crush', '파삭']].map(([k, t], i) => (
          <button key={k} role="tab" aria-selected={step === k} className={`${s.step} ${step === k ? s.on : ''}`} onClick={() => setStep(k)}>
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
      <div ref={wrapRef} className={s.stage}>
        <canvas ref={cvRef} className={s.cv}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
          onContextMenu={e => e.preventDefault()} aria-label="왁스를 눌러 부수기" />
        {toast && <div className={s.toast}>{toast}</div>}
      </div>

      <section className={s.panel}>
        {step === 'pick' && (
          <>
            <div className={s.hint}>왁스로 감쌀 고양이 얼굴을 골라요</div>
            <div className={s.cats}>
              {cats.map(k => (
                <button key={k} className={`${s.catBtn} ${cat === k ? s.catOn : ''}`} onClick={() => { setCat(k); unlockWaxSound(); squish() }} aria-pressed={cat === k} aria-label={`고양이 ${k}`}>
                  <img src={pixelCatImg(k)} alt="" width={56} height={56} />
                </button>
              ))}
            </div>
            <button className={s.primary} onClick={() => { setStep('coat'); unlockWaxSound(); coat() }}>왁스 색 고르기 →</button>
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
              <button className={s.ghost} onClick={() => setStep('pick')}>← 고양이</button>
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
