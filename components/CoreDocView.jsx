'use client'
import { useState } from 'react'
import { normalizeDoc } from '../lib/coreDoc'

// 인물화형 리치 핵심내용 렌더러 (모바일 대응)
// - '무엇을 다루나' 접근 카드: 종(세로) 나열
// - 모듈/접근 프레임 탭 → 화면에 크게, 다시 탭 → 축소
const C = {
  cream: '#FBF7E3', yellow: '#EFE156', blue: '#3538D6', green: '#6FE89A',
  dark: '#1B1C46', ink: '#2A2B55', sand: '#EAE3C4', mut: '#8A7A4A', body: '#4A4B70',
}
const MONO = "'Space Mono', ui-monospace, monospace"
const PIX = "'Silkscreen', 'Space Mono', monospace"
const SANS = "'Pretendard', -apple-system, sans-serif"

function ModuleCard({ m, onZoom, zoomed }) {
  return (
    <div onClick={onZoom}
      style={{ background:'#fff', border:`2px solid ${C.sand}`, borderRadius:20, padding: zoomed ? '26px 24px' : '20px 18px',
        boxShadow:'0 14px 34px rgba(27,28,70,.10)', cursor:'pointer', position:'relative' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <span style={{ fontFamily:PIX, fontSize:13, color:C.blue }}>{m.num}</span>
        <span style={{ fontFamily:MONO, fontSize:11, letterSpacing:1, color:'#C7BE8A' }}>◇ {m.cat}</span>
      </div>
      <h3 style={{ fontSize: zoomed ? 24 : 19, fontWeight:800, margin:'0 0 4px', color:C.dark, lineHeight:1.25 }}>{m.title}</h3>
      <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:1.5, color:C.mut, marginBottom:12 }}>{m.en}</div>
      {m.desc && <p style={{ fontSize: zoomed ? 15 : 14, lineHeight:1.65, color:C.body, margin:'0 0 16px' }}>{m.desc}</p>}

      {m.painters.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom: m.image ? 16 : 0 }}>
          {m.painters.map((p, i) => (
            <div key={i} style={{ background:C.cream, border:`1.5px solid ${C.sand}`, borderRadius:14, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:15, fontWeight:800, color:C.dark }}>{p.ko}</span>
                <span style={{ fontFamily:MONO, fontSize:10, letterSpacing:1, color:C.mut }}>{p.en}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {p.points.map((pt, j) => (
                  <div key={j} style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                    <span style={{ width:7, height:7, background:C.green, marginTop:6, flexShrink:0 }}/>
                    <span style={{ fontSize:13.5, lineHeight:1.5, color:'#3A3B60' }}>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {m.bullets.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom: m.image ? 16 : 0 }}>
          {m.bullets.map((b, i) => (
            <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
              <span style={{ width:7, height:7, background:C.green, marginTop:6, flexShrink:0 }}/>
              <span style={{ fontSize:14, lineHeight:1.55, color:'#3A3B60' }}>{b}</span>
            </div>
          ))}
        </div>
      )}

      {m.image && (
        <div style={{ borderRadius:14, overflow:'hidden', border:`1.5px solid ${C.sand}` }}>
          <img src={m.image} alt="" style={{ width:'100%', display:'block' }}/>
        </div>
      )}
      {!zoomed && (
        <div style={{ marginTop:14, fontFamily:MONO, fontSize:10, letterSpacing:1, color:C.mut, textAlign:'right' }}>탭하면 크게 ↗</div>
      )}
    </div>
  )
}

function ApproachCard({ a, onZoom, zoomed }) {
  return (
    <div onClick={onZoom}
      style={{ background:'#fff', border:`2px solid ${C.sand}`, borderRadius:20, padding: zoomed ? '28px 26px' : '22px 20px',
        boxShadow:'0 12px 28px rgba(27,28,70,.08)', cursor:'pointer' }}>
      <div style={{ fontFamily:PIX, fontSize: zoomed ? 26 : 20, color:C.blue, marginBottom:14 }}>{a.num}</div>
      <h3 style={{ fontSize: zoomed ? 24 : 19, fontWeight:800, margin:'0 0 4px', color:C.dark }}>{a.title}</h3>
      <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:1.5, color:C.mut, marginBottom:14 }}>{a.en}</div>
      <p style={{ fontSize: zoomed ? 15 : 14, lineHeight:1.65, color:C.body, margin: a.image ? '0 0 16px' : 0 }}>{a.desc}</p>
      {a.image && (
        <div style={{ borderRadius:12, overflow:'hidden', border:`1.5px solid ${C.sand}` }}>
          <img src={a.image} alt="" style={{ width:'100%', display:'block' }}/>
        </div>
      )}
      {!zoomed && (
        <div style={{ marginTop:12, fontFamily:MONO, fontSize:10, letterSpacing:1, color:C.mut, textAlign:'right' }}>탭하면 크게 ↗</div>
      )}
    </div>
  )
}

export default function CoreDocView({ doc, sample = false }) {
  const d = normalizeDoc(doc)
  const [zoom, setZoom] = useState(null) // { type:'module'|'approach', item }

  return (
    <div style={{ fontFamily:SANS, background:C.cream, color:C.dark }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Space+Mono:wght@400;700&display=swap');
        @keyframes cdFloaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes cdBlink { 0%,92%,100%{opacity:1} 96%{opacity:.35} }
        @keyframes cdPop { from{transform:scale(.9); opacity:0} to{transform:scale(1); opacity:1} }`}</style>

      {sample && (
        <div style={{ background:C.dark, color:C.yellow, fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:1, textAlign:'center', padding:'7px 12px' }}>
          예시 미리보기 — 관리자가 작성하면 실제 핵심내용으로 바뀌어요
        </div>
      )}

      {/* HERO */}
      <section style={{ background:C.yellow, position:'relative', overflow:'hidden', padding:'40px 22px 44px' }}>
        <div style={{ position:'absolute', bottom:-10, right:20, width:150, height:90, backgroundImage:`radial-gradient(circle, ${C.blue} 30%, transparent 32%)`, backgroundSize:'13px 13px', opacity:.4 }}/>
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <span style={{ width:36, height:3, background:C.blue }}/>
            <span style={{ fontFamily:MONO, fontSize:11, letterSpacing:2, color:C.dark, fontWeight:700 }}>{d.hero.eyebrow}</span>
          </div>
          <h1 style={{ fontSize:'clamp(46px, 15vw, 84px)', lineHeight:.98, fontWeight:800, letterSpacing:-2, margin:'0 0 22px' }}>
            {d.hero.title}<span style={{ color:C.blue }}>{d.hero.titleAccent}</span>
          </h1>
          <p style={{ fontSize:16, lineHeight:1.7, color:C.ink, margin:'0 0 26px', maxWidth:520 }}>{d.hero.desc}</p>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ width:10, height:10, background:C.blue, borderRadius:'50%', animation:'cdBlink 3s infinite' }}/>
            <span style={{ fontFamily:MONO, fontSize:12, letterSpacing:2, color:C.ink }}>아래로 따라가 보세요</span>
          </div>
          {d.hero.image && (
            <img src={d.hero.image} alt="" style={{ position:'absolute', top:-6, right:0, width:96, height:96, imageRendering:'pixelated', animation:'cdFloaty 4s ease-in-out infinite' }}/>
          )}
        </div>
      </section>

      {/* STATEMENT */}
      <section style={{ background:C.blue, color:C.cream, padding:'42px 22px' }}>
        <span style={{ fontFamily:MONO, fontSize:12, letterSpacing:2, fontWeight:700, color:C.green }}>{d.statement.eyebrow}</span>
        <h2 style={{ fontSize:24, lineHeight:1.42, fontWeight:800, margin:'12px 0 16px', color:'#fff' }}>{d.statement.title}</h2>
        <p style={{ fontSize:14.5, lineHeight:1.75, color:'#CDCEF2', margin:'0 0 22px' }}>{d.statement.desc}</p>
        {d.meta.length > 0 && (
          <div style={{ background:C.cream, color:C.dark, borderRadius:20, padding:'6px 20px', boxShadow:`6px 6px 0 ${C.green}` }}>
            {d.meta.map((row, i) => (
              <div key={i} style={{ display:'flex', gap:16, padding:'14px 0', borderBottom: i < d.meta.length-1 ? `1.5px solid ${C.sand}` : 'none', alignItems:'baseline' }}>
                <span style={{ fontFamily:MONO, fontSize:12, letterSpacing:1, color:C.mut, fontWeight:700, minWidth:38 }}>{row.k}</span>
                <span style={{ fontSize:15, fontWeight:600, color:C.dark }}>{row.v}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* APPROACHES — 종(세로) 나열 */}
      {d.approaches.length > 0 && (
        <section style={{ padding:'48px 22px 20px' }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <span style={{ fontFamily:MONO, fontSize:11, letterSpacing:4, fontWeight:700, color:C.mut }}>세 가지 접근</span>
            <h2 style={{ fontSize:30, fontWeight:800, letterSpacing:-1, margin:'12px 0 0' }}>무엇을 다루나</h2>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {d.approaches.map((a, i) => (
              <ApproachCard key={i} a={a} onZoom={() => setZoom({ type:'approach', item:a })}/>
            ))}
          </div>
        </section>
      )}

      {/* MODULE CHIPS */}
      {d.chips.length > 0 && (
        <section style={{ padding:'40px 22px 16px', textAlign:'center' }}>
          <span style={{ fontFamily:MONO, fontSize:11, letterSpacing:4, fontWeight:700, color:C.mut }}>네 개의 모듈</span>
          <h2 style={{ fontSize:32, fontWeight:800, letterSpacing:-1, margin:'12px 0 20px' }}>여덟 주의 흐름</h2>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 6px', justifyContent:'center', alignItems:'center', fontFamily:MONO }}>
            {d.chips.map((c, i) => (
              <span key={i} style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:14, fontWeight:700, color:C.blue }}>{c}</span>
                {i < d.chips.length-1 && <span style={{ color:'#C7BE8A', fontSize:13 }}>→</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* MODULE TIMELINE — 모바일 세로 스택 */}
      {d.modules.length > 0 && (
        <section style={{ padding:'12px 22px 36px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {d.modules.map((m, i) => (
              <div key={i} style={{ position:'relative', paddingTop:10 }}>
                <div style={{ position:'absolute', top:-4, left:14, width:46, height:46, background:C.yellow, border:`3px solid ${C.blue}`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:PIX, fontWeight:700, fontSize:14, color:C.blue, zIndex:2 }}>{m.num}</div>
                <div style={{ paddingLeft:0, marginTop:22 }}>
                  <ModuleCard m={m} onZoom={() => setZoom({ type:'module', item:m })}/>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ background:C.dark, color:C.cream, position:'relative', overflow:'hidden', padding:'44px 22px' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle, rgba(111,232,154,.16) 30%, transparent 32%)`, backgroundSize:'18px 18px' }}/>
        <div style={{ position:'relative' }}>
          <h2 style={{ fontSize:32, fontWeight:800, letterSpacing:-1, margin:'0 0 14px', lineHeight:1.2, whiteSpace:'pre-line' }}>{d.cta.title}</h2>
          <p style={{ fontSize:14.5, color:'#B7B8E0', margin:'0 0 24px', lineHeight:1.7 }}>{d.cta.desc}</p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, background:C.green, color:C.dark, fontWeight:800, fontSize:15, padding:'15px 26px', borderRadius:14, border:`2px solid ${C.dark}`, boxShadow:`4px 4px 0 ${C.yellow}` }}>
            <span>{d.cta.buttonText}</span>
            <span style={{ fontFamily:PIX }}>→</span>
          </div>
          {d.cta.image && (
            <div style={{ textAlign:'center', marginTop:24 }}>
              <img src={d.cta.image} alt="" style={{ width:140, imageRendering:'pixelated', animation:'cdFloaty 5s ease-in-out infinite' }}/>
            </div>
          )}
        </div>
      </section>

      {/* ZOOM OVERLAY — 탭하면 크게, 다시 탭하면 축소 */}
      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(27,28,70,.72)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto', fontFamily:SANS }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:520, animation:'cdPop .18s ease-out' }}>
            {zoom.type === 'module'
              ? <ModuleCard m={zoom.item} zoomed onZoom={() => setZoom(null)}/>
              : <ApproachCard a={zoom.item} zoomed onZoom={() => setZoom(null)}/>}
            <div style={{ textAlign:'center', marginTop:12 }}>
              <button onClick={() => setZoom(null)}
                style={{ background:C.cream, color:C.dark, border:'none', borderRadius:20, padding:'9px 20px', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:SANS }}>닫기 ✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
