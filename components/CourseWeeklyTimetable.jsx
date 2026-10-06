'use client'

// 수업 주간 시간표 — 핵심 내용 화면에서 쓴다.
//
// ⚠️ 2026-10-06 이전엔 page.js 안에 있었고 「팝」 스타일(28px 원형 요일 뱃지 ·
//    강조색으로 채운 행 · 1.5px 테두리 · 13px 라운드)이었다. 같은 화면의 본문
//    (CoreDocView)을 머리카락 구분선 + 모노 라벨로 정리하고 나니 아래쪽만
//    옛 언어로 남아 한 화면에 두 디자인이 섞였다 → 본문과 같은 규칙으로 통일.
//    색은 테마 변수만 쓴다(하드코딩 금지 — 8색 테마 중 하나만 맞으면 안 된다).
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']
const MONO = "'Space Mono', ui-monospace, monospace"

export default function CourseWeeklyTimetable({ schedules, onPickTime }) {
  if (!schedules || schedules.length === 0) return null

  const byDow = {}
  const seen = new Set()
  for (const s of schedules) {
    const dw = s.day_of_week ?? 0
    const k = `${dw}|${s.start_time}|${s.end_time}`
    if (seen.has(k)) continue
    seen.add(k)
    ;(byDow[dw] = byDow[dw] || []).push(s)
  }
  Object.values(byDow).forEach(a => a.sort((x, y) => (x.start_time || '').localeCompare(y.start_time || '')))
  const order = [1, 2, 3, 4, 5, 6, 0].filter(d => byDow[d]?.length) // 월~일 순, 수업 있는 요일만
  if (order.length === 0) return null

  return (
    <div style={{ marginTop: 18 }}>
      {/* 머리 — 본문 SectionHead 와 같은 문법(작은 라벨 + 선) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={{ fontSize: 9.5, letterSpacing: 1.8, fontWeight: 800, color: 'var(--tm)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          주간 시간표
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tl)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          주 {order.length}일
        </span>
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }}>
        {order.map(dw => (
          <div key={dw} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ flex: '0 0 18px', fontSize: 12.5, fontWeight: 800, color: 'var(--ac)', letterSpacing: -0.2 }}>
              {DOW_KO[dw]}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {byDow[dw].map((s, k) => (
                <button key={k} onClick={() => onPickTime && onPickTime(dw, s.start_time)} title="이 시간으로 예약하러 가기"
                  style={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--tm)',
                    background: 'transparent', border: '1px solid var(--line)', borderRadius: 5,
                    padding: '3px 8px', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', letterSpacing: -0.2,
                  }}>
                  {(s.start_time || '').slice(0, 5)}–{(s.end_time || '').slice(0, 5)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--tmu)', fontWeight: 600, marginTop: 8 }}>
        시간을 누르면 가장 가까운 날 예약으로 →
      </div>
    </div>
  )
}
