'use client'
// 바로 예약 — 가장 빠른 예약 가능 수업들을 홈 상단에 노출, 원탭 예약.
// slots는 부모(홈)에서 기존 데이터로 계산해 넘긴다: [{ c, s, ds, when, full, remain }]
// glass=true면 싱그러운 글래스 홈에 맞춘 유리 카드.
const DANGER = '#c0392b'
const OK = '#3b6d11'

export default function QuickBookCard({ slots = [], onBook = () => {}, busyKey = null, go = () => {}, glass = false }) {
  if (!slots.length) return null

  const wrap = glass
    ? { borderRadius: 20, padding: '15px 16px', background: 'linear-gradient(150deg, rgba(255,255,255,0.68), rgba(255,255,255,0.42))', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.75)' }
    : { borderRadius: 16, padding: '14px 15px', background: 'var(--surf)', border: '1.5px solid var(--g2)' }
  const titleColor = glass ? '#33402c' : 'var(--td)'
  const subColor = glass ? 'rgba(51,64,44,0.62)' : 'var(--tm)'
  const rowBg = glass ? 'rgba(255,255,255,0.5)' : 'var(--g1)'
  const bookBtn = glass
    ? { background: 'linear-gradient(135deg,#6f9fc9,#4f7fae)', color: '#fff' }
    : { background: 'var(--ac)', color: '#fff' }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: titleColor }}>⚡ 바로 예약</span>
        <span onClick={() => go('/student/calendar')} style={{ fontSize: 11, color: subColor, cursor: 'pointer' }}>전체 일정 →</span>
      </div>

      {slots.map(({ c, s, ds, when, full, remain }) => {
        const busy = busyKey === `${c.id}-${s.id}-${ds}`
        const sig = full ? '마감' : remain <= 1 ? '마감 임박 · 1자리' : remain <= 2 ? `${remain}자리 남음` : `${remain}자리 남음`
        const sigColor = full ? '#9b9b8a' : remain <= 1 ? DANGER : OK
        return (
          <div key={`${c.id}-${s.id}-${ds}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: rowBg, borderRadius: 12, padding: '9px 11px', marginBottom: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: glass ? '#566b1a' : 'var(--acTx)', background: glass ? 'rgba(150,165,46,0.18)' : 'var(--acBg)', borderRadius: 8, padding: '5px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>{when}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: titleColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              <div style={{ fontSize: 10.5, color: sigColor, fontWeight: 700, marginTop: 1 }}>{sig}</div>
            </div>
            {full ? (
              <span style={{ flexShrink: 0, fontSize: 11, color: '#9b9b8a', fontWeight: 700, padding: '7px 4px' }}>마감</span>
            ) : (
              <button disabled={busy} onClick={() => onBook(c, s, ds)}
                style={{ ...bookBtn, flexShrink: 0, border: 'none', borderRadius: 20, padding: '7px 15px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', opacity: busy ? 0.5 : 1 }}>
                {busy ? '예약 중…' : '예약'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
