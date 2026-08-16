'use client'
// 리퀴드 글라스 전용 앰비언트 배경 — 페이지 뒤(z-index:-1)에 고정.
//
// ⚠️ 빛 번짐은 반드시 '앱 열(중앙 390px)' 기준으로 배치할 것.
//    화면 가장자리에 두면 앱이 가운데 정렬이라 카드 뒤가 텅 비고, 아무리 반투명하게 만들어도
//    흰색만 비쳐 유리 느낌이 통째로 사라진다(글라스 민트에서 겪고 교정한 것).
// ⚠️ 번짐은 고정 배경으로만 — 카드마다 넣으면 스크롤이 버벅인다.
const B = [
  { top: -50, left: -80, size: 300, c: 'rgba(167,139,250,0.95)', blur: 28 },   // 좌상 보라
  { top: 120, right: -70, size: 280, c: 'rgba(244,164,214,0.85)', blur: 28 },  // 우상 핑크
  { top: 420, left: -60, size: 290, c: 'rgba(110,231,214,0.8)', blur: 30 },    // 좌중 청록
  { bottom: 120, right: -60, size: 300, c: 'rgba(167,139,250,0.8)', blur: 30 },// 우하 보라
  { bottom: 20, left: 20, size: 250, c: 'rgba(244,164,214,0.7)', blur: 32 },   // 하단 핑크
]

export default function LiquidGlassBg() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden', background: '#EAE7F0' }}>
      {/* 앱 열과 같은 폭·중앙 정렬 — 번짐이 항상 카드 뒤에 오도록 */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 390, height: '100%', margin: '0 auto' }}>
        {B.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', top: b.top, bottom: b.bottom, left: b.left, right: b.right,
            width: b.size, height: b.size, borderRadius: '50%',
            background: `radial-gradient(circle, ${b.c}, transparent 66%)`, filter: `blur(${b.blur}px)`,
          }} />
        ))}
      </div>
      {/* 레퍼런스의 사선 광선 — 화면을 가로지르는 빛줄기 */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(75deg, transparent 42%, rgba(255,255,255,0.35) 50%, transparent 60%)' }} />
      {/* 전체를 살짝 덮어 대비를 고르게 — 글자 가독성 보정 */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(238,235,244,0.12)' }} />
    </div>
  )
}
