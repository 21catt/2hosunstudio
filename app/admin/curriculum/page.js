'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CoreDocEditor from '../../../components/CoreDocEditor'

const ACCENT      = 'var(--ac)'
const ACCENT_BG   = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'
const CARD        = 'var(--card)'
const BORDER      = 'var(--line)'

// ─── Sortable row ────────────────────────────────────────────────────────────
function SortableStepItem({ step, index, editing, setEditing, handleUpdate, handleDelete, handleDuplicate, saving, onUploadImage, uploading }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })

  const wrapStyle = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    zIndex: isDragging ? 20 : 'auto',
    position: 'relative',
    marginBottom: 8,
  }

  const isEditing = editing[step.id] !== undefined

  return (
    <div ref={setNodeRef} style={wrapStyle}>
      <div style={{
        borderRadius: 12,
        border: `1.5px solid ${isDragging ? ACCENT : BORDER}`,
        background: isDragging ? ACCENT_BG : CARD,
        overflow: 'hidden',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.13)' : 'none',
        transition: 'box-shadow 0.15s, border-color 0.12s',
      }}>
        {isEditing ? (
          <div style={{ padding:'10px 12px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>{index+1}회차 수정</div>
            <input
              value={editing[step.id].title || ''}
              onChange={e => setEditing(prev => ({ ...prev, [step.id]: { ...prev[step.id], title: e.target.value } }))}
              placeholder="회차 제목"
              style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:6, boxSizing:'border-box' }}/>
            <input
              value={editing[step.id].keyword || ''}
              onChange={e => setEditing(prev => ({ ...prev, [step.id]: { ...prev[step.id], keyword: e.target.value } }))}
              placeholder="키워드 (쉼표로 구분, 선택)"
              style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:8, boxSizing:'border-box' }}/>
            {editing[step.id].image_url && (
              <div style={{ position:'relative', marginBottom:6 }}>
                <img src={editing[step.id].image_url} alt="" style={{ width:'100%', maxHeight:150, objectFit:'cover', borderRadius:8, display:'block' }}/>
                <button onClick={() => setEditing(prev => ({ ...prev, [step.id]: { ...prev[step.id], image_url: '' } }))}
                  style={{ position:'absolute', top:5, right:5, width:22, height:22, borderRadius:11, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:14, cursor:'pointer', lineHeight:1 }}>×</button>
              </div>
            )}
            <label style={{ display:'block', textAlign:'center', padding:'7px', borderRadius:8, border:`1.5px dashed ${BORDER}`, background:'#fff', fontSize:11, fontWeight:700, color:'var(--tmu)', cursor: uploading?'default':'pointer', marginBottom:8 }}>
              {uploading ? '업로드 중...' : (editing[step.id].image_url ? '사진 변경' : '📷 사진 추가')}
              <input type="file" accept="image/*" disabled={uploading} style={{ display:'none' }}
                onChange={async e => { const f = e.target.files?.[0]; e.target.value=''; if (!f) return; const url = await onUploadImage(f); if (url) setEditing(prev => ({ ...prev, [step.id]: { ...prev[step.id], image_url: url } })) }}/>
            </label>
            <div style={{ display:'flex', gap:6 }}>
              <button
                onClick={() => setEditing(prev => { const n = { ...prev }; delete n[step.id]; return n })}
                style={{ flex:1, padding:'7px', background:'var(--g1)', border:'none', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                취소
              </button>
              <button
                onClick={() => handleUpdate(step)} disabled={saving}
                style={{ flex:2, padding:'7px', background:ACCENT, color:'#fff', border:'none', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                저장
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:8 }}>
            {/* Drag handle — listeners here only, prevents tap conflict */}
            <div
              {...attributes}
              {...listeners}
              style={{ flexShrink:0, padding:'6px 5px', cursor:'grab', touchAction:'none', userSelect:'none', color:'var(--tmu)', fontSize:19, lineHeight:1 }}>
              ≡
            </div>

            {step.image_url && (
              <img src={step.image_url} alt="" style={{ width:40, height:40, borderRadius:8, objectFit:'cover', flexShrink:0 }}/>
            )}

            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--td)' }}>
                <span style={{ fontSize:10, color:'var(--tmu)', marginRight:4 }}>{index+1}회차</span>
                {step.title}
              </div>
              {step.keyword && (
                <div style={{ fontSize:10, color:'var(--tmu)', marginTop:2 }}>
                  #{step.keyword.split(',').map(k => k.trim()).join(' #')}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              <button
                onClick={() => setEditing(prev => ({ ...prev, [step.id]: { title: step.title, keyword: step.keyword || '', image_url: step.image_url || '' } }))}
                style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'transparent', color:'var(--tmu)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                수정
              </button>
              <button
                onClick={() => handleDuplicate(step)} disabled={saving} title="이 회차를 복제해 바로 뒤에 추가"
                style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'transparent', color:'var(--acTx)', border:'1px solid rgb(var(--ac-rgb) / 0.4)', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                복제
              </button>
              <button
                onClick={() => handleDelete(step.id)}
                style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'transparent', color:'#c0392b', border:'1px solid #f5c6cb', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 핵심 내용 이미지: 꽉찬 폭 세로 나열 + 드래그 순서 변경 ────────────────────
function SortableCoreImage({ url, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url })
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: transition || undefined, zIndex: isDragging ? 20 : 'auto', position:'relative', marginBottom:8 }}>
      <img src={url} alt="" style={{ width:'100%', borderRadius:12, display:'block', border:`1.5px solid ${isDragging ? ACCENT : BORDER}`, boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : 'none', boxSizing:'border-box' }}/>
      {/* 드래그 핸들 — 핸들에만 listeners를 달아 스크롤과 충돌 방지 */}
      <div {...attributes} {...listeners}
        style={{ position:'absolute', top:8, left:8, width:30, height:30, borderRadius:9, background:'rgba(0,0,0,0.5)', color:'#fff', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center', cursor:'grab', touchAction:'none', userSelect:'none', lineHeight:1 }}>≡</div>
      <button onClick={onRemove}
        style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:13, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>×</button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function AdminCurriculumInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [courseNames, setCourseNames] = useState([])
  const [selectedName, setSelectedName] = useState(null)
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [editing, setEditing] = useState({})
  const [uploading, setUploading] = useState(false)
  // 개설 수업 '핵심 내용' (class_courses.core_content / core_images)
  const [coreContent, setCoreContent] = useState('')
  const [coreInitial, setCoreInitial] = useState('')
  const [coreImages, setCoreImages] = useState([])
  const [coreImagesInitial, setCoreImagesInitial] = useState([])
  const [coreSaving, setCoreSaving] = useState(false)
  const [coreUploading, setCoreUploading] = useState(false)
  const coreDirty = coreContent !== coreInitial || JSON.stringify(coreImages) !== JSON.stringify(coreImagesInitial)
  // 리치 핵심내용(인물화형) 문서 (class_courses.core_doc)
  const [coreDoc, setCoreDoc] = useState(null)
  const [coreDocSaving, setCoreDocSaving] = useState(false)

  // 커리큘럼 회차 사진 업로드 (공개 버킷 재사용, 학생/비회원도 조회 가능)
  async function uploadImage(file) {
    setUploading(true)
    try {
      const raw = file.name.split('.').pop().toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : 'jpg'
      const path = `curriculum/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('seat-photos').upload(path, file)
      if (error) { alert('업로드 실패: ' + error.message); return null }
      const { data } = supabase.storage.from('seat-photos').getPublicUrl(path)
      return data.publicUrl
    } finally {
      setUploading(false)
    }
  }

  // delay 150ms + tolerance 5px → scroll vs drag 구분
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      loadCourses()
    })
  }, [])

  async function loadCourses() {
    const { data } = await supabase.from('class_courses').select('name').order('name')
    const uniqueNames = [...new Set((data || []).map(c => c.name).filter(Boolean))]
    setCourseNames(uniqueNames)
    const qName = searchParams.get('course')
    const defaultName = uniqueNames.includes(qName) ? qName : (uniqueNames[0] || null)
    if (defaultName) {
      setSelectedName(defaultName)
      await Promise.all([loadSteps(defaultName), loadCore(defaultName)])
    }
    setLoading(false)
  }

  async function loadSteps(name) {
    const { data } = await supabase
      .from('course_curriculum')
      .select('*')
      .eq('course_name', name)
      .order('step_order')
    setSteps(data || [])
  }

  // 핵심 내용 로드 — core_content/core_images 컬럼이 아직 없어도 select('*')라 에러 없이 빈 값 처리
  async function loadCore(name) {
    const { data } = await supabase.from('class_courses').select('*').eq('name', name).limit(1)
    const val = data?.[0]?.core_content || ''
    const imgs = Array.isArray(data?.[0]?.core_images) ? data[0].core_images : []
    setCoreContent(val); setCoreInitial(val)
    setCoreImages(imgs); setCoreImagesInitial(imgs)
    setCoreDoc(data?.[0]?.core_doc || null)
  }

  // 리치 핵심내용 저장 — core_doc(jsonb) 컬럼 필요
  async function saveCoreDoc(doc) {
    if (!selectedName) return
    setCoreDocSaving(true)
    const { error } = await supabase.from('class_courses').update({ core_doc: doc }).eq('name', selectedName)
    setCoreDocSaving(false)
    if (error) {
      alert('리치 핵심내용 저장 실패: ' + error.message + '\n\nclass_courses.core_doc 컬럼이 없으면 migration-course-core-content.sql을 먼저 실행해 주세요.')
      return
    }
    setCoreDoc(doc)
    alert('리치 핵심내용이 저장됐어요!')
  }

  // 핵심 내용 사진 추가 (여러 장 가능, 공개 버킷)
  async function addCoreImages(files) {
    setCoreUploading(true)
    try {
      const urls = []
      for (const f of files) {
        const url = await uploadImage(f)
        if (url) urls.push(url)
      }
      if (urls.length) setCoreImages(prev => [...prev, ...urls])
    } finally {
      setCoreUploading(false)
    }
  }

  async function saveCore() {
    if (!selectedName) return
    setCoreSaving(true)
    const { error } = await supabase.from('class_courses')
      .update({ core_content: coreContent.trim() || null, core_images: coreImages.length ? coreImages : null })
      .eq('name', selectedName)
    setCoreSaving(false)
    if (error) {
      alert('핵심 내용 저장 실패: ' + error.message + '\n\nclass_courses.core_content / core_images 컬럼이 없으면 migration-course-core-content.sql을 먼저 실행해 주세요.')
      return
    }
    setCoreInitial(coreContent)
    setCoreImagesInitial(coreImages)
  }

  async function selectName(name) {
    setSelectedName(name)
    setAddingNew(false)
    setEditing({})
    setCoreDoc(undefined) // 로딩 중 표시 — 로드 완료 후에만 에디터 마운트 (빈 문서로 초기화되는 버그 방지)
    await Promise.all([loadSteps(name), loadCore(name)])
  }

  async function handleAdd() {
    if (!newTitle.trim() || !selectedName) return
    setSaving(true)
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) : 0
    await supabase.from('course_curriculum').insert({
      course_name: selectedName,
      step_order: maxOrder + 1,
      title: newTitle.trim(),
      keyword: newKeyword.trim() || null,
      image_url: newImageUrl || null,
    })
    setNewTitle('')
    setNewKeyword('')
    setNewImageUrl('')
    setAddingNew(false)
    setSaving(false)
    await loadSteps(selectedName)
  }

  // 회차 복제 — 원본을 그대로 복사해 바로 뒤에 끼워넣는다 (제목·키워드·사진 동일, 이후 수정 가능)
  async function handleDuplicate(step) {
    if (!selectedName || saving) return
    setSaving(true)
    try {
      const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) : 0
      const { data: dup } = await supabase.from('course_curriculum').insert({
        course_name: selectedName,
        step_order: maxOrder + 1, // 임시로 맨 뒤 → 아래 재정렬로 원본 뒤에 배치
        title: step.title,
        keyword: step.keyword || null,
        image_url: step.image_url || null,
      }).select().single()
      if (dup) {
        const ids = steps.map(s => s.id)
        const idx = ids.indexOf(step.id)
        const newOrder = [...ids.slice(0, idx + 1), dup.id, ...ids.slice(idx + 1)]
        await supabase.rpc('reorder_curriculum', { p_course_name: selectedName, p_ids: newOrder })
      }
      await loadSteps(selectedName)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(step) {
    const e = editing[step.id]
    if (!e || !e.title?.trim()) return
    setSaving(true)
    await supabase.from('course_curriculum').update({
      title: e.title.trim(),
      keyword: e.keyword?.trim() || null,
      image_url: e.image_url || null,
      updated_at: new Date().toISOString(),
    }).eq('id', step.id)
    setEditing(prev => { const n = { ...prev }; delete n[step.id]; return n })
    setSaving(false)
    await loadSteps(selectedName)
  }

  async function handleDelete(stepId) {
    if (!confirm('이 회차를 삭제할까요?')) return
    await supabase.from('course_curriculum').delete().eq('id', stepId)
    // re-order remaining sequentially (few rows, no unique conflict risk)
    const remaining = steps.filter(s => s.id !== stepId)
    for (let i = 0; i < remaining.length; i++) {
      await supabase.from('course_curriculum').update({ step_order: i + 1 }).eq('id', remaining[i].id)
    }
    await loadSteps(selectedName)
  }

  // Drop → call RPC which reassigns step_order 1..n atomically
  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIdx = steps.findIndex(s => s.id === active.id)
    const newIdx = steps.findIndex(s => s.id === over.id)
    const reordered = arrayMove(steps, oldIdx, newIdx)
    setSteps(reordered) // optimistic
    const { error } = await supabase.rpc('reorder_curriculum', {
      p_course_name: selectedName,
      p_ids: reordered.map(s => s.id),
    })
    if (error) await loadSteps(selectedName) // revert on failure
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="book" color="#fff" size={20} />
          <span className="header-title">커리큘럼 관리</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0', minHeight:'80vh' }}>

        {/* Course chips */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수업 선택</div>
          {courseNames.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--tmu)' }}>등록된 수업이 없어요</div>
          ) : (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {courseNames.map(name => (
                <button key={name} onClick={() => selectName(name)}
                  style={{
                    padding:'6px 14px', borderRadius:20,
                    border:`1.5px solid ${selectedName === name ? ACCENT : BORDER}`,
                    background: selectedName === name ? ACCENT_BG : CARD,
                    color: selectedName === name ? ACCENT_TEXT : 'var(--td)',
                    fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif'
                  }}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedName ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13 }}>수업을 선택하세요</div>
        ) : (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:ACCENT_TEXT, marginBottom:10 }}>
              {selectedName} — {steps.length}회차
            </div>

            {/* 핵심 내용 — 개설 수업 요약(학생 커리큘럼 '핵심 내용' 탭에 노출) */}
            <div style={{ borderRadius:12, border:`1.5px solid ${BORDER}`, background:CARD, padding:'12px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:ACCENT_TEXT }}>핵심 내용</div>
                <span style={{ fontSize:10, color:'var(--tmu)' }}>학생에게 이 수업의 핵심을 안내해요</span>
              </div>
              <textarea
                value={coreContent}
                onChange={e => setCoreContent(e.target.value)}
                rows={5}
                placeholder={`이 수업에서 다루는 핵심 내용을 적어주세요.\n예) 관찰 드로잉의 기본기 — 선·비례·명암을 8주간 단계별로 익힙니다.`}
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:13, resize:'vertical', fontFamily:'Nunito,sans-serif', boxSizing:'border-box', background:'#fff', lineHeight:1.6, outline:'none' }}/>

              {/* 핵심 내용 사진 — 꽉찬 폭 세로 나열, ≡ 핸들 드래그로 순서 변경 */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'10px 0 6px' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--tmu)' }}>사진</span>
                {coreImages.length > 1 && <span style={{ fontSize:9, color:'var(--tmu)' }}>≡ 핸들을 끌어 순서를 바꿔요</span>}
              </div>
              {coreImages.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return
                    setCoreImages(prev => arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)))
                  }}>
                  <SortableContext items={coreImages} strategy={verticalListSortingStrategy}>
                    {coreImages.map(url => (
                      <SortableCoreImage key={url} url={url}
                        onRemove={() => setCoreImages(prev => prev.filter(u => u !== url))}/>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
              <label style={{ display:'block', textAlign:'center', padding:'12px', borderRadius:10, border:`1.5px dashed ${BORDER}`, background:'#fff', fontSize:11, fontWeight:700, color:'var(--tmu)', cursor: coreUploading ? 'default' : 'pointer' }}>
                {coreUploading ? '업로드 중...' : '📷 사진 추가 (여러 장 가능)'}
                <input type="file" accept="image/*" multiple disabled={coreUploading} style={{ display:'none' }}
                  onChange={e => { const fs = Array.from(e.target.files || []); e.target.value=''; if (fs.length) addCoreImages(fs) }}/>
              </label>

              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
                <button
                  onClick={saveCore}
                  disabled={coreSaving || coreUploading || !coreDirty}
                  style={{ padding:'7px 16px', background: (coreSaving || coreUploading || !coreDirty) ? 'var(--g1)' : ACCENT, color: (coreSaving || coreUploading || !coreDirty) ? 'var(--tmu)' : '#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor: (coreSaving || coreUploading || !coreDirty) ? 'default' : 'pointer', fontFamily:'Nunito,sans-serif' }}>
                  {coreSaving ? '저장 중...' : !coreDirty ? '저장됨' : '핵심 내용 저장'}
                </button>
              </div>
            </div>

            {/* 리치 핵심내용(인물화형) — 저장하면 학생 핵심내용 탭에 랜딩형 뷰로 노출 */}
            <div style={{ borderRadius:12, border:`1.5px solid ${BORDER}`, background:CARD, padding:'12px', marginBottom:16 }}>
              <div style={{ fontSize:10, color:'var(--tmu)', marginBottom:10, lineHeight:1.5 }}>
                아래를 작성해 저장하면 학생 화면에서 이 수업의 핵심내용이 <b>인물화형 랜딩</b>으로 보여요. (비워 두면 위의 기본 텍스트/사진이 사용돼요)
              </div>
              {coreDoc === undefined ? (
                <div style={{ textAlign:'center', padding:'18px 0', fontSize:12, color:'var(--tmu)' }}>불러오는 중… 🐾</div>
              ) : (
                <CoreDocEditor key={selectedName} initialDoc={coreDoc} onUploadImage={uploadImage} onSave={saveCoreDoc} saving={coreDocSaving}/>
              )}
            </div>

            {/* Sortable list */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {steps.map((step, i) => (
                  <SortableStepItem
                    key={step.id}
                    step={step}
                    index={i}
                    editing={editing}
                    setEditing={setEditing}
                    handleUpdate={handleUpdate}
                    handleDelete={handleDelete}
                    handleDuplicate={handleDuplicate}
                    saving={saving}
                    onUploadImage={uploadImage}
                    uploading={uploading}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add form */}
            {addingNew ? (
              <div style={{ borderRadius:12, padding:'12px', border:'1.5px solid rgb(var(--ac-rgb) / 0.33)', background:ACCENT_BG, marginTop:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:ACCENT_TEXT, marginBottom:8 }}>{steps.length + 1}회차 추가</div>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="회차 제목 (예: 선 긋기 기초)"
                  style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:6, boxSizing:'border-box', background:'#fff' }}/>
                <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  placeholder="키워드 (쉼표로 구분, 선택)"
                  style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:10, boxSizing:'border-box', background:'#fff' }}/>
                {newImageUrl && (
                  <div style={{ position:'relative', marginBottom:8 }}>
                    <img src={newImageUrl} alt="" style={{ width:'100%', maxHeight:160, objectFit:'cover', borderRadius:10, display:'block' }}/>
                    <button onClick={() => setNewImageUrl('')}
                      style={{ position:'absolute', top:6, right:6, width:24, height:24, borderRadius:12, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:15, cursor:'pointer', lineHeight:1 }}>×</button>
                  </div>
                )}
                <label style={{ display:'block', textAlign:'center', padding:'9px', borderRadius:10, border:`1.5px dashed ${BORDER}`, background:'#fff', fontSize:12, fontWeight:700, color:'var(--tmu)', cursor: uploading?'default':'pointer', marginBottom:10 }}>
                  {uploading ? '업로드 중...' : (newImageUrl ? '사진 변경' : '📷 사진 추가 (선택)')}
                  <input type="file" accept="image/*" disabled={uploading} style={{ display:'none' }}
                    onChange={async e => { const f = e.target.files?.[0]; e.target.value=''; if (!f) return; const url = await uploadImage(f); if (url) setNewImageUrl(url) }}/>
                </label>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setAddingNew(false); setNewTitle(''); setNewKeyword(''); setNewImageUrl('') }}
                    style={{ flex:1, padding:'9px', background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                    취소
                  </button>
                  <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
                    style={{ flex:2, padding:'9px', background:ACCENT, color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: !newTitle.trim() ? 0.45 : 1 }}>
                    {saving ? '저장 중...' : '추가'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingNew(true)}
                style={{ width:'100%', padding:'11px', background:ACCENT_BG, color:ACCENT_TEXT, border:'1.5px solid rgb(var(--ac-rgb) / 0.33)', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', marginTop:6 }}>
                + 회차 추가
              </button>
            )}

            <div style={{ height:80 }}/>
          </>
        )}
      </div>

      <AdminNav active="curriculum"/>
    </>
  )
}

export default function AdminCurriculumPage() {
  return (
    <Suspense fallback={null}>
      <AdminCurriculumInner />
    </Suspense>
  )
}
