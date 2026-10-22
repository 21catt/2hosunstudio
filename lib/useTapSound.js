'use client'
// 버튼 누름 소리 — 3D 홈(/castle)과 캘린더가 같이 쓴다(2026-10-22 캘린더 터치 소리 사용자 요청).
//   소리 = public/jelly-sfx.js(성·냥밭 공용, 켜고 끄기 = localStorage 2hs_castle_sfx — 홈에서 끈 사람은 여기서도 꺼져 있다)
//   대상 = 버튼·링크·role=button·[data-tap](달력 날짜 칸처럼 div 로 된 누를 곳). 막힌 버튼·data-no-tap 은 빼고,
//   data-tap-pitch 가 있으면 볼펜 「딸깍」(도레미), 그 밖 전부 = 청축 키보드 「찰칵」. data-tap-close 면 조금 낮고 작게.
import { useEffect } from 'react'

export function useTapSound() {
  useEffect(() => {
    if (!window.JellySfx && !document.querySelector('script[data-jelly-sfx]')) {
      const sc = document.createElement('script'); sc.src = '/jelly-sfx.js'; sc.dataset.jellySfx = '1'; document.head.appendChild(sc)
    }
    let held = null
    const target = e => {
      const el = e.target?.closest?.('button, a[href], [role="button"], [role="menuitem"], [data-tap]')
      if (!el || el.disabled || el.closest('[data-no-tap]')) return null
      return el
    }
    const opts = el => ({ pitch: Number(el.dataset.tapPitch) || 1, close: el.dataset.tapClose === '1' })
    const kind = el => (el.dataset.tapPitch ? ['pen', 'penUp'] : ['key', 'keyUp'])
    const down = e => { if (e.button > 0) return; const el = target(e); if (!el) return; held = { el, o: opts(el), k: kind(el) }; window.JellySfx?.play(held.k[0], held.o) }
    const up = () => { if (!held) return; const h = held; held = null; window.JellySfx?.play(h.k[1], h.o) }
    const key = e => { if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return; const el = target(e); if (!el) return; const o = opts(el), k = kind(el); window.JellySfx?.play(k[0], o); setTimeout(() => window.JellySfx?.play(k[1], o), 110) }
    document.addEventListener('pointerdown', down, true); document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true); document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true); document.removeEventListener('keydown', key, true) }
  }, [])
}
