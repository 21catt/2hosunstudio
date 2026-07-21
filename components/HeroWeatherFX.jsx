'use client'
import { useEffect, useRef } from 'react'

// 홈 히어로 카드("수업 예약, 여기서 시작") 안 날씨 인터랙션.
// - open-meteo weather_code → 맑음/흐림/비/눈 4모드(없으면 렌더 안 함)
// - 배경 위에 현재 테마색(--ac/--ac2)이 살짝 겹친다(hwfx-tint, ~17%)
// - 맑음: 회전 햇살+번짐 일렁임 / 흐림: 부드러운 구름 / 비: 불규칙 빗줄기 / 눈: 크기대비 눈송이
// 레이어: ambient(zIndex 0, 텍스트 뒤) + 파티클 canvas(zIndex 2, 텍스트 앞). 히어로는 position:relative + overflow:hidden 필요.
export function weatherMode(code) {
  if (code == null) return null
  if (code === 0 || code === 1) return 'sunny'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain'
  return 'cloudy' // 2·3(구름) · 45·48(안개) 등
}

export default function HeroWeatherFX({ code }) {
  const mode = weatherMode(code)
  const cvRef = useRef(null)

  useEffect(() => {
    if (mode !== 'rain' && mode !== 'snow') return
    const cv = cvRef.current
    if (!cv) return
    // 모션 최소화 설정이면 비/눈 파티클 애니메이션 생략(배경 틴트는 유지)
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = cv.getContext('2d')
    const rnd = Math.random
    let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now(), parts = []
    const drop = seed => ({ x: rnd() * W, y: seed ? rnd() * H : -20 - rnd() * 40, len: 9 + rnd() * 16, spd: 5.5 + rnd() * 6.5, op: 0.14 + rnd() * 0.32 })
    const flake = seed => { const r = 1.2 + rnd() * 3.4; return { x: rnd() * W, y: seed ? rnd() * H : -8 - rnd() * 30, r, spd: 0.45 + r * 0.4, ph: rnd() * 6.28, amp: 6 + rnd() * 15, dph: 0.008 + rnd() * 0.02, op: 0.5 + rnd() * 0.45 } }
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = cv.getBoundingClientRect()
      W = r.width; H = r.height
      cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = mode === 'rain' ? Math.round(W * 0.34) : Math.round(W * 0.22)
      parts = Array.from({ length: n }, () => (mode === 'rain' ? drop(true) : flake(true)))
    }
    function frame(t) {
      const dt = Math.min(48, t - last) / 16.67; last = t
      ctx.clearRect(0, 0, W, H)
      if (mode === 'rain') {
        ctx.strokeStyle = '#cfe0f4'; ctx.lineWidth = 1.15; ctx.lineCap = 'round'
        for (const d of parts) {
          d.y += d.spd * dt; d.x += d.spd * 0.14 * dt
          ctx.globalAlpha = d.op
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.14, d.y - d.len); ctx.stroke()
          if (d.y > H + 18) Object.assign(d, drop(false))
        }
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = '#fff'
        for (const f of parts) {
          f.y += f.spd * dt; f.ph += f.dph * dt
          const x = f.x + Math.sin(f.ph) * f.amp
          ctx.globalAlpha = f.op; ctx.shadowColor = 'rgba(255,255,255,.85)'; ctx.shadowBlur = f.r * 1.6
          ctx.beginPath(); ctx.arc(x, f.y, f.r, 0, 6.2832); ctx.fill()
          if (f.y > H + 8) Object.assign(f, flake(false))
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(frame)
    }
    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [mode])

  if (!mode) return null

  return (
    <>
      <div className={`hwfx hwfx-${mode}`} aria-hidden="true"
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit' }}>
        <div className="hwfx-tint" />
        {mode === 'sunny' && (<><div className="hwfx-sunglow" /><div className="hwfx-rays" /><div className="hwfx-sun" /></>)}
        {mode === 'cloudy' && (
          <div className="hwfx-clouds">
            <span className="hwfx-cloud" style={{ top: '20%', width: '38%', height: '46%', animationDuration: '24s', animationDelay: '-4s' }} />
            <span className="hwfx-cloud" style={{ top: '50%', width: '52%', height: '58%', animationDuration: '34s', animationDelay: '-18s' }} />
            <span className="hwfx-cloud" style={{ top: '4%', width: '28%', height: '34%', animationDuration: '28s', animationDelay: '-11s' }} />
          </div>
        )}
        <div className="hwfx-haze" />
      </div>
      {(mode === 'rain' || mode === 'snow') && (
        <canvas ref={cvRef} aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }} />
      )}
    </>
  )
}
