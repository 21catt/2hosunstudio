'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import LoadingCat from '../../../components/LoadingCat'

const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'
const CARD = 'var(--card)'
const BORDER = 'var(--line)'

const CAT_LABEL = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', free:'자율창작', meeting:'모임' }
const CAT_ORDER = ['drawing', 'painting', 'sculpture', 'free', 'meeting']

// ─────────────────────────────────────────────
// Record bottom sheet
// ─────────────────────────────────────────────
function RecordSheet({ params, userId, onClose, onSaved }) {
  const { curriculumId, courseName, classDate, classTitle, mode: initMode } = params
  const [mode, setMode] = useState(initMode)
  const [record, setRecord] = useState(null)
  const [photos, setPhotos] = useState([])
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
      setMemo(rec.note || '')

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
        const { data: guard } = await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', userId)
          .eq('class_name', courseName)
          .limit(1)
        if (!guard?.length) {
          setErr('이 수업의 예약 내역이 없어요. 먼저 수업을 예약해 주세요.')
          setSaving(false)
          return
        }

        const { data: courses } = await supabase
          .from('class_courses')
          .select('id, teacher_id')
          .eq('name', courseName)
          .limit(1)
        const course = courses?.[0]

        const { data: newRec, error: insErr } = await supabase
          .from('class_records')
          .insert({
            user_id: userId,
            curriculum_id: curriculumId,
            course_id: course?.id || null,
            class_date: classDate,
            class_name: classTitle,
            teacher_id: course?.teacher_id || null,
            note: memo.trim() || null,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        recId = newRec.id
        setRecord(newRec)
      } else {
        const { error: updErr } = await supabase
          .from('class_records')
          .update({ note: memo.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', recId)
        if (updErr) throw updErr
      }

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
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.45)', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', maxHeight:'88vh', overflowY:'auto' }}>

        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'#ddd' }}/>
        </div>

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

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>사진</div>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
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
                {previewUrls.map((url, i) => (
                  <div key={`pr${i}`} style={{ position:'relative', width:82, height:82, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
                    <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.72 }}/>
                    <button onClick={() => removePending(i)}
                      style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:9, background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
                      ×
                    </button>
                  </div>
                ))}
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

            {!isEdit && feedback.length > 0 && (
              <div style={{ marginBottom:16, background:ACCENT_BG, borderRadius:12, padding:'12px 14px', border:`1.5px solid rgb(var(--ac-rgb) / 0.2)` }}>
                <div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginBottom:8 }}>강사 피드백</div>
                {feedback.map(fb => (
                  <div key={fb.id} style={{ fontSize:13, color:'var(--td)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                    {fb.body}
                  </div>
                ))}
              </div>
            )}

            {err && (
              <div style={{ fontSize:12, color:'#c0392b', background:'#fdf3f3', borderRadius:8, padding:'8px 12px', marginBottom:14, lineHeight:1.5 }}>
                {err}
              </div>
            )}

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
  const [tab, setTab] = useState('my')

  // 내 경로
  const [courseNames, setCourseNames] = useState([])
  const [selectedName, setSelectedName] = useState(null)
  const [steps, setSteps] = useState([])
  const [n, setN] = useState(0)
  const [hasTodayBooking, setHasTodayBooking] = useState(false)
  const [bookingDates, setBookingDates] = useState([])
  const [recordMap, setRecordMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [recordSheet, setRecordSheet] = useState(null)

  // 둘러보기
  const [browseGroups, setBrowseGroups] = useState([])
  const [browseLoaded, setBrowseLoaded] = useState(false)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [expandedCourse, setExpandedCourse] = useState(null)
  const [expandedCore, setExpandedCore] = useState(null) // 핵심 내용 탭 아코디언 (한 번에 하나)

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  useEffect(() => {
    const qCourse = searchParams.get('course')
    const qTab = searchParams.get('tab')
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null)
      // 홈에서 '커리큘럼 보러가기' → ?tab=core 로 들어오면 핵심 내용 탭
      if (qTab === 'core') {
        setTab('core')
        loadBrowse(new Set())
        setLoading(false)
      } else if (qCourse) {
        // ?course 로 들어오면(캘린더에서 '커리큘럼 보기') 둘러보기로 열고 해당 수업 펼침
        setTab('browse')
        loadBrowse(new Set())
        setLoading(false)
      } else if (data.user) {
        loadInitial(data.user.id)
      } else {
        // 비회원: 핵심 내용(공개 커리큘럼 요약)부터 보여줌
        setTab('core')
        loadBrowse(new Set())
        setLoading(false)
      }
    })
  }, [])

  async function loadInitial(userId) {
    const { data: currRows } = await supabase
      .from('course_curriculum')
      .select('course_name')
    const currNameSet = new Set((currRows || []).map(r => r.course_name).filter(Boolean))
    if (currNameSet.size === 0) { setLoading(false); return }

    const { data: bks } = await supabase
      .from('bookings')
      .select('class_name, class_date')
      .eq('user_id', userId)
      .order('class_date', { ascending: false })

    const seen = new Set()
    const enrolledNames = []
    for (const b of (bks || [])) {
      if (b.class_name && currNameSet.has(b.class_name) && !seen.has(b.class_name)) {
        seen.add(b.class_name)
        enrolledNames.push(b.class_name)
      }
    }

    if (enrolledNames.length === 0) { setLoading(false); return }
    setCourseNames(enrolledNames)

    const qName = searchParams.get('course')
    const defaultName = enrolledNames.includes(qName) ? qName : enrolledNames[0]
    setSelectedName(defaultName)
    await loadCourseData(userId, defaultName)
    setLoading(false)
  }

  async function loadCourseData(userId, courseName) {
    const [{ data: stepsData }, { data: bks }] = await Promise.all([
      supabase.from('course_curriculum')
        .select('*')
        .eq('course_name', courseName)
        .order('step_order'),
      supabase.from('bookings')
        .select('class_date, attended')
        .eq('user_id', userId)
        .eq('class_name', courseName)
        .eq('status', 'booked')
        .lte('class_date', todayStr),
    ])

    setSteps(stepsData || [])

    const allBks = bks || []
    const doneDates = allBks
      .filter(b => b.attended === true)
      .map(b => b.class_date)
      .sort()
    setBookingDates(doneDates)
    setN(doneDates.length)
    setHasTodayBooking(allBks.some(b => b.class_date === todayStr))

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

  async function handleSelectName(name) {
    if (!user || selectedName === name) return
    setSelectedName(name)
    setSteps([])
    setN(0)
    setHasTodayBooking(false)
    setBookingDates([])
    setRecordMap({})
    await loadCourseData(user.id, name)
  }

  function openRecordSheet(step, i, status, mode) {
    const classDate = status === 'today' ? todayStr : (bookingDates[i - 1] || todayStr)
    setRecordSheet({
      curriculumId: step.id,
      courseName: selectedName,
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

  async function loadBrowse(enrolledSet) {
    if (browseLoaded || browseLoading) return
    setBrowseLoading(true)

    const [{ data: currRows }, { data: courseRows }] = await Promise.all([
      supabase.from('course_curriculum').select('*').order('course_name').order('step_order'),
      // select('*') — core_content 컬럼이 아직 없어도 에러 없이 동작
      supabase.from('class_courses').select('*').eq('is_active', true),
    ])

    const stepsByName = {}
    for (const row of (currRows || [])) {
      if (!row.course_name) continue
      if (!stepsByName[row.course_name]) stepsByName[row.course_name] = []
      stepsByName[row.course_name].push(row)
    }
    for (const name in stepsByName) {
      stepsByName[name].sort((a, b) => a.step_order - b.step_order)
    }

    const courseByName = {}
    for (const c of (courseRows || [])) {
      if (c.name) courseByName[c.name] = c
    }

    const groupMap = {}
    for (const [name, courseSteps] of Object.entries(stepsByName)) {
      const info = courseByName[name]
      const cat = info?.category || 'other'
      if (!groupMap[cat]) groupMap[cat] = []
      groupMap[cat].push({ name, steps: courseSteps, teacher: info?.teacher || null, coreContent: info?.core_content || null, coreImages: Array.isArray(info?.core_images) ? info.core_images : [], isEnrolled: enrolledSet.has(name) })
    }
    for (const cat in groupMap) {
      groupMap[cat].sort((a, b) => a.name.localeCompare(b.name))
    }

    const groups = []
    for (const cat of CAT_ORDER) {
      if (groupMap[cat]) groups.push({ category: cat, label: CAT_LABEL[cat] || cat, courses: groupMap[cat] })
    }
    for (const [cat, courses] of Object.entries(groupMap)) {
      if (!CAT_ORDER.includes(cat)) groups.push({ category: cat, label: cat, courses })
    }

    setBrowseGroups(groups)
    // ?course 로 들어온 경우 해당 수업 자동 펼침
    const qName = searchParams.get('course')
    if (qName) {
      const g = groups.find(gr => gr.courses.some(c => c.name === qName))
      if (g) setExpandedCourse(`${g.category}__${qName}`)
    }
    setBrowseLoaded(true)
    setBrowseLoading(false)
  }

  function handleTabSwitch(newTab) {
    setTab(newTab)
    if ((newTab === 'browse' || newTab === 'core') && !browseLoaded && !browseLoading) {
      loadBrowse(new Set(courseNames))
    }
  }

  if (loading) return <LoadingCat />

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>📚</span>
          <span className="p-title">학습 경로</span>
        </div>
      </div>

      <div style={{ background:'#fff', padding:'8px 14px 0', minHeight:'80vh' }}>

        {/* Segment toggle */}
        <div style={{ display:'flex', gap:4, marginBottom:18, background:'var(--g1)', borderRadius:12, padding:3 }}>
          <button onClick={() => setTab('my')}
            style={{ flex:1, padding:'8px 4px', borderRadius:10, background: tab==='my' ? '#fff' : 'transparent', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', color: tab==='my' ? 'var(--td)' : 'var(--tmu)', fontFamily:'Nunito,sans-serif', boxShadow: tab==='my' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            내 경로
          </button>
          <button onClick={() => handleTabSwitch('core')}
            style={{ flex:1, padding:'8px 4px', borderRadius:10, background: tab==='core' ? '#fff' : 'transparent', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', color: tab==='core' ? 'var(--td)' : 'var(--tmu)', fontFamily:'Nunito,sans-serif', boxShadow: tab==='core' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            핵심 내용
          </button>
          <button onClick={() => handleTabSwitch('browse')}
            style={{ flex:1, padding:'8px 4px', borderRadius:10, background: tab==='browse' ? '#fff' : 'transparent', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', color: tab==='browse' ? 'var(--td)' : 'var(--tmu)', fontFamily:'Nunito,sans-serif', boxShadow: tab==='browse' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            둘러보기
          </button>
        </div>

        {/* 내 경로 */}
        {tab === 'my' && (
          <>
            {courseNames.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13, lineHeight:1.8 }}>
                {user ? (
                  <>커리큘럼이 등록된 수업이 없어요 🐾<br/>
                  <span style={{ fontSize:11 }}>강사님이 학습 경로를 등록하면 여기서 볼 수 있어요</span></>
                ) : (
                  <>로그인하면 내 학습 경로를 볼 수 있어요 🐾<br/>
                  <span onClick={()=>router.push('/login')} style={{ fontSize:11, color:ACCENT, fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>로그인 / 가입하기</span>
                  <br/><span style={{ fontSize:11 }}>‘둘러보기’에서 전체 커리큘럼을 볼 수 있어요</span></>
                )}
              </div>
            ) : (
              <>
                {courseNames.length > 1 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
                    {courseNames.map(name => (
                      <button key={name} onClick={() => handleSelectName(name)}
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

                {selectedName && (
                  <>
                    <div style={{ background:ACCENT_BG, borderRadius:14, padding:'14px', marginBottom:18, border:`1.5px solid rgb(var(--ac-rgb) / 0.2)` }}>
                      <div style={{ fontSize:13, fontWeight:700, color:ACCENT_TEXT, marginBottom:2 }}>{selectedName}</div>
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
                        <div style={{ position:'absolute', left:10, top:14, bottom:14, width:2, background:`rgb(var(--ac-rgb) / 0.1)` }}/>

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
                                        style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background:ACCENT_BG, color:ACCENT_TEXT, border:`1px solid rgb(var(--ac-rgb) / 0.27)`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
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
          </>
        )}

        {/* 핵심 내용 — 개설 수업별 핵심 요약 */}
        {tab === 'core' && (
          <>
            {browseLoading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
                <span style={{ fontSize:30 }}>🐱</span>
              </div>
            ) : browseGroups.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13, lineHeight:1.8 }}>
                등록된 수업이 없어요 🐾
              </div>
            ) : (
              browseGroups.map(group => (
                <div key={group.category} style={{ marginBottom:22 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <span style={{ width:3, height:12, borderRadius:2, background:ACCENT, display:'inline-block' }}/>
                    <span style={{ fontSize:11, fontWeight:800, color:'var(--td)', letterSpacing:0.4 }}>{group.label}</span>
                    <span style={{ fontSize:10, color:'var(--tmu)' }}>{group.courses.length}개 수업</span>
                  </div>
                  {group.courses.map(course => {
                    const key = `${group.category}__${course.name}`
                    const isOpen = expandedCore === key
                    return (
                      <div key={course.name} style={{ borderRadius:14, marginBottom:8, border:`1.5px solid ${isOpen ? ACCENT : BORDER}`, background: isOpen ? '#fff' : CARD, overflow:'hidden', transition:'border-color 0.15s' }}>
                        {/* 헤더 — 클릭해서 펼치고 접기 */}
                        <div onClick={() => setExpandedCore(isOpen ? null : key)}
                          style={{ padding:'13px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', gap:8 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                              <span style={{ fontSize:13.5, fontWeight:800, color: isOpen ? ACCENT_TEXT : 'var(--td)' }}>{course.name}</span>
                              {course.isEnrolled && (
                                <span style={{ fontSize:10, background:ACCENT, color:'#fff', borderRadius:20, padding:'2px 7px', fontWeight:700, flexShrink:0 }}>수강 중</span>
                              )}
                            </div>
                            <div style={{ fontSize:11, color:'var(--tmu)', marginTop:3 }}>
                              총 {course.steps.length}회차{course.teacher ? ` · 강사 ${course.teacher}` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize:16, color: isOpen ? ACCENT : 'var(--tmu)', display:'inline-block', transition:'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink:0 }}>›</span>
                        </div>

                        {/* 펼친 내용 — 핵심 요약 + 꽉찬 폭 이미지 세로 나열 */}
                        {isOpen && (
                          <div style={{ borderTop:`1px solid rgb(var(--ac-rgb) / 0.16)`, padding:'14px 14px 16px' }}>
                            <div style={{ fontSize:10, fontWeight:800, color:ACCENT, letterSpacing:0.5, marginBottom:6 }}>핵심 내용</div>
                            <div style={{ fontSize:13, lineHeight:1.75, whiteSpace:'pre-wrap', color: course.coreContent ? 'var(--td)' : 'var(--tmu)' }}>
                              {course.coreContent || '핵심 내용을 준비 중이에요 🐾'}
                            </div>
                            {course.coreImages.length > 0 && (
                              <div style={{ marginTop:12 }}>
                                {course.coreImages.map((url, i) => (
                                  <img key={url + i} src={url} alt="" loading="lazy"
                                    style={{ width:'100%', borderRadius:12, border:`1px solid ${BORDER}`, display:'block', marginBottom:8, boxSizing:'border-box' }}/>
                                ))}
                              </div>
                            )}
                            <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
                              <button
                                onClick={() => router.push(`/student?course=${encodeURIComponent(course.name)}`)}
                                style={{ fontSize:11, padding:'7px 15px', borderRadius:20, background:ACCENT, color:'#fff', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                                이 수업 예약하기 →
                              </button>
                              <button
                                onClick={() => { setExpandedCourse(key); handleTabSwitch('browse') }}
                                style={{ fontSize:11, padding:'7px 13px', borderRadius:20, background:ACCENT_BG, color:ACCENT_TEXT, border:`1px solid rgb(var(--ac-rgb) / 0.27)`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:600 }}>
                                회차 보기
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </>
        )}

        {/* 둘러보기 */}
        {tab === 'browse' && (
          <>
            {browseLoading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
                <span style={{ fontSize:30 }}>🐱</span>
              </div>
            ) : browseGroups.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13, lineHeight:1.8 }}>
                등록된 커리큘럼이 없어요 🐾
              </div>
            ) : (
              browseGroups.map(group => (
                <div key={group.category} style={{ marginBottom:24 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8, letterSpacing:0.3 }}>
                    {group.label}
                  </div>
                  {group.courses.map(course => {
                    const key = `${group.category}__${course.name}`
                    const isOpen = expandedCourse === key
                    return (
                      <div key={course.name} style={{ borderRadius:14, marginBottom:8, border:`1.5px solid ${isOpen ? ACCENT : BORDER}`, background: isOpen ? ACCENT_BG : CARD, overflow:'hidden' }}>
                        <div onClick={() => setExpandedCourse(isOpen ? null : key)}
                          style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                              <span style={{ fontSize:13, fontWeight:700, color: isOpen ? ACCENT_TEXT : 'var(--td)' }}>{course.name}</span>
                              {course.isEnrolled && (
                                <span style={{ fontSize:10, background:ACCENT, color:'#fff', borderRadius:20, padding:'2px 7px', fontWeight:700, flexShrink:0 }}>수강 중</span>
                              )}
                            </div>
                            <div style={{ fontSize:11, color:'var(--tmu)', marginTop:2 }}>
                              총 {course.steps.length}회차{course.teacher ? ` · ${course.teacher}` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize:16, color: isOpen ? ACCENT : 'var(--tmu)', display:'inline-block', transition:'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', marginLeft:8, flexShrink:0 }}>›</span>
                        </div>

                        {isOpen && (
                          <div style={{ borderTop:`1px solid rgb(var(--ac-rgb) / 0.16)`, padding:'12px 14px 14px' }}>
                            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                              <button
                                onClick={() => router.push(`/student?course=${encodeURIComponent(course.name)}`)}
                                style={{ fontSize:11, padding:'6px 14px', borderRadius:20, background:ACCENT, color:'#fff', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700 }}>
                                이 수업 예약하기 →
                              </button>
                              {course.isEnrolled && (
                                <button
                                  onClick={() => {
                                    setTab('my')
                                    if (courseNames.includes(course.name)) handleSelectName(course.name)
                                  }}
                                  style={{ fontSize:11, padding:'6px 12px', borderRadius:20, background:ACCENT_BG, color:ACCENT_TEXT, border:`1px solid rgb(var(--ac-rgb) / 0.27)`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:600 }}>
                                  내 경로 보기
                                </button>
                              )}
                            </div>
                            <div style={{ position:'relative', paddingLeft:28 }}>
                              <div style={{ position:'absolute', left:7, top:10, bottom:10, width:2, background:`rgb(var(--ac-rgb) / 0.09)` }}/>
                              {course.steps.map((step, idx) => (
                                <div key={step.id} style={{ marginBottom:9, position:'relative', display:'flex', alignItems:'flex-start' }}>
                                  <div style={{ position:'absolute', left:-28, width:16, height:16, borderRadius:8, background:'var(--g1)', border:`1.5px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--tmu)', fontWeight:700, flexShrink:0, zIndex:1 }}>
                                    {idx + 1}
                                  </div>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:12, fontWeight:600, color:'var(--td)' }}>{step.title}</div>
                                    {step.keyword && (
                                      <div style={{ fontSize:10, color:'var(--tmu)', marginTop:2 }}>
                                        {step.keyword.split(',').map(k=>k.trim()).filter(Boolean).map(k=>`#${k}`).join(' ')}
                                      </div>
                                    )}
                                    {step.image_url && (
                                      <img src={step.image_url} alt="" style={{ marginTop:6, width:'100%', maxWidth:240, borderRadius:8, display:'block' }}/>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
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
          onSaved={() => { setRecordSheet(null); loadCourseData(user.id, selectedName) }}
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
