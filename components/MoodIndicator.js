'use client'
// 수강권 무드 인디케이터 — ratio(remain/total)에 반응. style: orb | cup | plant
// 애니메이션 클래스(mood-*)는 globals.css에 정의.
import { useId } from 'react'

export default function MoodIndicator({ ratio, style, size = 52 }) {
  const uid = useId()
  const r0 = Number(ratio)
  const r = Math.max(0, Math.min(1, isFinite(r0) ? r0 : 0))
  const col = r <= 0 ? '#B4AEA1' : r < 0.3 ? '#C1564D' : r < 0.6 ? '#E08A1E' : '#4C8B29'

  if (style === 'plant') {
    const d = 1 - r
    return (
      <svg width={size} height={size} viewBox="0 0 60 60">
        <g className="mood-sway" style={{ transformBox:'fill-box', transformOrigin:'50% 92%' }}>
          <rect x="21" y="42" width="18" height="3" rx="1" fill="#A5623A"/>
          <path d="M22 45 L38 45 L36 54 L24 54 Z" fill="#C57C4A" stroke="#A5623A" strokeWidth="1.1" strokeLinejoin="round"/>
          <path d={`M30 45 C30 40 ${30 - d*7} 35 ${30 - d*9} ${29 + d*5}`} stroke="#6e7c52" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <ellipse cx="24" cy={34 + d*4} rx="5" ry="3" fill={col} transform={`rotate(${-32 + d*42} 24 ${34 + d*4})`}/>
          <ellipse cx="36" cy={34 + d*4} rx="5" ry="3" fill={col} transform={`rotate(${32 - d*42} 36 ${34 + d*4})`}/>
          <ellipse cx="30" cy={28 + d*3} rx="5" ry="3" fill={col} transform={`rotate(${d*10 - 3} 30 ${28 + d*3})`}/>
          {r >= 0.6 && <><circle cx="30" cy="24" r="3.2" fill="#E7A9C0"/><circle cx="30" cy="24" r="1.2" fill="#fff"/></>}
        </g>
      </svg>
    )
  }

  if (style === 'orb') {
    const wy = 50 - r * 40
    const cid = `orb-${uid}`
    return (
      <svg width={size} height={size} viewBox="0 0 60 60">
        <defs><clipPath id={cid}><circle cx="30" cy="31" r="21"/></clipPath></defs>
        <g className="mood-bob" style={{ transformBox:'fill-box', transformOrigin:'center' }}>
          <circle cx="30" cy="31" r="21" fill="#efece4"/>
          <g clipPath={`url(#${cid})`}>
            <rect x="0" y={wy} width="60" height="60" fill={col}/>
            <path className="mood-wave" d={`M0 ${wy} q7.5 -5 15 0 t15 0 t15 0 t15 0 t15 0 v40 h-90 z`} fill={col} opacity="0.85"/>
          </g>
          <circle cx="30" cy="31" r="21" fill="none" stroke="#dcd6c9" strokeWidth="1.6"/>
        </g>
      </svg>
    )
  }

  // cup (기본값)
  const ly = 50 - r * 35
  const glass = 'M21 15 L39 15 L36.5 48 Q36.5 51 34 51 L26 51 Q23.5 51 23.5 48 Z'
  const cid = `cup-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      <defs><clipPath id={cid}><path d={glass}/></clipPath></defs>
      {r >= 0.5 && (
        <g>
          <path className="mood-st1" d="M27 12 q-2.5 -3 0 -6 q2.5 -3 0 -6" stroke="#c7bfb0" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
          <path className="mood-st2" d="M33 12 q2.5 -3 0 -6 q-2.5 -3 0 -6" stroke="#c7bfb0" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
        </g>
      )}
      <path d={glass} fill="#f3f1ec"/>
      <g clipPath={`url(#${cid})`}>
        <rect x="0" y={ly} width="60" height="60" fill="#7A4A2C"/>
        {r > 0 && <rect x="0" y={ly} width="60" height="3" fill="#D8B78C"/>}
      </g>
      <path d={glass} fill="none" stroke="#cfc7b6" strokeWidth="1.6"/>
      {r <= 0 && <circle cx="30" cy="46" r="1.6" fill="#7A4A2C" opacity="0.5"/>}
    </svg>
  )
}
