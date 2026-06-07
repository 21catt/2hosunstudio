'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'

const ACCENT = '#3B6D11'
const ACCENT_BG = '#EAF3DE'
const ACCENT_TEXT = '#27500A'
const CARD = '#F1EFE8'
const BORDER = 'rgba(0,0,0,0.14)'

export default function AdminCurriculumPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New step form
  const [newTitle, setNewTitle] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [addingNew, setAddingNew] = useState(false)

  // Inline editing
  const [editing, setEditing] = useState({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadCourses()
    })
  }, [])

  async function loadCourses() {
    const { data } = await supabase.from('class_courses').select('id, name, category').order('name')
    setCourses(data || [])
    setLoading(false)
  }

  async function selectCourse(course) {
    setSelectedCourse(course)
    setAddingNew(false)
    setEditing({})
    const { data } = await supabase
      .from('course_curriculum')
      .select('*')
      .eq('course_id', course.id)
      .order('step_order')
    setSteps(data || [])
  }

  async function handleAdd() {
    if (!newTitle.trim() || !selectedCourse) return
    setSaving(true)
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) : 0
    await supabase.from('course_curriculum').insert({
      course_id: selectedCourse.id,
      step_order: maxOrder + 1,
      title: newTitle.trim(),
      keyword: newKeyword.trim() || null
    })
    setNewTitle('')
    setNewKeyword('')
    setAddingNew(false)
    setSaving(false)
    await selectCourse(selectedCourse)
  }

  async function handleUpdate(step) {
    const e = editing[step.id]
    if (!e || !e.title?.trim()) return
    setSaving(true)
    await supabase.from('course_curriculum').update({
      title: e.title.trim(),
      keyword: e.keyword?.trim() || null,
      updated_at: new Date().toISOString()
    }).eq('id', step.id)
    setEditing(prev => { const n = {...prev}; delete n[step.id]; return n })
    setSaving(false)
    await selectCourse(selectedCourse)
  }

  async function handleDelete(stepId) {
    if (!confirm('이 회차를 삭제할까요?')) return
    await supabase.from('course_curriculum').delete().eq('id', stepId)
    // Re-order remaining steps
    const remaining = steps.filter(s => s.id !== stepId)
    for (let i = 0; i < remaining.length; i++) {
      await supabase.from('course_curriculum').update({ step_order: i + 1 }).eq('id', remaining[i].id)
    }
    await selectCourse(selectedCourse)
  }

  async function moveStep(index, direction) {
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= steps.length) return
    const a = steps[index]
    const b = steps[swapIndex]
    await Promise.all([
      supabase.from('course_curriculum').update({ step_order: b.step_order }).eq('id', a.id),
      supabase.from('course_curriculum').update({ step_order: a.step_order }).eq('id', b.id),
    ])
    await selectCourse(selectedCourse)
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

        {/* Course list */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>수업 선택</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {courses.map(c => (
              <button key={c.id} onClick={() => selectCourse(c)}
                style={{
                  padding:'6px 14px', borderRadius:20, border:`1.5px solid ${selectedCourse?.id === c.id ? ACCENT : BORDER}`,
                  background: selectedCourse?.id === c.id ? ACCENT_BG : CARD,
                  color: selectedCourse?.id === c.id ? ACCENT_TEXT : 'var(--td)',
                  fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif'
                }}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {!selectedCourse ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13 }}>수업을 선택하세요</div>
        ) : (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:ACCENT_TEXT, marginBottom:10 }}>
              {selectedCourse.name} — {steps.length}회차
            </div>

            {/* Steps list */}
            {steps.map((step, i) => (
              <div key={step.id} style={{ borderRadius:12, marginBottom:8, border:`1.5px solid ${BORDER}`, background:CARD, overflow:'hidden' }}>
                {editing[step.id] ? (
                  <div style={{ padding:'10px 12px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>{i+1}회차 수정</div>
                    <input value={editing[step.id].title || ''}
                      onChange={e => setEditing(prev => ({ ...prev, [step.id]: { ...prev[step.id], title: e.target.value } }))}
                      placeholder="회차 제목"
                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:6, boxSizing:'border-box' }}/>
                    <input value={editing[step.id].keyword || ''}
                      onChange={e => setEditing(prev => ({ ...prev, [step.id]: { ...prev[step.id], keyword: e.target.value } }))}
                      placeholder="키워드 (쉼표로 구분, 선택)"
                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:8, boxSizing:'border-box' }}/>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setEditing(prev => { const n={...prev}; delete n[step.id]; return n })}
                        style={{ flex:1, padding:'7px', background:'var(--g1)', border:'none', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        취소
                      </button>
                      <button onClick={() => handleUpdate(step)} disabled={saving}
                        style={{ flex:2, padding:'7px', background:ACCENT, color:'#fff', border:'none', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:8 }}>
                    {/* reorder buttons */}
                    <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
                      <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                        style={{ width:20, height:20, borderRadius:4, border:`1px solid ${BORDER}`, background:'#fff', fontSize:10, cursor: i===0 ? 'default' : 'pointer', opacity: i===0 ? 0.3 : 1, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Nunito,sans-serif' }}>
                        ↑
                      </button>
                      <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                        style={{ width:20, height:20, borderRadius:4, border:`1px solid ${BORDER}`, background:'#fff', fontSize:10, cursor: i===steps.length-1 ? 'default' : 'pointer', opacity: i===steps.length-1 ? 0.3 : 1, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Nunito,sans-serif' }}>
                        ↓
                      </button>
                    </div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--td)' }}>
                        <span style={{ fontSize:10, color:'var(--tmu)', marginRight:4 }}>{i+1}회차</span>
                        {step.title}
                      </div>
                      {step.keyword && (
                        <div style={{ fontSize:10, color:'var(--tmu)', marginTop:2 }}>
                          #{step.keyword.split(',').map(k => k.trim()).join(' #')}
                        </div>
                      )}
                    </div>

                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      <button onClick={() => setEditing(prev => ({ ...prev, [step.id]: { title: step.title, keyword: step.keyword || '' } }))}
                        style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'transparent', color:'var(--tmu)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        수정
                      </button>
                      <button onClick={() => handleDelete(step.id)}
                        style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'transparent', color:'#c0392b', border:'1px solid #f5c6cb', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add new step */}
            {addingNew ? (
              <div style={{ borderRadius:12, padding:'12px', border:`1.5px solid ${ACCENT}55`, background:ACCENT_BG, marginTop:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:ACCENT_TEXT, marginBottom:8 }}>{steps.length + 1}회차 추가</div>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="회차 제목 (예: 선 긋기 기초)"
                  style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:6, boxSizing:'border-box', background:'#fff' }}/>
                <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  placeholder="키워드 (쉼표로 구분, 선택)"
                  style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:12, fontFamily:'Nunito,sans-serif', marginBottom:10, boxSizing:'border-box', background:'#fff' }}/>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setAddingNew(false); setNewTitle(''); setNewKeyword('') }}
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
