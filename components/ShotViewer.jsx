'use client'
import { useEffect } from 'react'

// 「요즘 스튜디오」 사진 확대 — 홈 스킨 셋이 같은 부품을 쓴다(모양이 갈라지지 않게).
//
// ⚠️ 화면을 꽉 채우지 않는다. 첫 화면에서 사진을 잠깐 크게 보는 용도라,
//    전체화면 라이트박스로 만들면 "다른 화면으로 들어왔다"는 느낌이 된다.
//    한 번 더 누르면 원래대로 — 배경·사진 어디를 눌러도 닫힌다.
export default function ShotViewer({ shot, onClose }) {
  useEffect(() => {
    if (!shot) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // 열려 있는 동안 뒤 화면이 스크롤되지 않게
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [shot, onClose])

  if (!shot) return null
  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(18,26,22,0.62)',
        backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'6vh 6vw',
        animation:'shotIn 0.18s ease-out' }}>
      <style>{`@keyframes shotIn{from{opacity:0}to{opacity:1}}
        @keyframes shotUp{from{transform:scale(0.94);opacity:0}to{transform:scale(1);opacity:1}}
        @media (prefers-reduced-motion: reduce){[data-shot]{animation:none!important}}`}</style>
      <figure data-shot style={{ margin:0, maxWidth:'min(88vw, 460px)', display:'flex', flexDirection:'column',
        gap:10, animation:'shotUp 0.2s cubic-bezier(0.2,0.9,0.3,1)' }}>
        <img src={shot.url} alt=""
          style={{ width:'100%', maxHeight:'70vh', objectFit:'contain', display:'block',
            borderRadius:20, boxShadow:'0 24px 60px -18px rgba(0,0,0,0.55)', background:'rgba(255,255,255,0.06)' }}/>
        <figcaption style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
          fontSize:11.5, fontWeight:800, color:'rgba(255,255,255,0.9)', fontFamily:'Nunito,sans-serif' }}>
          <span>{shot.who || ''}</span>
          <span style={{ opacity:0.65 }}>탭하면 닫혀요</span>
        </figcaption>
      </figure>
    </div>
  )
}
