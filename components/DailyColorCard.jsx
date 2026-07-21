'use client'
// 오늘의 색 — 홈(공지 위)에 매일 순차로 바뀌는 배색 추천.
// "컬러휠로 열기" = 전역 PaletteFab에 open-palette 이벤트를 보내 그 색으로 삼색 도구를 연다.
// (저장은 PaletteFab의 기존 저장 경로를 그대로 타서 색 계획 카드로 기록에 남는다)
import { getDailyColor, toPlannerInitial } from '../lib/dailyColors'

export default function DailyColorCard({ glass = false, square = false, onOpen = null }) {
  const item = getDailyColor()
  if (!item) return null

  function openWheel() {
    const initial = toPlannerInitial(item)
    if (!initial) return
    // onOpen 제공 시(예: 기록 페이지 — 전역 PaletteFab이 숨겨진 화면) 로컬 플래너 직접 오픈, 아니면 전역 이벤트
    if (onOpen) { onOpen(initial); return }
    window.dispatchEvent(new CustomEvent('open-palette', { detail: initial }))
  }

  const wrap = glass
    ? { borderRadius: 20, padding: '15px 16px', background: 'linear-gradient(150deg, rgba(255,255,255,0.65), rgba(255,255,255,0.4))', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.75)' }
    : { borderRadius: 16, padding: '14px 15px', background: 'var(--surf)', border: '1.5px solid var(--g2)' }
  const titleColor = glass ? '#33402c' : 'var(--td)'
  const subColor = glass ? 'rgba(51,64,44,0.62)' : 'var(--tm)'
  const btn = glass
    ? { background: 'linear-gradient(135deg,#b7c24a,#96a52e)', color: '#2c330a', border: 'none' }
    : { background: 'var(--ac)', color: '#fff', border: 'none' }

  // 정사각형 컴팩트 변형 — 우측 정렬 배치용. 스와치 + 짧은 제목 + 열기 버튼만.
  if (square) {
    return (
      <div style={{ ...wrap, width: 172, aspectRatio: '1 / 1', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: glass ? 14 : 13 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: titleColor, marginBottom: 8 }}>🎨 오늘의 색</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 9 }}>
          {item.colors.map(([name, hex]) => (
            <div key={hex + name} style={{ flex: 1, height: 34, borderRadius: 7, background: hex, border: '1px solid rgba(0,0,0,0.06)' }} title={name} />
          ))}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: titleColor, lineHeight: 1.35, marginBottom: 'auto', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
        <button onClick={openWheel}
          style={{ ...btn, width: '100%', padding: '8px', borderRadius: 10, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif', marginTop: 8 }}>
          컬러휠 열기 →
        </button>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: titleColor }}>🎨 오늘의 색</span>
        <span style={{ fontSize: 10, color: subColor }}>매일 하나씩</span>
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
        {item.colors.map(([name, hex]) => (
          <div key={hex + name} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 46, borderRadius: 9, background: hex, border: '1px solid rgba(0,0,0,0.06)' }} />
            <div style={{ fontSize: 9, color: subColor, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: titleColor, marginBottom: 3 }}>{item.title}</div>
      <div style={{ fontSize: 11.5, lineHeight: 1.6, color: subColor, marginBottom: 11 }}>{item.note}</div>

      <button onClick={openWheel}
        style={{ ...btn, width: '100%', padding: '10px', borderRadius: 12, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>
        이 색으로 컬러휠 열기 →
      </button>
      <div style={{ fontSize: 10, color: subColor, textAlign: 'center', marginTop: 6 }}>
        열어서 조정하고 저장하면 기록에 남아요
      </div>
    </div>
  )
}
