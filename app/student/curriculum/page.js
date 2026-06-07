'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'

const ACCENT = '#3B6D11'
const ACCENT_BG = '#EAF3DE'
const ACCENT_TEXT = '#27500A'
const CARD = '#F1EFE8'
const BORDER = 'rgba(0,0,0,0.14)'

// ─────────────────────────────────────────────
// Record bottom sheet
// ─────────────────────────────────────────────
function RecordSheet({ params, userId, onClose, onSaved }) {
  const { curriculumId, courseId, classDate, classTitle, mode: initMode } = params
  const [mode, setMode] = useState(initMode)
  const [record, setRecord] = useState(null)
  const [photos, setPhotos] = useState([])       // { id, storage_path, signedUrl }
  const [feedback, setFeedback] = useState([])
  const [memo, setMemo] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const pendingUrlsRef = useRef([])

  useEffect(() => {
    loadRecord()
    return () => pendingUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
  }, [])

  useEffect(() => { pendingUrlsRef.current = previewUrls }, [previewUrls])

  async function loadRecord() {
    setLoading(true)
    const { data: rec } = await supabase
      .from('class_records')
      .select('*')
      .eq('user_id', userId)
      .eq('curriculum_id', curriculumId)
      .maybeSingle()

    if (rec) {
      setRecord(rec)
      setMemo(rec.memo || '')

      const { data: photoRows } = await supabase
        .from('class_record_photos')
        .select('id, storage_path')
        .eq('record_id', rec.id)

      if (photoRows?.length) {
        const withUrls = await Promise.all(
          photoRows.map(async p => {
            const { data } = await supabase.storage
              .from('class-records')
              .createSignedUrl(p.storage_path, 300)
            return { id: p.id, storage_path: p.storage_path, signedUrl: data?.signedUrl || null }
          })
        )
        setPhotos(withUrls)
      }

      const { data: fb } = await supabase
        .from('class_record_feedback')
        .select('*')
        .eq('record_id', rec.id)
      setFeedback(fb || [])
    } else if (mode === 'view') {
      setMode('create')
    }
    setLoading(false)
  }

  function handleFilePick(e) {
    const files = Array.from(e.target.files)
    const urls = files.map(f => URL.createObjectURL(f))
    setPendingFiles(prev => [...prev, ...files])
    setPreviewUrls(prev => [...prev, ...urls])
    e.target.value = ''
  }

  function removePending(idx) {
    URL.revokeObjectURL(previewUrls[idx])
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleDeletePhoto(photo) {
    try {
      await supabase.storage.from('class-records').remove([photo.storage_path])
      await supabase.from('class_record_photos').delete().eq('id', photo.id)
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
    } catch {
      setErr('사진 삭제에 실패했어요')
    }
  }

  async function handleSave() {
    setSaving(true)
    setErr(null)
    try {
      let recId = record?.id

      if (!recId) {
        // Get teacher_id from course
        const { data: course } = await supabase
          .from('class_courses')
          .select('teacher_id')
          .eq('id', courseId)
          .maybeSingle()

        const { data: newRec, error: insErr } = await supabase
          .from('class_records')
          .insert({
            user_id: userId,
            curriculum_id: curriculumId,
            course_id: courseId,
            class_date: classDate,
            class_name: classTitle,
            teacher_id: course?.teacher_id || null,
            memo: memo.trim() || null,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        recId = newRec.id
        setRecord(newRec)
      } else {
        const { error: updErr } = await supabase
          .from('class_records')
          .update({ memo: memo.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', recId)
        if (updErr) throw updErr
      }

      // Upload pending photos
      const failed = []
      for (const file of pendingFiles) {
        try {
          const raw = file.name.split('.').pop().toLowerCase()
          const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : 'jpg'
          const path = `${userId}/${recId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await supabase.storage.from('class-records').upload(path, file)
          if (upErr) { failed.push(file.name); continue }
          await supabase.from('class_record_photos').insert({ record_id: recId, storage_path: path })
        } catch {
          failed.push(file.name)
        }
      }

      previewUrls.forEach(u => URL.revokeObjectURL(u))
      setPendingFiles([])
      setPreviewUrls([])

      if (failed.length > 0) {
        setErr(`일부 사진 업로드 실패: ${failed.join(', ')}`)
        setSaving(false)
        await loadRecord()
        setMode('view')
      } else {
        onSaved()
      }
    } catch (e) {
      setErr(e.message || '저장 실패')
      setSaving(false)
    }
  }

  const isEdit = mode === 'create' || mode === 'edit'
  const dateLabel = classDate?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3') || ''

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.45)', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', maxHeight:'88vh', overflowY:'auto' }}>

        {/* drag handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'#ddd' }}/>
        </div>

        {/* header */}
        <div style={{ padding:'10px 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--td)' }}>{classTitle}</div>
            <div style={{ fontSize:11, color:'var(--tmu)' }}>{dateLabel} 기록</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {mode === 'view' && record && (
              <button onClick={() => setMode('edit')}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background:'var(--g1)', color:'var(--tmu)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                수정
              </button>
            )}
            <button onClick={onClose}
              style={{ fontSize:22, lineHeight:1, padding:'0 4px', background:'none', border:'none', cursor:'pointer', color:'#aaa' }}>
              ×
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
            <span style={{ fontSize:30 }}>🐱</span>
          </div>
        ) : (
          <div style={{ padding:'16px 16px 36px' }}>

            {/* Photos */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>사진</div>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                {/* saved photos */}
                {photos.map(p => (
                  <div key={p.id} style={{ position:'relative', width:82, height:82, borderRadius:10, overflow:'hidden', background:'var(--g1)', flexShrink:0 }}>
                    {p.signedUrl
                      ? <img src={p.signedUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📷</div>
                    }
                    {isEdit && (
                      <button onClick={() => handleDeletePhoto(p)}
                        style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:9, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {/* pending previews */}
                {previewUrls.map((url, i) => (
                  <div key={`pr${i}`} style={{ position:'relative', width:82, height:82, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
                    <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.72 }}/>
                    <button onClick={() => removePending(i)}
                      style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:9, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
                      ×
                    </button>
                  </div>
                ))}
                {/* add button */}
                {isEdit && (
                  <label style={{ width:82, height:82, borderRadius:10, border:`1.5px dashed ${BORDER}`, background:'var(--g1)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, gap:2 }}>
                    <span style={{ fontSize:24, color:'#ccc', lineHeight:1 }}>+</span>
                    <span style={{ fontSize:9, color:'var(--tmu)' }}>사진 추가</span>
                    <input type="file" multiple accept="image/*" onChange={handleFilePick} style={{ display:'none' }}/>
                  </label>
                )}
                {!isEdit && photos.length === 0 && (
                  <div style={{ fontSize:12, color:'var(--tmu)', padding:'4px 0' }}>사진 없음</div>
                )}
              </div>
            </div>

            {/* Memo */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:6 }}>메모</div>
              {isEdit ? (
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={4}
                  placeholder="오늘 배운 것, 느낀 점, 다음에 해볼 것..."
                  style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:`1.5px solid ${BORDER}`, fontSize:13, resize:'none', fontFamily:'Nunito,sans-serif', boxSizing:'border-box', outline:'none' }}/>
              ) : (
                <div style={{ fontSize:13, color: memo ? 'var(--td)' : 'var(--tmu)', lineHeight:1.7, whiteSpace:'pre-wrap', padding:'10px 12px', background:CARD, borderRadius:12, minHeight:48 }}>
                  {memo || '메모 없음'}
                </div>
              )}
            </div>

            {/* Teacher feedback (view only) */}
            {!isEdit && feedback.length > 0 && (
              <div style={{ marginBottom:16, background:ACCENT_BG, borderRadius:12, padding:'12px 14px', border:`1.5px solid ${ACCENT}33` }}>
                <div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginBottom:8 }}>강사 피드백</div>
                {feedback.map(fb => (
                  <div key={fb.id} style={{ fontSize:13, color:'var(--td)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                    {fb.body}
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {err && (
              <div style={{ fontSize:12, color:'#c0392b', background:'#fdf3f3', borderRadius:8, padding:'8px 12px', marginBottom:14, lineHeight:1.5 }}>
                {err}
              </div>
            )}

            {/* Save */}
            {isEdit && (
              <button onClick={handleSave} disabled={saving}
                style={{ width:'100%', padding:'13px', background: saving ? '#aaa' : ACCENT, color:'#fff', border:'none', borderRadius:14, fontSize:14, fontWeight:700, cursor: saving ? 'default' : 'pointer', fontFamily:'Nunito,sans-serif' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
function CurriculumInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [steps, setSteps] = useState([])
  const [n, setN] = useState(0)
  const [hasTodayBooking, setHasTodayBooking] = useState(false)
  const [bookingDates, setBookingDates] = useState([]) // sorted asc, for classDate mapping
  const [recordMap, setRecordMap] = useState({})       // curriculum_id → record row
  const [loading, setLoading] = useState(true)
  const [recordSheet, setRecordSheet] = useState(null) // params for RecordSheet

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadInitial(data.user.id)
    })
  }, [])

  async function loadInitial(userId) {
    const { data: currRows } = await supabase.from('course_curriculum').select('course_id')
    const currCourseIds = [...new Set((currRows || []).map(r => r.course_id))]
    if (currCourseIds.length === 0) { setLoading(false); return }

    const { data: allBookings } = await supabase
      .from('bookings')
      .select('course_id, class_date')
      .eq('user_id', userId)
      .in('course_id', currCourseIds)
      .order('class_date', { ascending: false })

    const enrolledIds = [...new Set((allBookings || []).map(b => b.course_id).filter(Boolean))]
    if (enrolledIds.length === 0) { setLoading(false); return }

    const { data: crs } = await supabase
      .from('class_courses')
      .select('id, name, category')
      .in('id', enrolledIds)
      .order('name')
    setCourses(crs || [])

    const qCourseId = searchParams.get('course')
    const mostRecentCourseId = (allBookings || [])[0]?.course_id
    const defaultCourse =
      (crs || []).find(c => c.id === qCourseId) ||
      (crs || []).find(c => c.id === mostRecentCourseId) ||
      (crs || [])[0] || null

    if (defaultCourse) {
      setSelectedCourse(defaultCourse)
      await loadCourseData(userId, defaultCourse.id)
    }
    setLoading(false)
  }

  async function loadCourseData(userId, courseId) {
    const [{ data: stepsData }, { data: bks }] = await Promise.all([
      supabase.from('course_curriculum').select('*').eq('course_id', courseId).order('step_order'),
      supabase.from('bookings')
        .select('class_date')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'booked')
        .lte('class_date', todayStr),
    ])

    setSteps(stepsData || [])

    const sorted = (bks || []).map(b => b.class_date).sort()
    setBookingDates(sorted)
    setN(sorted.length)
    setHasTodayBooking(sorted.includes(todayStr))

    const stepIds = (stepsData || []).map(s => s.id)
    if (stepIds.length > 0) {
      const { data: recs, error } = await supabase
        .from('class_records')
        .select('id, curriculum_id')
        .eq('user_id', userId)
        .in('curriculum_id', stepIds)
      if (!error && recs) {
        const map = {}
        recs.forEach(r => { if (r.curriculum_id) map[r.curriculum_id] = r })
        setRecordMap(map)
      }
    }
  }

  async function handleSelectCourse(course) {
    if (!user || selectedCourse?.id === course.id) return
    setSelectedCourse(course)
    setSteps([])
    setN(0)
    setHasTodayBooking(false)
    setBookingDates([])
    setRecordMap({})
    await loadCourseData(user.id, course.id)
  }

  function openRecordSheet(step, i, status, mode) {
    // i is 1-based; bookingDates[i-1] is the date of the i-th session
    const classDate = status === 'today'
      ? todayStr
      : (bookingDates[i - 1] || todayStr)
    setRecordSheet({
      curriculumId: step.id,
      courseId: selectedCourse.id,
      classDate,
      classTitle: step.title,
      mode,
    })
  }

  function getStepStatus(i) {
    if (i <= n) return 'done'
    if (i === n + 1) return hasTodayBooking ? 'today' : 'next'
    return 'upcoming'
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
          <span className="header-title">학습 경로</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0', minHeight:'80vh' }}>

        {courses.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13, lineHeight:1.8 }}>
            커리큘럼이 등록된 수업이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>강사님이 학습 경로를 등록하면 여기서 볼 수 있어요</span>
          </div>
        ) : (
          <>
            {courses.length > 1 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
                {courses.map(c => (
                  <button key={c.id} onClick={() => handleSelectCourse(c)}
                    style={{
                      padding:'6px 14px', borderRadius:20,
                      border:`1.5px solid ${selectedCourse?.id === c.id ? ACCENT : BORDER}`,
                      background: selectedCourse?.id === c.id ? ACCENT_BG : CARD,
                      color: selectedCourse?.id === c.id ? ACCENT_TEXT : 'var(--td)',
                      fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif'
                    }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {selectedCourse && (
              <>
                {/* progress header */}
                <div style={{ background:ACCENT_BG, borderRadius:14, padding:'14px', marginBottom:18, border:`1.5px solid ${ACCENT}33` }}>
                  <div style={{ fontSize:13, fontWeight:700, color:ACCENT_TEXT, marginBottom:2 }}>{selectedCourse.name}</div>
                  <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:8 }}>
                    {n} / {steps.length}회차 완료
                    {hasTodayBooking && <span style={{ marginLeft:6, color:'#FF8F00', fontWeight:700 }}>· 오늘 수업!</span>}
                  </div>
                  <div style={{ height:6, borderRadius:3, background:'rgba(0,0,0,0.08)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:3, background:ACCENT, width: steps.length > 0 ? `${Math.min(100,(n/steps.length)*100)}%` : '0%', transition:'width 0.5s' }}/>
                  </div>
                </div>

                {steps.length === 0 ? (
                  <div style={{ textAlign:'center', padding:30, color:'var(--tmu)', fontSize:13 }}>회차를 준비 중이에요 🐾</div>
                ) : (
                  <div style={{ position:'relative', paddingLeft:34 }}>
                    <div style={{ position:'absolute', left:10, top:14, bottom:14, width:2, background:`${ACCENT}1A` }}/>

                    {steps.map((step, idx) => {
                      const i = idx + 1
                      const status = getStepStatus(i)
                      const isDone = status === 'done'
                      const isToday = status === 'today'
                      const isNext = status === 'next'
                      const isUpcoming = status === 'upcoming'
                      const rec = recordMap[step.id] || null

                      return (
                        <div key={step.id} style={{ marginBottom:10, display:'flex', alignItems:'flex-start' }}>
                          {/* dot */}
                          <div style={{
                            position:'absolute', left:0, width:22, height:22, borderRadius:11,
                            background: isDone ? ACCENT : isToday ? '#FF8F00' : '#fff',
                            border:`2px solid ${isDone ? ACCENT : isToday ? '#FF8F00' : isNext ? ACCENT : BORDER}`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:10, fontWeight:800, zIndex:1,
                            color: isDone || isToday ? '#fff' : isNext ? ACCENT : 'var(--tmu)'
                          }}>
                            {isDone ? '✓' : isToday ? '★' : i}
                          </div>

                          {/* card */}
                          <div style={{
                            flex:1, borderRadius:12, padding:'10px 12px',
                            background: isToday ? '#FFF8E1' : isNext ? ACCENT_BG : isDone ? CARD : 'var(--g1)',
                            border:`1.5px solid ${isToday ? '#FFB300' : isNext ? ACCENT : isDone ? BORDER : 'transparent'}`,
                            opacity: isUpcoming ? 0.55 : 1
                          }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div>
                                <span style={{ fontSize:10, color:'var(--tmu)', marginRight:4 }}>{i}회차</span>
                                <span style={{ fontSize:13, fontWeight:700, color: isToday ? '#E65100' : isNext ? ACCENT_TEXT : isDone ? 'var(--td)' : 'var(--tmu)' }}>
                                  {step.title}
                                </span>
                              </div>
                              {isToday && <span style={{ fontSize:10, background:'#FF8F00', color:'#fff', borderRadius:20, padding:'2px 8px', fontWeight:700, flexShrink:0 }}>오늘</span>}
                              {isNext  && <span style={{ fontSize:10, background:ACCENT, color:'#fff', borderRadius:20, padding:'2px 8px', fontWeight:700, flexShrink:0 }}>다음</span>}
                            </div>

                            {step.keyword && (
                              <div style={{ fontSize:11, color:'var(--tmu)', marginTop:3 }}>
                                {step.keyword.split(',').map(k=>k.trim()).filter(Boolean).map(k=>`#${k}`).join(' ')}
                              </div>
                            )}

                            {(isDone || isToday) && (
                              <div style={{ marginTop:7 }}>
                                {rec ? (
                                  <button onClick={() => openRecordSheet(step, i, status, 'view')}
                                    style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background:ACCENT_BG, color:ACCENT_TEXT, border:`1px solid ${ACCENT}44`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                                    내 기록 보기
                                  </button>
                                ) : (
                                  <button onClick={() => openRecordSheet(step, i, status, 'create')}
                                    style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background: isToday ? '#FF8F00' : 'var(--g1)', color: isToday ? '#fff' : 'var(--tmu)', border: isToday ? 'none' : `1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                                    기록 남기기
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div style={{ height:80 }}/>
      </div>

      <StudentNav active="curriculum"/>

      {recordSheet && user && (
        <RecordSheet
          params={recordSheet}
          userId={user.id}
          onClose={() => setRecordSheet(null)}
          onSaved={() => { setRecordSheet(null); loadCourseData(user.id, selectedCourse.id) }}
        />
      )}
    </>
  )
}

export default function CurriculumPage() {
  return (
    <Suspense fallback={null}>
      <CurriculumInner />
    </Suspense>
  )
}
