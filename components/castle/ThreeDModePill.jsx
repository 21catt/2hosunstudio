'use client'
// 예전 홈 오른쪽 위 「3D 모드」 단추 + 시범 운영 강조 (2026-10-21, 시안 https://claude.ai/artifact/KjXrTZevMJ3xgSVSqHQveg)
//   · 처음엔 보랏빛 테두리가 숨 쉬듯 빛나고 「NEW」 + 아래 말풍선 「새 3D 홈 시범 운영 중이에요 ✨ 눌러서 바꿔 써 보세요」
//   · ✕ 로 닫거나 한 번 3D 로 바꾸면 강조·말풍선 모두 사라진다 — 그 기기에 기억(2hs_3d_hint_seen)
//   · 동작 줄이기 = 빛남·흔들림 없음
import { useEffect, useState } from 'react'
import s from './ThreeDModePill.module.css'

const SEEN = '2hs_3d_hint_seen'

export default function ThreeDModePill() {
  const [hint, setHint] = useState(false)
  useEffect(() => { try { setHint(localStorage.getItem(SEEN) !== '1') } catch { setHint(false) } }, [])
  const seen = () => { try { localStorage.setItem(SEEN, '1') } catch {} ; setHint(false) }

  return (
    <>
      <a href="/castle" aria-label="3D 모드 켜기" className={`${s.pill} ${hint ? s.hot : ''}`}
        onClick={() => { try { localStorage.setItem('2hs_home_mode', 'castle'); localStorage.setItem(SEEN, '1') } catch {} }}>
        {hint && <span className={s.new}>NEW</span>}
        3D 모드 <span aria-hidden="true" className={s.sw}><i /></span>
      </a>
      {hint && (
        <div className={s.tip} role="note">
          새 3D 홈 시범 운영 중이에요 ✨<br />눌러서 바꿔 써 보세요
          <button onClick={seen} aria-label="안내 닫기">✕</button>
        </div>
      )}
    </>
  )
}
