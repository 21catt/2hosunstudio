'use client'
// 3D 홈 모양의 머리 — 성 장면 배경 + 2HOSUN STUDIO · 화면 이름 + 「3D 홈」 단추.
// 미리보기 대상이 아니면 아무것도 그리지 않는다(기존 화면 그대로). 판정 = lib/useCastleSkin.
//
// 배경 = 3D 성 장면을 그대로 찍은 그림(public/castle-bg/scene.jpg). 화면마다 실제 3D 를 다시 그리면
// 폰에서 열 때마다 10초 넘게 걸리고 배터리를 먹는다 — 움직이는 장면은 /castle 에서만.
// 그림 바탕이 종이색(#ece4d6) 그대로라 넓은 화면에서는 가운데 제 크기로 두고 나머지를 같은 색으로 채운다(이음매 없음).
import { useCastleSkin, leaveCastleSkin } from '../../lib/useCastleSkin'

export default function CastleHero({ title, label, extra }) {
  const on = useCastleSkin()
  if (!on) return null
  return (
    <>
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap" />
      <div className="castle-bg" aria-hidden="true" />
      <header className="castle-hero">
        <div className="castle-hero__mast">
          <span className="castle-hero__brand">2HOSUN STUDIO</span>
          <span className="castle-hero__title">{title}</span>
          {label && <span className="castle-hero__label">{label}</span>}
        </div>
        <div className="castle-hero__actions">
          {extra && <a href={extra.href} className="castle-hero__pill">{extra.label}</a>}
          <a href="/castle" className="castle-hero__pill">3D 홈</a>
          <button type="button" className="castle-hero__pill castle-hero__pill--quiet"
            onClick={() => { leaveCastleSkin(); window.location.reload() }}>예전 화면</button>
        </div>
      </header>
    </>
  )
}
