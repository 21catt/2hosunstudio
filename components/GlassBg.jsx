'use client'
// 싱그러운(fresh) 여름 스킨 전용 앰비언트 블롭 배경 — 페이지 뒤(z-index:-1)에 고정.
// 페이지 콘텐츠 래퍼의 배경을 투명으로 두면 이 블롭이 비쳐 보인다.
const B = [
  { top: -60, left: -40, size: 320, c: 'rgba(148,198,232,0.7)', blur: 20 },
  { top: 180, right: -90, size: 300, c: 'rgba(130,150,60,0.42)', blur: 20 },
  { bottom: 40, left: -70, size: 300, c: 'rgba(96,110,45,0.48)', blur: 24 },
  { bottom: 220, right: -60, size: 240, c: 'rgba(190,195,210,0.55)', blur: 22 },
]

export default function GlassBg() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden', background: '#dfeaf2' }}>
      {B.map((b, i) => (
        <div key={i} style={{ position: 'absolute', top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.size, height: b.size, borderRadius: '50%', background: `radial-gradient(circle, ${b.c}, transparent 65%)`, filter: `blur(${b.blur}px)` }} />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(230,240,245,0.35)' }} />
    </div>
  )
}
