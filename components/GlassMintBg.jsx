'use client'
// 글라스 민트 전용 앰비언트 배경 — 페이지 뒤(z-index:-1)에 고정.
//
// ⚠️ 빛 번짐은 반드시 '앱 열(중앙 390px)' 기준으로 배치할 것.
//    화면 가장자리에 두면 앱이 가운데 정렬이라 카드 뒤가 텅 비고, 아무리 반투명하게 만들어도
//    흰색만 비쳐 유리 느낌이 통째로 사라진다(실제로 그렇게 만들어 봤다가 교정).
// ⚠️ 번짐은 고정 배경으로만 — 카드마다 넣으면 스크롤이 버벅인다.
const B = [
  { top: -60, left: -70, size: 320, c: 'rgba(126,203,180,0.95)', blur: 26 },   // 좌상 민트
  { top: 90, right: -70, size: 300, c: 'rgba(243,175,185,0.85)', blur: 26 },   // 우상 블러시
  { top: 400, left: -50, size: 300, c: 'rgba(150,211,192,0.8)', blur: 28 },    // 좌중 민트
  { bottom: 60, right: -60, size: 300, c: 'rgba(196,226,158,0.7)', blur: 28 }, // 우하 연둣빛
  { bottom: 230, left: 30, size: 250, c: 'rgba(243,175,185,0.6)', blur: 30 },  // 중앙 하단 블러시
]

export default function GlassMintBg() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden', background: '#F5F1E8' }}>
      {/* 앱 열과 같은 폭·같은 중앙 정렬 — 번짐이 항상 카드 뒤에 오도록 */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 390, height: '100%', margin: '0 auto' }}>
        {B.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', top: b.top, bottom: b.bottom, left: b.left, right: b.right,
            width: b.size, height: b.size, borderRadius: '50%',
            background: `radial-gradient(circle, ${b.c}, transparent 66%)`, filter: `blur(${b.blur}px)`,
          }} />
        ))}
      </div>
      {/* 전체를 살짝 덮어 대비를 고르게 — 글자 가독성 보정 */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(247,243,235,0.1)' }} />
    </div>
  )
}
