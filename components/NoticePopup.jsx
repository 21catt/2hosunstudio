'use client'
import { useEffect, useState } from 'react'
import { activePopupNotice, noticeDismissed, dismissNotice } from '../lib/notices'

// 접속하면 한 번 뜨는 안내 팝업(휴무·행사). 로그인 여부와 무관하게 보인다 —
// 처음 온 사람도 "오늘 문 여나"를 알아야 한다.
// ⚠️ 문서·계정을 건드리지 않는다(닫음 기억 = 그 기기 localStorage).
export default function NoticePopup() {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const n = activePopupNotice(today)
    if (n && !noticeDismissed(n.id)) setNotice(n)
  }, [])

  if (!notice) return null

  const close = () => setNotice(null)
  const closeForever = () => { dismissNotice(notice.id); setNotice(null) }

  return (
    <div onClick={close}
      style={{ position:'fixed', inset:0, zIndex:1300, background:'rgba(18,22,28,0.55)',
        backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'6vh 22px',
        animation:'noticeIn 0.2s ease-out' }}>
      <style>{`@keyframes noticeIn{from{opacity:0}to{opacity:1}}
        @keyframes noticeUp{from{transform:translateY(10px) scale(0.97);opacity:0}to{transform:none;opacity:1}}
        @keyframes noticeBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @media (prefers-reduced-motion: reduce){[data-notice]{animation:none!important}
          [data-notice] img{animation:none!important}}`}</style>

      <div data-notice onClick={e => e.stopPropagation()}
        style={{ width:'100%', maxWidth:340, background:'var(--surf)', borderRadius:24,
          border:'2px solid rgb(var(--ac-rgb) / 0.25)', boxShadow:'0 26px 60px -20px rgba(20,30,40,0.5)',
          padding:'26px 22px 18px', textAlign:'center', fontFamily:'Nunito,sans-serif',
          animation:'noticeUp 0.24s cubic-bezier(0.2,0.9,0.3,1)' }}>

        {notice.image ? (
          // 캐릭터가 나와서 인사한다 — 이모지는 작은 배지로 옆에 둔다
          <div style={{ position:'relative', width:80, height:80, margin:'0 auto' }}>
            <img src={notice.image} alt={notice.imageAlt || ''} width={80} height={80}
              style={{ width:80, height:80, objectFit:'contain', imageRendering:'pixelated',
                animation:'noticeBob 2.4s ease-in-out infinite' }}/>
            {notice.emoji && (
              <div style={{ position:'absolute', top:-2, right:-2, fontSize:20, lineHeight:1 }}>{notice.emoji}</div>
            )}
          </div>
        ) : (
          <div style={{ fontSize:40, lineHeight:1 }}>{notice.emoji}</div>
        )}

        <div style={{ fontSize:16.5, fontWeight:800, color:'var(--td)', margin:'12px 0 10px' }}>
          {notice.title}
        </div>

        <div style={{ fontSize:13, fontWeight:600, color:'var(--tm)', lineHeight:1.75,
          maxHeight:'44vh', overflowY:'auto' }}>
          {notice.lines.map((l, i) => (
            <div key={i} style={{ minHeight: l ? undefined : 8 }}>{l}</div>
          ))}
        </div>

        {notice.closing && (
          <div style={{ marginTop:14, padding:'11px 12px', borderRadius:14,
            background:'var(--acBg)', border:'1.5px solid rgb(var(--ac-rgb) / 0.25)',
            fontSize:12.5, fontWeight:800, color:'var(--acTx)', lineHeight:1.6,
            whiteSpace:'pre-line' }}>
            {notice.closing}
          </div>
        )}

        <button onClick={close}
          style={{ width:'100%', marginTop:18, padding:'12px 0', borderRadius:16, border:'none',
            background:'var(--ac)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer',
            fontFamily:'Nunito,sans-serif' }}>
          확인
        </button>

        <button onClick={closeForever}
          style={{ marginTop:9, background:'none', border:'none', color:'var(--tmu)',
            fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
          다시 보지 않기
        </button>
      </div>
    </div>
  )
}
