'use client'
// 로딩 스플래시 — 픽셀 고양이 10종 중 하나를 랜덤 표시
// 랜덤 선택은 마운트 후에만(useEffect) 해서 SSR 하이드레이션 불일치를 피한다.
import { useState, useEffect } from 'react'

const CATS = [
  '01-happy', '02-wink', '03-cool', '04-love', '05-surprised',
  '06-sleepy', '07-laugh', '08-grumpy', '09-cat', '10-playful',
]

export default function LoadingCat({ size = 96, label }) {
  const [cat, setCat] = useState(null)
  useEffect(() => {
    setCat(CATS[Math.floor(Math.random() * CATS.length)])
  }, [])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:size, height:size, margin:'0 auto' }}>
          {cat && (
            <img src={`/pixel-cats/${cat}.png`} alt="로딩 중" width={size} height={size}
              className="mood-bob" style={{ imageRendering:'pixelated', display:'block' }} />
          )}
        </div>
        {label && <div style={{ fontSize:14, color:'var(--tmu)', fontWeight:700, marginTop:12 }}>{label}</div>}
      </div>
    </div>
  )
}
