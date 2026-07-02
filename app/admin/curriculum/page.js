'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
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

const ACCENT      = '#3B6D11'
const ACCENT_BG   = '#EAF3DE'
const ACCENT_TEXT = '#27500A'
const CARD        = '#F1EFE8'
const BORDER      = 'rgba(0,0,0,0.14)'

// ─── Sortable row ────────────────────────────────────────────────────────────
function SortableStepItem({ step, index, editing, setEditing, handleUpdate, handleDelete, saving, onUploadImage, uploading }) {
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
      await loadSteps(defaultName)
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

  async function selectName(name) {
    setSelectedName(name)
    setAddingNew(false)
    setEditing({})
    await loadSteps(name)
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
          <span style={{ fontSize:20 }}>📚</span>
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
                    saving={saving}
                    onUploadImage={uploadImage}
                    uploading={uploading}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add form */}
            {addingNew ? (
              <div style={{ borderRadius:12, padding:'12px', border:`1.5px solid ${ACCENT}55`, background:ACCENT_BG, marginTop:6 }}>
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
                style={{ width:'100%', padding:'11px', background:ACCENT_BG, color:ACCENT_TEXT, border:`1.5px solid ${ACCENT}55`, borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', marginTop:6 }}>
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
