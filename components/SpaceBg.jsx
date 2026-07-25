'use client'
// 울트라 스페이스 전역 배경 — 성운 블롭 + 반짝이는 별(크기·밝기·주기 다양 + 미세 드리프트).
// GlassBg(fresh)와 같은 역할: position:fixed · pointer-events:none · z-index:-1.
// 페이지에서 {space && <SpaceBg/>}로 마운트(래퍼 배경이 투명해야 보임 — [data-theme=space] .app-shell 투명 처리됨).

// 결정적 별 생성 — 하이드레이션 불일치 방지(모듈 로드 1회, 서버·클라 동일 시드).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260725)
const STARS = Array.from({ length: 76 }, () => {
  const size = 0.8 + rand() * 2.5        // 0.8~3.3px — 크기 콘트라스트
  const bright = 0.32 + rand() * 0.68    // 밝기 콘트라스트
  const top = (rand() * 100).toFixed(2)
  const left = (rand() * 100).toFixed(2)
  const dur = (2.3 + rand() * 4.2).toFixed(2)   // 2.3~6.5s — 리듬
  const delay = (rand() * 6).toFixed(2)
  return { size: size.toFixed(2), bright: bright.toFixed(2), top, left, dur, delay, big: size > 2.5 }
})

export default function SpaceBg() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes spTwinkle{0%,100%{opacity:var(--b);transform:scale(1)}50%{opacity:calc(var(--b)*0.22);transform:scale(0.6)}}
        @keyframes spDrift{from{transform:translateY(0)}to{transform:translateY(-16px)}}
      `}</style>
      {/* 성운 블롭 */}
      <div style={{ position: 'absolute', top: '-8%', left: '-14%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(227,91,166,0.30), transparent 66%)', filter: 'blur(30px)' }} />
      <div style={{ position: 'absolute', top: '26%', right: '-16%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(64,86,196,0.30), transparent 66%)', filter: 'blur(32px)' }} />
      <div style={{ position: 'absolute', bottom: '4%', left: '-12%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,60,180,0.24), transparent 66%)', filter: 'blur(34px)' }} />
      <div style={{ position: 'absolute', bottom: '28%', right: '-10%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,95,34,0.14), transparent 66%)', filter: 'blur(30px)' }} />
      {/* 별밭 — 전체가 미세하게 드리프트 */}
      <div style={{ position: 'absolute', inset: '-24px', animation: 'spDrift 24s ease-in-out infinite alternate' }}>
        {STARS.map((s, i) => (
          <span key={i} style={{
            position: 'absolute', top: `${s.top}%`, left: `${s.left}%`,
            width: `${s.size}px`, height: `${s.size}px`, borderRadius: '50%', background: '#fff',
            '--b': s.bright, opacity: s.bright,
            boxShadow: s.big ? '0 0 6px 1px rgba(255,255,255,0.7)' : 'none',
            animation: `spTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}
