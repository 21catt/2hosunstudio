'use client'
import { useState, useRef } from 'react'
import { DEFAULT_CORE_DOC, normalizeDoc, CORE_PALETTES } from '../lib/coreDoc'
import CoreDocView from './CoreDocView'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// 관리자용 리치 핵심내용 편집기 — class_courses.core_doc(jsonb)를 구조적으로 작성.
// 리스트(모듈/접근/화가/불릿/메타)는 추가·삭제, 이미지는 업로드/삭제.
const BR = 'var(--line)'
const AC = 'var(--ac)'
const ACT = 'var(--acTx)'

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display:'block', marginBottom:8 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:3 }}>{label}</div>
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:`1.5px solid ${BR}`, fontSize:12, fontFamily:'Nunito,sans-serif', boxSizing:'border-box', background:'#fff', outline:'none' }}/>
    </label>
  )
}

function Area({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label style={{ display:'block', marginBottom:8 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:3 }}>{label}</div>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:`1.5px solid ${BR}`, fontSize:12, fontFamily:'Nunito,sans-serif', boxSizing:'border-box', background:'#fff', outline:'none', resize:'vertical', lineHeight:1.6 }}/>
    </label>
  )
}

function ImgField({ label, value, onChange, onUploadImage }) {
  const [busy, setBusy] = useState(false)
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:3 }}>{label}</div>
      {value ? (
        <div style={{ position:'relative', width:'100%', borderRadius:10, overflow:'hidden', border:`1.5px solid ${BR}` }}>
          <img src={value} alt="" style={{ width:'100%', display:'block' }}/>
          <button onClick={() => onChange('')}
            style={{ position:'absolute', top:6, right:6, width:24, height:24, borderRadius:12, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:14, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
      ) : (
        <label style={{ display:'block', textAlign:'center', padding:'12px', borderRadius:10, border:`1.5px dashed ${BR}`, background:'#fff', fontSize:11, fontWeight:700, color:'var(--tmu)', cursor: busy ? 'default' : 'pointer' }}>
          {busy ? '업로드 중...' : '📷 사진 추가'}
          <input type="file" accept="image/*" disabled={busy} style={{ display:'none' }}
            onChange={async e => { const f = e.target.files?.[0]; e.target.value=''; if (!f) return; setBusy(true); const url = await onUploadImage(f); setBusy(false); if (url) onChange(url) }}/>
        </label>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ border:`1.5px solid ${BR}`, borderRadius:12, padding:'12px', marginBottom:12, background:'#fff' }}>
      <div style={{ fontSize:12, fontWeight:800, color:ACT, marginBottom:10 }}>{title}</div>
      {children}
    </div>
  )
}

const miniBtn = { fontSize:10, padding:'4px 9px', borderRadius:8, border:`1px solid ${BR}`, background:'transparent', cursor:'pointer', fontFamily:'Nunito,sans-serif', color:'var(--tmu)' }
const addBtn = { ...miniBtn, borderColor:'rgb(var(--ac-rgb) / 0.4)', color:ACT, fontWeight:700 }

// 드래그로 순서 바꾸는 모듈 카드 — ≡ 핸들에만 listeners를 달아 입력/스크롤과 충돌 방지
function SortableModuleCard({ m, i, edit, onUploadImage }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m._id })
  const wrap = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    zIndex: isDragging ? 20 : 'auto', position:'relative',
    border:`1px solid ${isDragging ? AC : BR}`, borderRadius:10, padding:'10px', marginBottom:10, background:'var(--bg)',
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.13)' : 'none',
  }
  return (
    <div ref={setNodeRef} style={wrap}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span {...attributes} {...listeners}
            style={{ cursor:'grab', touchAction:'none', userSelect:'none', color:'var(--tmu)', fontSize:17, lineHeight:1, padding:'2px 4px' }}>≡</span>
          <span style={{ fontSize:11, fontWeight:800, color:ACT }}>모듈 {i+1}</span>
        </div>
        <button onClick={() => edit(x => { x.modules.splice(i,1); return x })} style={miniBtn}>삭제</button>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ width:64 }}><Field label="번호" value={m.num} onChange={v => edit(x => { x.modules[i].num = v; return x })}/></div>
        <div style={{ flex:1 }}><Field label="카테고리" value={m.cat} onChange={v => edit(x => { x.modules[i].cat = v; return x })}/></div>
      </div>
      <Field label="제목" value={m.title} onChange={v => edit(x => { x.modules[i].title = v; return x })}/>
      <Field label="영문 라벨" value={m.en} onChange={v => edit(x => { x.modules[i].en = v; return x })}/>
      <Area label="설명" value={m.desc} onChange={v => edit(x => { x.modules[i].desc = v; return x })} rows={2}/>
      <Area label="불릿 (줄바꿈으로 구분)" value={m.bullets.join('\n')} onChange={v => edit(x => { x.modules[i].bullets = v.split('\n'); return x })} rows={3}/>

      {/* 화가 (선택) */}
      <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', margin:'6px 0 4px' }}>화가 카드 (선택)</div>
      {m.painters.map((p, j) => (
        <div key={j} style={{ border:`1px solid ${BR}`, borderRadius:8, padding:'8px', marginBottom:6, background:'#fff' }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => edit(x => { x.modules[i].painters.splice(j,1); return x })} style={miniBtn}>화가 삭제</button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }}><Field label="이름" value={p.ko} onChange={v => edit(x => { x.modules[i].painters[j].ko = v; return x })}/></div>
            <div style={{ flex:1 }}><Field label="영문" value={p.en} onChange={v => edit(x => { x.modules[i].painters[j].en = v; return x })}/></div>
          </div>
          <Area label="포인트 (줄바꿈으로 구분)" value={p.points.join('\n')} onChange={v => edit(x => { x.modules[i].painters[j].points = v.split('\n'); return x })} rows={3}/>
        </div>
      ))}
      <button onClick={() => edit(x => { x.modules[i].painters.push({ ko:'', en:'', points:[] }); return x })} style={{ ...addBtn, marginBottom:8 }}>+ 화가 추가</button>

      <ImgField label="모듈 이미지(선택)" value={m.image} onChange={v => edit(x => { x.modules[i].image = v; return x })} onUploadImage={onUploadImage}/>
    </div>
  )
}

export default function CoreDocEditor({ initialDoc, onUploadImage, onSave, saving }) {
  const idc = useRef(0)
  const nextMid = () => `m${idc.current++}`
  const withMids = doc => { const nd = normalizeDoc(doc); nd.modules = nd.modules.map(m => ({ ...m, _id: nextMid() })); return nd }
  const [d, setD] = useState(() => withMids(initialDoc))
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState(false)
  // delay 150ms + tolerance 5px → 입력/스크롤 vs 드래그 구분
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  )
  function handleModuleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    edit(x => {
      const oldIdx = x.modules.findIndex(m => m._id === active.id)
      const newIdx = x.modules.findIndex(m => m._id === over.id)
      if (oldIdx < 0 || newIdx < 0) return x
      x.modules = arrayMove(x.modules, oldIdx, newIdx)
      return x
    })
  }
  const edit = fn => { setD(prev => { const next = fn(structuredClone(prev)); return next }); setDirty(true) }

  const loadSample = () => { setD(withMids(DEFAULT_CORE_DOC)); setDirty(true) }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:800, color:ACT }}>리치 핵심내용 (인물화형)</div>
        <button onClick={loadSample} style={addBtn}>인물화 샘플 불러오기</button>
      </div>

      <Section title="색상 테마">
        <div style={{ fontSize:10, color:'var(--tmu)', marginBottom:8, lineHeight:1.5 }}>고르면 학생 화면 랜딩 전체 색이 바뀌어요. 미리보기로 확인해 보세요.</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {CORE_PALETTES.map(p => {
            const on = d.theme === p.key
            return (
              <button key={p.key} onClick={() => edit(x => { x.theme = p.key; return x })}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', borderRadius:10, cursor:'pointer', fontFamily:'Nunito,sans-serif', textAlign:'left',
                  border: on ? `2px solid ${p.accent}` : `1.5px solid ${BR}`, background: on ? p.bg : '#fff' }}>
                <span style={{ display:'flex', flexShrink:0, borderRadius:6, overflow:'hidden', border:`1px solid ${BR}` }}>
                  <span style={{ width:14, height:22, background:p.hero }}/>
                  <span style={{ width:14, height:22, background:p.accent }}/>
                  <span style={{ width:14, height:22, background:p.accent2 }}/>
                </span>
                <span style={{ flex:1, minWidth:0, fontSize:11.5, fontWeight: on ? 800 : 700, color: on ? p.accent : 'var(--td)' }}>{p.name}</span>
                {on && <span style={{ fontSize:12, color:p.accent, flexShrink:0 }}>✓</span>}
              </button>
            )
          })}
        </div>
        <button onClick={() => setPreview(v => !v)}
          style={{ ...addBtn, width:'100%', marginTop:10, padding:'9px', textAlign:'center' }}>
          {preview ? '미리보기 닫기 ▲' : '🎨 미리보기 열기 ▼'}
        </button>
        {preview && (
          <div style={{ marginTop:10, borderRadius:14, overflow:'hidden', border:`2px solid ${BR}`, maxHeight:460, overflowY:'auto' }}>
            <CoreDocView doc={d} />
          </div>
        )}
      </Section>

      <Section title="히어로">
        <Field label="상단 라벨(영문 등)" value={d.hero.eyebrow} onChange={v => edit(x => { x.hero.eyebrow = v; return x })}/>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:2 }}><Field label="제목" value={d.hero.title} onChange={v => edit(x => { x.hero.title = v; return x })}/></div>
          <div style={{ flex:1 }}><Field label="강조 끝말" value={d.hero.titleAccent} onChange={v => edit(x => { x.hero.titleAccent = v; return x })}/></div>
        </div>
        <Area label="설명" value={d.hero.desc} onChange={v => edit(x => { x.hero.desc = v; return x })}/>
        <ImgField label="히어로 이미지" value={d.hero.image} onChange={v => edit(x => { x.hero.image = v; return x })} onUploadImage={onUploadImage}/>
      </Section>

      <Section title="정보(메타)">
        {d.meta.map((row, i) => (
          <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-end', marginBottom:6 }}>
            <div style={{ width:90 }}><Field label={i===0?'항목':''} value={row.k} onChange={v => edit(x => { x.meta[i].k = v; return x })}/></div>
            <div style={{ flex:1 }}><Field label={i===0?'내용':''} value={row.v} onChange={v => edit(x => { x.meta[i].v = v; return x })}/></div>
            <button onClick={() => edit(x => { x.meta.splice(i,1); return x })} style={{ ...miniBtn, marginBottom:8 }}>삭제</button>
          </div>
        ))}
        <button onClick={() => edit(x => { x.meta.push({ k:'', v:'' }); return x })} style={addBtn}>+ 항목 추가</button>
      </Section>

      <Section title="스테이트먼트">
        <Field label="상단 라벨" value={d.statement.eyebrow} onChange={v => edit(x => { x.statement.eyebrow = v; return x })}/>
        <Area label="제목" value={d.statement.title} onChange={v => edit(x => { x.statement.title = v; return x })} rows={2}/>
        <Area label="설명" value={d.statement.desc} onChange={v => edit(x => { x.statement.desc = v; return x })}/>
      </Section>

      <Section title="무엇을 다루나 (접근)">
        {d.approaches.map((a, i) => (
          <div key={i} style={{ border:`1px solid ${BR}`, borderRadius:10, padding:'10px', marginBottom:8, background:'var(--bg)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'var(--tmu)' }}>접근 {i+1}</span>
              <button onClick={() => edit(x => { x.approaches.splice(i,1); return x })} style={miniBtn}>삭제</button>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ width:70 }}><Field label="번호" value={a.num} onChange={v => edit(x => { x.approaches[i].num = v; return x })}/></div>
              <div style={{ flex:1 }}><Field label="제목" value={a.title} onChange={v => edit(x => { x.approaches[i].title = v; return x })}/></div>
            </div>
            <Field label="영문 라벨" value={a.en} onChange={v => edit(x => { x.approaches[i].en = v; return x })}/>
            <Area label="설명" value={a.desc} onChange={v => edit(x => { x.approaches[i].desc = v; return x })} rows={2}/>
            <ImgField label="이미지(선택)" value={a.image} onChange={v => edit(x => { x.approaches[i].image = v; return x })} onUploadImage={onUploadImage}/>
          </div>
        ))}
        <button onClick={() => edit(x => { x.approaches.push({ num:'', title:'', en:'', desc:'', image:'' }); return x })} style={addBtn}>+ 접근 추가</button>
      </Section>

      <Section title="모듈 흐름(칩)">
        <Area label="칩 (줄바꿈으로 구분)" rows={2}
          value={d.chips.join('\n')} onChange={v => edit(x => { x.chips = v.split('\n'); return x })}/>
      </Section>

      <Section title="모듈">
        {d.modules.length > 1 && (
          <div style={{ fontSize:10, color:'var(--tmu)', marginBottom:8 }}>≡ 핸들을 끌어 순서를 바꿔요</div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
          <SortableContext items={d.modules.map(m => m._id)} strategy={verticalListSortingStrategy}>
            {d.modules.map((m, i) => (
              <SortableModuleCard key={m._id} m={m} i={i} edit={edit} onUploadImage={onUploadImage}/>
            ))}
          </SortableContext>
        </DndContext>
        <button onClick={() => edit(x => { x.modules.push({ num:'', cat:'', title:'', en:'', desc:'', painters:[], bullets:[], image:'', _id: nextMid() }); return x })} style={addBtn}>+ 모듈 추가</button>
      </Section>

      <Section title="CTA(하단)">
        <Area label="제목 (줄바꿈 허용)" value={d.cta.title} onChange={v => edit(x => { x.cta.title = v; return x })} rows={2}/>
        <Area label="설명" value={d.cta.desc} onChange={v => edit(x => { x.cta.desc = v; return x })} rows={2}/>
        <Field label="버튼 문구" value={d.cta.buttonText} onChange={v => edit(x => { x.cta.buttonText = v; return x })}/>
        <ImgField label="CTA 이미지" value={d.cta.image} onChange={v => edit(x => { x.cta.image = v; return x })} onUploadImage={onUploadImage}/>
      </Section>

      <button
        onClick={async () => { await onSave(normalizeDoc(d)); setDirty(false) }}
        disabled={saving || !dirty}
        style={{ width:'100%', padding:'12px', background: (saving || !dirty) ? 'var(--g1)' : AC, color: (saving || !dirty) ? 'var(--tmu)' : '#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor: (saving || !dirty) ? 'default' : 'pointer', fontFamily:'Nunito,sans-serif' }}>
        {saving ? '저장 중...' : !dirty ? '저장됨' : '리치 핵심내용 저장'}
      </button>
    </div>
  )
}
