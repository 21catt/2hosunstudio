'use client'
import { useState, useRef } from 'react'
import { normalizeDoc } from '../../lib/coreDoc'
import { beadColor } from '../../lib/jellyColor'
import s from './jellyCourse.module.css'

// 3D 모양일 때의 「수업 내용」(핵심 내용 문서) — 3D 홈과 같은 종이색·흰 유리·잉크색·젤리 색.
// 내용·순서는 CoreDocView 와 같다(같은 normalizeDoc). 예전 화면은 CoreDocView 그대로.
// 시안 = https://claude.ai/artifact/SY1V4rVEExyBYQgra1PVZf (2026-10-20 사용자 확정)
// ⚠️ 영어 제목은 지어내지 않는다 — 강좌 머리말(eyebrow)의 「·」 앞부분이 영어면 그것을 기울인 세리프로 크게 쓴다.

// 기울인 세리프(Instrument Serif)는 한글 글자가 없어 브라우저가 한글을 억지로 기울인다 — 한글이면 본문 글꼴로
const hasKo = t => /[가-힣]/.test(t || '')
const titleCase = t => (/[a-z]/.test(t) ? t : t.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()))

function Orb({ color, children, small }) {
  return <span className={small ? `${s.orb} ${s.orbSm}` : s.orb} style={{ '--c': color }}>{children}</span>
}

function Head({ eyebrow, title }) {
  return (
    <div className={s.head}>
      {eyebrow && <span className={hasKo(eyebrow) ? s.headEyeKo : s.headEye}>{eyebrow}</span>}
      {title && <span className={s.headTitle}>{title}</span>}
    </div>
  )
}

function ModuleBody({ m, color }) {
  return (
    <>
      <div className={s.modRow}>
        <Orb color={color} small>{m.num}</Orb>
        <b className={s.modTitle}>{m.title}</b>
      </div>
      {m.en && <i className={s.en}>{m.en}</i>}
      {m.desc && <p className={s.p}>{m.desc}</p>}
      {m.bullets.length > 0 && <div className={s.tags}>{m.bullets.map((b, j) => <span key={j}>{b}</span>)}</div>}
      {m.painters.length > 0 && <div className={s.tags}>{m.painters.map((p, j) => <span key={j}>{p.ko}</span>)}</div>}
    </>
  )
}

export default function JellyCoreDoc({ doc, sample = false, onCta, color = '#5b7fe0' }) {
  const d = normalizeDoc(doc)
  const [zoom, setZoom] = useState(null)
  const modRefs = useRef({})
  const parts = (d.hero.eyebrow || '').split('·').map(t => t.trim())
  const enTitle = parts.length > 1 && /^[A-Za-z][A-Za-z\s&'-]*$/.test(parts[0]) ? titleCase(parts[0]) : null

  const groups = []
  d.modules.forEach((m, i) => {
    const cat = m.cat || ''
    const last = groups[groups.length - 1]
    if (last && last.cat === cat) last.items.push({ m, i })
    else groups.push({ cat, items: [{ m, i }] })
  })
  const jumpTo = i => modRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  return (
    <div className={s.doc} style={{ '--c': color }}>
      {sample && <div className={s.sample}>예시 미리보기 — 관리자가 작성하면 실제 핵심내용으로 바뀌어요</div>}

      <section className={s.hero}>
        {d.hero.eyebrow && <div className={s.eyebrow}>{enTitle ? parts.slice(1).join(' · ') : d.hero.eyebrow}</div>}
        {enTitle && <div className={s.heroEn}>{enTitle}</div>}
        <h2 className={s.heroKo}>{d.hero.title}<em>{d.hero.titleAccent}</em></h2>
        {d.hero.desc && <p className={s.p}>{d.hero.desc}</p>}
        {d.meta.length > 0 && (
          <div className={s.facts}>
            {d.meta.map((row, i) => <span key={i}><b>{row.k}</b>{row.v}</span>)}
          </div>
        )}
      </section>

      {(d.statement.title || d.statement.desc) && (
        <section className={s.stmt}>
          {d.statement.eyebrow && <div className={s.eyebrow}>{d.statement.eyebrow}</div>}
          {d.statement.title && <h3>{d.statement.title}</h3>}
          {d.statement.desc && <p>{d.statement.desc}</p>}
        </section>
      )}

      {d.approaches.length > 0 && (
        <section className={s.stack}>
          <Head eyebrow={d.sections.approaches.eyebrow} title={d.sections.approaches.title} />
          {d.approaches.map((a, i) => (
            <button key={i} type="button" className={s.card} onClick={() => setZoom({ type: 'approach', item: a, i })}>
              <Orb color={beadColor(color, i)}>{a.num}</Orb>
              <span className={s.cardBody}>
                <b className={s.modTitle}>{a.title}</b>
                {a.en && <i className={s.en}>{a.en}</i>}
                {a.desc && <span className={s.p}>{a.desc}</span>}
              </span>
              {a.image && <img className={s.thumb} src={a.image} alt="" loading="lazy" />}
            </button>
          ))}
        </section>
      )}

      {d.chips.length > 0 && (
        <section className={s.stack}>
          <Head eyebrow={d.sections.chips.eyebrow} title={d.sections.chips.title} />
          <div className={s.path}>
            {d.chips.map((c, i) => (
              <button key={i} type="button" className={s.step} onClick={() => jumpTo(i)}>
                <span className={s.bead} style={{ '--c': beadColor(color, i) }}>{String(i).padStart(2, '0')}</span>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {d.modules.length > 0 && groups.map((g, gi) => (
        <section key={gi} className={s.stack}>
          {g.cat && (
            <div className={s.catBar}>
              <b>{g.cat}</b>
              <span>{g.items[0].m.num}–{g.items[g.items.length - 1].m.num}</span>
            </div>
          )}
          {g.items.map(({ m, i }) => (
            <div key={i} ref={el => { modRefs.current[i] = el }} className={s.mod} role="button" tabIndex={0}
              onClick={() => setZoom({ type: 'module', item: m, i })}
              onKeyDown={e => { if (e.key === 'Enter') setZoom({ type: 'module', item: m, i }) }}>
              <ModuleBody m={m} color={beadColor(color, i)} />
              {m.image && <img className={s.modImg} src={m.image} alt="" loading="lazy" />}
            </div>
          ))}
        </section>
      ))}

      {d.outcomes.length > 0 && (
        <section className={s.done}>
          <Head eyebrow={d.sections.outcomes.eyebrow} title={d.sections.outcomes.title} />
          {d.outcomes.map((o, i) => (
            <div key={i} className={s.doneRow}>
              <span className={s.dot} style={{ '--c': beadColor(color, i + 3) }} />
              <span><b>{o.title}</b>{o.desc && <span className={s.p}>{o.desc}</span>}</span>
            </div>
          ))}
        </section>
      )}

      <section className={s.cta}>
        {d.cta.title && <h3 className={hasKo(d.cta.title) ? s.ctaKo : undefined}>{d.cta.title}</h3>}
        {d.cta.desc && <p>{d.cta.desc}</p>}
        {d.cta.buttonText && <button type="button" onClick={onCta}>{d.cta.buttonText} →</button>}
      </section>

      {zoom && (
        <div className={s.zoom} onClick={() => setZoom(null)}>
          <div className={s.zoomCard} onClick={e => e.stopPropagation()}>
            {zoom.type === 'module'
              ? <ModuleBody m={zoom.item} color={beadColor(color, zoom.i)} />
              : (<>
                  <div className={s.modRow}><Orb color={beadColor(color, zoom.i)} small>{zoom.item.num}</Orb><b className={s.modTitle}>{zoom.item.title}</b></div>
                  {zoom.item.en && <i className={s.en}>{zoom.item.en}</i>}
                  {zoom.item.desc && <p className={s.p}>{zoom.item.desc}</p>}
                </>)}
            {zoom.item.image && <img className={s.modImg} src={zoom.item.image} alt="" />}
            <button type="button" className={s.close} onClick={() => setZoom(null)}>닫기 ✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
