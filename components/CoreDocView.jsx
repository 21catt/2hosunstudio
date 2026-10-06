'use client'
import { useState, useRef } from 'react'
import { normalizeDoc, getCorePalette } from '../lib/coreDoc'

// 리치 핵심내용 렌더러 (모바일 우선)
//
// 설계 규칙 — 2026-10-05 개편
// ① 폰트는 두 벌뿐: 본문 SANS + 라벨/번호 MONO. (픽셀 폰트 Silkscreen 제거 — 교육 과정 문서가
//    게임 UI처럼 읽히던 원인)
// ② 장식이 내용을 이기지 않는다: 도트 패턴·떠다니는 애니메이션·하드 그림자(Npx Npx 0) 전부 제거.
// ③ 핵심 정보(meta)는 히어로 바로 아래. "이 수업이 나한테 맞나"를 가장 먼저 판단하는 정보라
//    예전처럼 statement 안쪽 카드에 숨기지 않는다.
// ④ 모듈은 cat(카테고리)으로 묶고 그 묶음을 스티키 헤더로 보여 준다 — 10개짜리 과정이
//    2~3개 묶음으로 읽힌다. 목차(chips)는 번호 그리드이고 누르면 그 모듈로 스크롤한다.
// ⑤ 카드 탭 → 확대 오버레이는 유지(사용자 확정 2026-10-05).
//
// 색은 doc.theme(관리자 선택 팔레트)에서 온다. 아래 C는 기존 키 이름 매핑.
function paletteToC(theme) {
  const p = getCorePalette(theme)
  return { cream: p.bg, yellow: p.hero, blue: p.accent, green: p.accent2, dark: p.dark, ink: p.ink, sand: p.sand, mut: p.mut, body: p.body, soft: p.soft }
}
const MONO = "'Space Mono', ui-monospace, monospace"
const SANS = "'Pretendard', -apple-system, sans-serif"

// 히어로·CTA 이미지 슬롯은 그리지 않는다(사용자 확정 2026-10-05 — "고양이 이미지는 빼자").
// ⚠️ 경로로 거르려 했다가 틀렸다: 저장된 6건은 로컬 /pixel-cats/ 든 관리자가 업로드한 storage URL 이든
//    전부 같은 픽셀 고양이 캐릭터였다. 그래서 슬롯째 뺀다.
// 교육 자료인 모듈·접근 이미지(실제 작업 사진 30건)는 그대로 보여 주고 탭하면 확대된다.
// ⚠️ 저장된 값은 지우지 않는다(데이터 무손실). 렌더에서만 건너뛴다.

// ─── 확대 오버레이용 상세 카드 ───────────────────────────
function ModuleCard({ m, C }) {
  return (
    <div style={{ background:'#fff', border:`1px solid ${C.sand}`, borderRadius:14, padding:'22px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10, marginBottom:10 }}>
        <span style={{ fontFamily:MONO, fontSize:12, fontWeight:700, color:C.blue }}>{m.num}</span>
        {m.cat && <span style={{ fontFamily:MONO, fontSize:10, letterSpacing:1, color:C.mut }}>{m.cat}</span>}
      </div>
      <h3 style={{ fontSize:21, fontWeight:800, margin:'0 0 4px', color:C.dark, lineHeight:1.3, letterSpacing:-0.5 }}>{m.title}</h3>
      {m.en && <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:1.5, color:C.mut, marginBottom:14 }}>{m.en}</div>}
      {m.desc && <p style={{ fontSize:14.5, lineHeight:1.75, color:C.body, margin:'0 0 16px' }}>{m.desc}</p>}

      {m.painters.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom: m.image ? 16 : 0 }}>
          {m.painters.map((p, i) => (
            <div key={i} style={{ background:C.cream, border:`1px solid ${C.sand}`, borderRadius:10, padding:'13px 15px' }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:14.5, fontWeight:800, color:C.dark }}>{p.ko}</span>
                <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:1, color:C.mut }}>{p.en}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {p.points.map((pt, j) => (
                  <div key={j} style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                    <span style={{ width:4, height:4, borderRadius:'50%', background:C.green, marginTop:7, flexShrink:0 }}/>
                    <span style={{ fontSize:13, lineHeight:1.6, color:C.body }}>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {m.bullets.length > 0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom: m.image ? 16 : 0 }}>
          {m.bullets.map((b, i) => (
            <span key={i} style={{ fontFamily:MONO, fontSize:10.5, fontWeight:700, color:C.mut, border:`1px solid ${C.sand}`, borderRadius:4, padding:'3px 7px' }}>{b}</span>
          ))}
        </div>
      )}

      {m.image && (
        <div style={{ borderRadius:10, overflow:'hidden', border:`1px solid ${C.sand}` }}>
          <img src={m.image} alt="" style={{ width:'100%', display:'block' }}/>
        </div>
      )}
    </div>
  )
}

function ApproachCard({ a, C }) {
  return (
    <div style={{ background:'#fff', border:`1px solid ${C.sand}`, borderRadius:14, padding:'22px 20px' }}>
      <div style={{ fontFamily:MONO, fontSize:12, fontWeight:700, color:C.blue, marginBottom:10 }}>{a.num}</div>
      <h3 style={{ fontSize:21, fontWeight:800, margin:'0 0 4px', color:C.dark, letterSpacing:-0.5 }}>{a.title}</h3>
      {a.en && <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:1.5, color:C.mut, marginBottom:14 }}>{a.en}</div>}
      <p style={{ fontSize:14.5, lineHeight:1.75, color:C.body, margin: a.image ? '0 0 16px' : 0 }}>{a.desc}</p>
      {a.image && (
        <div style={{ borderRadius:10, overflow:'hidden', border:`1px solid ${C.sand}` }}>
          <img src={a.image} alt="" style={{ width:'100%', display:'block' }}/>
        </div>
      )}
    </div>
  )
}

// 섹션 머리 — 작은 라벨 + 선, 그 아래 제목
function SectionHead({ eyebrow, title, C }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
        <span style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:1.8, fontWeight:700, color:C.mut, textTransform:'uppercase' }}>{eyebrow}</span>
        <span style={{ flex:1, height:1, background:C.sand }}/>
      </div>
      <h2 style={{ fontSize:21, fontWeight:800, letterSpacing:-0.7, margin:0, color:C.dark }}>{title}</h2>
    </div>
  )
}

export default function CoreDocView({ doc, sample = false, onCta }) {
  const d = normalizeDoc(doc)
  const C = paletteToC(d.theme)
  const [zoom, setZoom] = useState(null) // { type:'module'|'approach', item }
  const modRefs = useRef({})

  // 모듈을 cat(카테고리)으로 묶는다 — 연속된 같은 cat 이 한 묶음.
  const groups = []
  d.modules.forEach((m, i) => {
    const cat = m.cat || ''
    const last = groups[groups.length - 1]
    if (last && last.cat === cat) last.items.push({ m, i })
    else groups.push({ cat, items: [{ m, i }] })
  })

  function jumpTo(i) {
    const el = modRefs.current[i]
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center' })
  }

  const sec = { padding:'36px 24px' }
  const rule = <div style={{ height:1, background:C.sand }}/>

  return (
    <div style={{ fontFamily:SANS, background:C.cream, color:C.dark }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        @keyframes cdPop { from{transform:scale(.97); opacity:0} to{transform:scale(1); opacity:1} }`}</style>

      {sample && (
        <div style={{ background:C.dark, color:'#fff', fontFamily:MONO, fontSize:10.5, fontWeight:700, letterSpacing:1, textAlign:'center', padding:'8px 12px', opacity:.95 }}>
          예시 미리보기 — 관리자가 작성하면 실제 핵심내용으로 바뀌어요
        </div>
      )}

      {/* HERO — 장식 없이, 제목·리드문만 */}
      <section style={{ background:C.yellow, padding:'34px 24px 26px' }}>
        {d.hero.eyebrow && (
          <div style={{ fontFamily:MONO, fontSize:10.5, letterSpacing:2.2, fontWeight:700, color:C.blue, textTransform:'uppercase' }}>{d.hero.eyebrow}</div>
        )}
        <h1 style={{ fontSize:'clamp(30px, 9vw, 40px)', lineHeight:1.16, fontWeight:800, letterSpacing:-1.4, margin:'13px 0 14px', color:C.dark }}>
          {d.hero.title}<span style={{ color:C.blue }}>{d.hero.titleAccent}</span>
        </h1>
        {d.hero.desc && <p style={{ fontSize:14.5, lineHeight:1.75, color:C.ink, margin:0, opacity:.92 }}>{d.hero.desc}</p>}
      </section>

      {/* META — 히어로 바로 아래 2열 */}
      {d.meta.length > 0 && (
        <section style={{ background:C.yellow, padding:'0 24px 26px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
          {d.meta.map((row, i) => (
            <div key={i} style={{ background:'rgba(0,0,0,.055)', borderRadius:8, padding:'11px 13px' }}>
              <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:1.4, fontWeight:700, color:C.blue, textTransform:'uppercase', marginBottom:4 }}>{row.k}</div>
              <div style={{ fontSize:12.5, fontWeight:700, color:C.dark, lineHeight:1.4 }}>{row.v}</div>
            </div>
          ))}
        </section>
      )}

      {/* STATEMENT */}
      <section style={{ background:C.blue, color:'#fff', padding:'36px 24px' }}>
        {d.statement.eyebrow && (
          <div style={{ fontFamily:MONO, fontSize:10.5, letterSpacing:2.2, fontWeight:700, color:C.yellow, textTransform:'uppercase' }}>{d.statement.eyebrow}</div>
        )}
        <h2 style={{ fontSize:21, lineHeight:1.5, fontWeight:700, margin:'12px 0 13px', color:'#fff', letterSpacing:-0.4, paddingLeft:13, borderLeft:`2px solid ${C.yellow}` }}>{d.statement.title}</h2>
        {d.statement.desc && <p style={{ fontSize:13.5, lineHeight:1.85, color:C.soft, margin:0, opacity:.95 }}>{d.statement.desc}</p>}
      </section>

      {/* APPROACHES — 평평한 목록 (탭하면 확대) */}
      {d.approaches.length > 0 && (
        <section style={sec}>
          <SectionHead eyebrow={d.sections.approaches.eyebrow} title={d.sections.approaches.title} C={C}/>
          <div style={{ borderTop:`1px solid ${C.sand}` }}>
            {d.approaches.map((a, i) => (
              <div key={i} onClick={() => setZoom({ type:'approach', item:a })}
                style={{ borderBottom:`1px solid ${C.sand}`, padding:'18px 0', display:'flex', gap:14, cursor:'pointer' }}>
                <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.blue, paddingTop:3, flex:'0 0 22px' }}>{a.num}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <h3 style={{ fontSize:16, fontWeight:800, margin:'0 0 3px', color:C.dark, letterSpacing:-0.4 }}>{a.title}</h3>
                    <span style={{ marginLeft:'auto', color:C.mut, fontSize:12, flexShrink:0 }}>⤢</span>
                  </div>
                  {a.en && <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:1.5, color:C.mut, marginBottom:8 }}>{a.en}</div>}
                  <p style={{ fontSize:13.5, lineHeight:1.7, color:C.body, margin:0 }}>{a.desc}</p>
                </div>
                {a.image && (
                  <div style={{ flex:'0 0 72px', width:72, height:72, borderRadius:8, overflow:'hidden', border:`1px solid ${C.sand}`, background:'#fff' }}>
                    <img src={a.image} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 목차 — 번호 그리드, 누르면 그 모듈로 */}
      {d.chips.length > 0 && (
        <>
          {rule}
          <section style={{ ...sec, paddingBottom:26 }}>
            <SectionHead eyebrow={d.sections.chips.eyebrow} title={d.sections.chips.title} C={C}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:C.sand, border:`1px solid ${C.sand}`, borderRadius:10, overflow:'hidden' }}>
              {d.chips.map((c, i) => (
                <button key={i} onClick={() => jumpTo(i)}
                  style={{ background:C.cream, border:'none', padding:'11px 12px', display:'flex', gap:9, alignItems:'baseline', cursor:'pointer', fontFamily:SANS, textAlign:'left' }}>
                  <span style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:C.blue, flexShrink:0 }}>
                    {String(i).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize:12.5, fontWeight:700, color:C.body, lineHeight:1.3, letterSpacing:-0.2 }}>{c}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {/* MODULES — 카테고리 스티키 헤더 + 평평한 목록 */}
      {d.modules.length > 0 && groups.map((g, gi) => (
        <div key={gi}>
          {g.cat && (
            <div style={{ position:'sticky', top:0, zIndex:3, background:C.cream, padding:'11px 24px 9px', borderBottom:`1px solid ${C.sand}`, display:'flex', alignItems:'center', gap:8 }}>
              <b style={{ fontSize:12, fontWeight:800, color:C.blue, letterSpacing:-0.2 }}>{g.cat}</b>
              <span style={{ fontFamily:MONO, fontSize:9.5, color:C.mut, marginLeft:'auto' }}>
                {g.items[0].m.num}–{g.items[g.items.length - 1].m.num}
              </span>
            </div>
          )}
          <div style={{ padding:'0 24px' }}>
            {g.items.map(({ m, i }, k) => (
              <div key={i} ref={el => { modRefs.current[i] = el }}
                onClick={() => setZoom({ type:'module', item:m })}
                style={{ display:'flex', gap:14, padding:'18px 0', cursor:'pointer',
                  borderBottom: k < g.items.length - 1 ? `1px solid ${C.sand}` : 'none', scrollMarginTop:56 }}>
                <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.blue, flex:'0 0 22px', paddingTop:3 }}>{m.num}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <h3 style={{ fontSize:15.5, fontWeight:800, margin:'0 0 3px', color:C.dark, letterSpacing:-0.4, lineHeight:1.3 }}>{m.title}</h3>
                    <span style={{ marginLeft:'auto', color:C.mut, fontSize:12, flexShrink:0 }}>⤢</span>
                  </div>
                  {m.en && <div style={{ fontFamily:MONO, fontSize:9.5, letterSpacing:1.5, color:C.mut, marginBottom:7 }}>{m.en}</div>}
                  {m.desc && <p style={{ fontSize:13, lineHeight:1.7, color:C.body, margin:'0 0 9px' }}>{m.desc}</p>}
                  {m.bullets.length > 0 && (
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {m.bullets.map((b, j) => (
                        <span key={j} style={{ fontFamily:MONO, fontSize:10, fontWeight:700, color:C.mut, border:`1px solid ${C.sand}`, borderRadius:4, padding:'2px 6px', background:'#fff' }}>{b}</span>
                      ))}
                    </div>
                  )}
                  {m.painters.length > 0 && (
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {m.painters.map((p, j) => (
                        <span key={j} style={{ fontSize:11, fontWeight:700, color:C.body, border:`1px solid ${C.sand}`, borderRadius:4, padding:'2px 7px', background:'#fff' }}>{p.ko}</span>
                      ))}
                    </div>
                  )}
                </div>
                {m.image && (
                  <div style={{ flex:'0 0 72px', width:72, height:72, borderRadius:8, overflow:'hidden', border:`1px solid ${C.sand}`, background:'#fff' }}>
                    <img src={m.image} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* OUTCOMES */}
      {d.outcomes.length > 0 && (
        <>
          {rule}
          <section style={sec}>
            <SectionHead eyebrow={d.sections.outcomes.eyebrow} title={d.sections.outcomes.title} C={C}/>
            <div>
              {d.outcomes.map((o, i) => (
                <div key={i} style={{ display:'flex', gap:13, padding:'16px 0', borderTop:`1px solid ${C.sand}` }}>
                  <span style={{ fontFamily:MONO, fontSize:10.5, fontWeight:700, color:C.blue, flex:'0 0 22px', paddingTop:3 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ minWidth:0 }}>
                    <h3 style={{ fontSize:14.5, fontWeight:800, margin:'0 0 4px', color:C.dark, letterSpacing:-0.3, lineHeight:1.35 }}>{o.title}</h3>
                    {o.desc && <p style={{ fontSize:13, lineHeight:1.7, color:C.body, margin:0 }}>{o.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* CTA */}
      <section style={{ background:C.dark, color:'#fff', padding:'40px 24px' }}>
        <h2 style={{ fontSize:24, fontWeight:800, letterSpacing:-0.8, margin:'0 0 12px', lineHeight:1.35, whiteSpace:'pre-line' }}>{d.cta.title}</h2>
        {d.cta.desc && <p style={{ fontSize:13.5, color:C.soft, margin:'0 0 22px', lineHeight:1.75, opacity:.92 }}>{d.cta.desc}</p>}
        <button onClick={onCta}
          style={{ display:'inline-flex', alignItems:'center', gap:9, background:C.yellow, color:C.dark, fontWeight:800, fontSize:14, padding:'13px 22px', borderRadius:9, border:'none', letterSpacing:-0.2, cursor: onCta ? 'pointer' : 'default', fontFamily:SANS }}>
          {d.cta.buttonText} →
        </button>
      </section>

      {/* 확대 오버레이 — 탭하면 크게, 다시 탭하면 닫힘 */}
      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto', fontFamily:SANS }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:520, animation:'cdPop .16s ease-out' }}>
            {zoom.type === 'module'
              ? <ModuleCard m={zoom.item} C={C}/>
              : <ApproachCard a={zoom.item} C={C}/>}
            <div style={{ textAlign:'center', marginTop:12 }}>
              <button onClick={() => setZoom(null)}
                style={{ background:C.cream, color:C.dark, border:'none', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:SANS }}>닫기 ✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
