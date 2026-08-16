'use client'
// 글라스 민트 전용 앰비언트 배경 — 페이지 뒤(z-index:-1)에 고정.
// 유리판이 비쳐 보이려면 뒤에 색이 있어야 한다. 크림 바탕 + 민트·블러시 빛 번짐.
// ⚠️ 번짐은 화면당 4개까지·고정 배경으로만 둔다(카드마다 넣으면 스크롤이 버벅인다).
const B = [
  { top: -70, left: -60, size: 320, c: 'rgba(143,208,188,0.62)', blur: 26 },
  { top: 210, right: -80, size: 300, c: 'rgba(240,185,193,0.55)', blur: 26 },
  { bottom: 60, left: -70, size: 300, c: 'rgba(169,217,201,0.5)', blur: 28 },
  { bottom: 250, right: -60, size: 240, c: 'rgba(201,227,168,0.4)', blur: 28 },
]

export default function GlassMintBg() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden', background: '#F5F1E8' }}>
      {B.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          width: b.size, height: b.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${b.c}, transparent 66%)`, filter: `blur(${b.blur}px)`,
        }} />
      ))}
      {/* 전체를 살짝 덮어 대비를 고르게 — 글자 가독성 보정 */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(247,243,235,0.28)' }} />
    </div>
  )
}
