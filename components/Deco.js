'use client'
// 팝 그래픽 장식 SVG — 색은 전부 테마 변수(--ac, --ac2, --ac-rgb)를 따른다.
// 패턴 ID는 useId로 인스턴스마다 고유하게.
import { useId } from 'react'

// 로고 마크: 아웃라인 원 + 채움 원 (2호선 = 두 개의 원)
export function LogoMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="none" stroke="var(--ac)" strokeWidth="2.5" />
      <circle cx="17" cy="17" r="7" fill="var(--ac2)" stroke="var(--ac)" strokeWidth="2.5" />
    </svg>
  )
}

// 히어로 상단 장식 밴드: 하프톤 도트 + 스캘럽 원 줄 + 노드 네트워크 + 스퀴글
export function HeroDeco({ height = 96 }) {
  const uid = useId().replace(/:/g, '')
  const big = `hd-big-${uid}`
  const sml = `hd-sml-${uid}`
  return (
    <svg viewBox="0 0 300 96" width="100%" height={height} preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <pattern id={big} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="3.4" fill="var(--ac)" />
        </pattern>
        <pattern id={sml} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.4" fill="var(--ac)" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="300" height="34" fill={`url(#${big})`} />
      <rect x="0" y="34" width="300" height="22" fill={`url(#${sml})`} />
      <g>
        {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285].map(x => (
          <circle key={x} cx={x} cy="34" r="9" fill="var(--ac2)" />
        ))}
      </g>
      <g stroke="var(--ac)" strokeWidth="1.2" fill="var(--ac2)">
        <line x1="196" y1="78" x2="226" y2="64" />
        <line x1="226" y1="64" x2="252" y2="80" />
        <line x1="252" y1="80" x2="278" y2="62" />
        <line x1="226" y1="64" x2="258" y2="52" />
        <line x1="258" y1="52" x2="278" y2="62" />
        <circle cx="196" cy="78" r="6" />
        <circle cx="226" cy="64" r="8" />
        <circle cx="252" cy="80" r="5" />
        <circle cx="278" cy="62" r="7" />
        <circle cx="258" cy="52" r="4" />
      </g>
      <path d="M28 76 q10 -14 22 -4 q12 10 24 0 q10 -8 20 2" fill="none" stroke="var(--ac)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

// 도트 패턴 사각 패치 (아이콘 자리·카드 장식용)
export function DotPatch({ size = 40, rx = 8 }) {
  const uid = useId().replace(/:/g, '')
  const pid = `dp-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <pattern id={pid} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.6" fill="var(--ac)" />
        </pattern>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx={rx} fill={`url(#${pid})`} />
    </svg>
  )
}

// 노드 네트워크 (섹션 구분 장식)
export function NodeNet({ width = 120, height = 40 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 40" aria-hidden="true">
      <g stroke="var(--ac)" strokeWidth="1.2" fill="var(--ac2)">
        <line x1="10" y1="30" x2="38" y2="12" />
        <line x1="38" y1="12" x2="66" y2="28" />
        <line x1="66" y1="28" x2="96" y2="10" />
        <line x1="38" y1="12" x2="70" y2="6" />
        <line x1="70" y1="6" x2="96" y2="10" />
        <circle cx="10" cy="30" r="5" />
        <circle cx="38" cy="12" r="6.5" />
        <circle cx="66" cy="28" r="4.5" />
        <circle cx="96" cy="10" r="5.5" />
        <circle cx="70" cy="6" r="3" />
      </g>
    </svg>
  )
}
