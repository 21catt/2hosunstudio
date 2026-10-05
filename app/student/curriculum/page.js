'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import LoadingCat from '../../../components/LoadingCat'
import SpaceBg from '../../../components/SpaceBg'
import { useSpaceTheme } from '../../../lib/useFreshTheme'
import CoreDocView from '../../../components/CoreDocView'
import { compressImage } from '../../../lib/imageCompress'
import { hasRichDoc, DEFAULT_CORE_DOC } from '../../../lib/coreDoc'

const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'
const CARD = 'var(--card)'
const BORDER = 'var(--line)'

const CAT_LABEL = { drawing:'드로잉', painting:'페인팅', sculpture:'조소', oneday:'원데이', free:'자율창작', meeting:'모임' }
const CAT_ORDER = ['drawing', 'painting', 'sculpture', 'oneday', 'free', 'meeting']

// 해당 수업만의 주간 시간표 — 수업이 있는 요일만 행으로(요일 배지 + 시작~종료 시간 칩)
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']
function CourseWeeklyTimetable({ schedules, onPickTime }) {
  if (!schedules || schedules.length === 0) return null
  const byDow = {}
  const seen = new Set()
  for (const s of schedules) {
    const dw = s.day_of_week ?? 0
    const k = `${dw}|${s.start_time}|${s.end_time}`
    if (seen.has(k)) continue
    seen.add(k)
    ;(byDow[dw] = byDow[dw] || []).push(s)
  }
  Object.values(byDow).forEach(a => a.sort((x, y) => (x.start_time || '').localeCompare(y.start_time || '')))
  const order = [1, 2, 3, 4, 5, 6, 0].filter(d => byDow[d]?.length) // 월~일 순, 수업 있는 요일만
  if (order.length === 0) return null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
        <NavIcon name="calendar" color={ACCENT} size={13} />
        <span style={{ fontSize: 11.5, fontWeight: 800, color: ACCENT_TEXT }}>주간 시간표</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tmu)' }}>주 {order.length}일 · 시간을 누르면 가장 가까운 날 예약으로 →</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {order.map(dw => (
          <div key={dw} style={{ display: 'flex', alignItems: 'center', gap: 10, background: ACCENT_BG, border: '1.5px solid rgb(var(--ac-rgb) / 0.25)', borderRadius: 13, padding: '8px 11px' }}>
            <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{DOW_KO[dw]}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {byDow[dw].map((s, k) => (
                <button key={k} onClick={() => onPickTime && onPickTime(dw, s.start_time)} title="이 시간으로 예약하러 가기"
                  style={{ fontSize: 11, fontWeight: 700, color: ACCENT_TEXT, background: 'var(--surf)', border: '1px solid rgb(var(--ac-rgb) / 0.28)', borderRadius: 8, padding: '4px 10px', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', fontFamily: 'Nunito,sans-serif' }}>
                  {(s.start_time || '').slice(0, 5)}~{(s.end_time || '').slice(0, 5)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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
      for (const orig of pendingFiles) {
        try {
          const file = await compressImage(orig) // 업로드 전 최적화(원본 대용량 그대로 X)
          const raw = (file.name.split('.').pop() || '').toLowerCase()
          const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : 'jpg'
          const path = `${userId}/${recId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await supabase.storage.from('class-records').upload(path, file)
          if (upErr) { failed.push(orig.name); continue }
          await supabase.from('class_record_photos').insert({ record_id: recId, storage_path: path })
        } catch {
          failed.push(orig.name)
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
      <div style={{ background:'var(--surf)', borderRadius:'20px 20px 0 0', maxHeight:'88vh', overflowY:'auto' }}>

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
  const coreCardRefs = useRef({})   // 핵심내용 탭 수업 카드
  const browseCardRefs = useRef({}) // 커리큘럼 탭 수업 카드

  // 아코디언을 새로 펼치면 그 카드 머리로 스크롤 — 위 카드가 접히며 스크롤이 새 카드 하단에 떨어지는 문제 방지
  useEffect(() => {
    if (!expandedCore) return
    const el = coreCardRefs.current[expandedCore]
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 10), behavior: 'auto' })
  }, [expandedCore])
  useEffect(() => {
    if (!expandedCourse || tab !== 'browse') return
    const el = browseCardRefs.current[expandedCourse]
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 10), behavior: 'auto' })
  }, [expandedCourse, tab])

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
    // 커리큘럼 목록 + 내 예약을 병렬 로드 — 서로 독립(빈 커리큘럼이면 예약 결과는 버림)
    const [{ data: currRows }, { data: bks }] = await Promise.all([
      supabase.from('course_curriculum').select('course_name'),
      supabase.from('bookings').select('class_name, class_date').eq('user_id', userId).order('class_date', { ascending: false }),
    ])
    const currNameSet = new Set((currRows || []).map(r => r.course_name).filter(Boolean))
    if (currNameSet.size === 0) { setLoading(false); return }

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
      supabase.from('class_courses').select('*, class_schedules(*)').eq('is_active', true),
    ])

    // 이름은 trim 기준으로 매칭 — 끝 공백이 붙은 옛 이름("색채 기초 ")의 회차도 현재 수업과 이어진다
    const stepsByName = {}
    for (const row of (currRows || [])) {
      const nm = (row.course_name || '').trim()
      if (!nm) continue
      if (!stepsByName[nm]) stepsByName[nm] = []
      stepsByName[nm].push(row)
    }
    for (const name in stepsByName) {
      stepsByName[name].sort((a, b) => a.step_order - b.step_order)
    }

    const courseByName = {}
    for (const c of (courseRows || [])) {
      const nm = (c.name || '').trim()
      if (nm) courseByName[nm] = c
    }

    // 활성 수업 기준으로 순회 — 삭제·비활성 수업의 잔여 회차는 자동 배제(유령 방지),
    // 회차가 없어도 핵심내용이 있으면 목록에 표시(핵심내용만 먼저 등록한 새 수업 대응)
    const groupMap = {}
    for (const [name, info] of Object.entries(courseByName)) {
      const courseSteps = stepsByName[name] || []
      const coreImages = Array.isArray(info?.core_images) ? info.core_images : []
      const hasCore = hasRichDoc(info?.core_doc) || !!info?.core_content || coreImages.length > 0
      if (courseSteps.length === 0 && !hasCore) continue // 회차도 핵심내용도 없는 수업(회의 등)은 표시 안 함
      const cat = info.category || 'other'
      if (!groupMap[cat]) groupMap[cat] = []
      groupMap[cat].push({ name, steps: courseSteps, teacher: info?.teacher || null, coreContent: info?.core_content || null, coreImages, coreDoc: info?.core_doc || null, schedules: info?.class_schedules || [], isEnrolled: enrolledSet.has(name) })
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

  const space = useSpaceTheme()

  if (loading) return <LoadingCat />

  return (
    <>
      {space && <SpaceBg />}

      {/* 헤더 — 키커 라벨 + 제목 + 밑줄 탭.
          ⚠️ 색은 전부 테마 변수만 쓴다. 예전 '오늘' 표시에 박혀 있던 #FF8F00·#FFF8E1·#FFB300 같은
             하드코딩 주황은 8색 테마 중 어느 것과도 안 맞아 혼자 튀었다(2026-10-05 제거). */}
      <div style={{ background:'var(--surf)', padding:'18px 20px 0' }}>
        <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:1.3, textTransform:'uppercase', color:ACCENT, marginBottom:3 }}>Curriculum</div>
        <h1 style={{ margin:0, fontSize:22, lineHeight:1.15, fontWeight:800, color:'var(--td)', letterSpacing:-0.6 }}>학습 경로</h1>
        <div style={{ display:'flex', gap:2, marginTop:14, borderBottom:`1px solid ${BORDER}` }}>
          {[['my','내 경로'], ['core','핵심 내용'], ['browse','둘러보기']].map(([key, label]) => (
            <button key={key} onClick={() => key === 'my' ? setTab('my') : handleTabSwitch(key)}
              style={{ fontFamily:'Nunito,sans-serif', background:'none', border:'none', cursor:'pointer', padding:'9px 12px 10px',
                fontSize:13, fontWeight: tab === key ? 800 : 700, color: tab === key ? 'var(--td)' : 'var(--tmu)',
                position:'relative', letterSpacing:-0.2 }}>
              {label}
              {tab === key && <span style={{ position:'absolute', left:8, right:8, bottom:-1, height:2, background:ACCENT, borderRadius:2 }}/>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background:'var(--page)', padding:'18px 20px 0', minHeight:'80vh' }}>

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
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:18 }}>
                    {courseNames.map(name => (
                      <button key={name} onClick={() => handleSelectName(name)}
                        style={{
                          padding:'6px 13px', borderRadius:8,
                          border:`1px solid ${selectedName === name ? 'var(--td)' : BORDER}`,
                          background: selectedName === name ? 'var(--td)' : 'transparent',
                          color: selectedName === name ? 'var(--surf)' : 'var(--tm)',
                          fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', letterSpacing:-0.2
                        }}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}

                {selectedName && (
                  <>
                    {/* 진행 요약 — 숫자가 주인공 */}
                    <div style={{ display:'flex', alignItems:'flex-end', gap:14, paddingBottom:14, marginBottom:6, borderBottom:`1px solid ${BORDER}` }}>
                      <div style={{ fontSize:34, fontWeight:800, lineHeight:0.95, color:'var(--td)', letterSpacing:-1.5, fontVariantNumeric:'tabular-nums' }}>
                        {n}<span style={{ fontSize:16, fontWeight:700, color:'var(--tl)', letterSpacing:-0.5 }}>/{steps.length}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13.5, fontWeight:800, color:'var(--td)', letterSpacing:-0.3 }}>{selectedName}</div>
                        <div style={{ fontSize:11.5, color:'var(--tmu)', fontWeight:600, marginTop:2 }}>{steps.length}회차 과정</div>
                      </div>
                      <div style={{ fontSize:11, fontWeight:800, color:ACCENT, fontVariantNumeric:'tabular-nums' }}>
                        {steps.length > 0 ? Math.round((n / steps.length) * 100) : 0}%
                      </div>
                    </div>
                    <div style={{ height:3, background:`rgb(var(--ac-rgb) / 0.12)`, borderRadius:2, overflow:'hidden', marginBottom:22 }}>
                      <div style={{ height:'100%', background:ACCENT, width: steps.length > 0 ? `${Math.min(100,(n/steps.length)*100)}%` : '0%', transition:'width 0.5s' }}/>
                    </div>

                    {hasTodayBooking && (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:800, color:ACCENT_TEXT, background:ACCENT_BG, borderRadius:6, padding:'4px 9px', marginBottom:16 }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:ACCENT }}/>
                        오늘 수업이 있어요
                      </div>
                    )}

                    {steps.length === 0 ? (
                      <div style={{ textAlign:'center', padding:30, color:'var(--tmu)', fontSize:13 }}>회차를 준비 중이에요 🐾</div>
                    ) : (
                      <div style={{ position:'relative', paddingLeft:26 }}>
                        <div style={{ position:'absolute', left:4, top:8, bottom:12, width:1, background:BORDER }}/>

                        {steps.map((step, idx) => {
                          const i = idx + 1
                          const status = getStepStatus(i)
                          const isDone = status === 'done'
                          const isToday = status === 'today'
                          const isNext = status === 'next'
                          const isUpcoming = status === 'upcoming'
                          const rec = recordMap[step.id] || null
                          const active = isToday || isNext

                          return (
                            <div key={step.id} style={{ position:'relative', padding:'11px 0 13px',
                              borderBottom: idx < steps.length - 1 ? '1px solid rgba(0,0,0,0.055)' : 'none',
                              opacity: isUpcoming ? 0.45 : 1 }}>
                              {/* 노드 — 완료=채운 점 · 오늘=링+할로 · 예정=빈 점 */}
                              <div style={{
                                position:'absolute', left: isToday ? -27 : -26, top: isToday ? 15 : 16,
                                width: isToday ? 11 : 9, height: isToday ? 11 : 9, borderRadius:'50%', boxSizing:'border-box',
                                background: isDone ? ACCENT : 'var(--surf)',
                                border: `${isToday ? 2.5 : 1.5}px solid ${isDone || isToday ? ACCENT : 'var(--tl)'}`,
                                boxShadow: isToday ? `0 0 0 3px rgb(var(--ac-rgb) / 0.14)` : 'none'
                              }}/>

                              <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                                <span style={{ fontSize:10.5, fontWeight:800, color: isToday ? ACCENT : 'var(--tl)', fontVariantNumeric:'tabular-nums', letterSpacing:0.3, flex:'0 0 auto', minWidth:20 }}>
                                  {String(i).padStart(2, '0')}
                                </span>
                                <span style={{ fontSize:14, fontWeight: isToday ? 800 : isDone ? 600 : 700, color: isDone ? 'var(--tm)' : 'var(--td)', letterSpacing:-0.3, lineHeight:1.3 }}>
                                  {step.title}
                                </span>
                                {isToday && <span style={{ fontSize:10, fontWeight:800, letterSpacing:0.5, color:ACCENT, border:`1px solid rgb(var(--ac-rgb) / 0.35)`, borderRadius:4, padding:'1px 5px', flex:'0 0 auto' }}>오늘</span>}
                                {isNext  && <span style={{ fontSize:10, fontWeight:800, letterSpacing:0.5, color:'var(--tm)', border:`1px solid ${BORDER}`, borderRadius:4, padding:'1px 5px', flex:'0 0 auto' }}>다음</span>}
                              </div>

                              {step.keyword && (
                                <div style={{ display:'flex', gap:5, flexWrap:'wrap', margin:'6px 0 0 28px' }}>
                                  {step.keyword.split(',').map(k=>k.trim()).filter(Boolean).map((k, j) => (
                                    <span key={j} style={{ fontSize:10.5, fontWeight:700, color:'var(--tm)', background:CARD, borderRadius:4, padding:'2px 6px' }}>{k}</span>
                                  ))}
                                </div>
                              )}

                              {(isDone || isToday) && (
                                <div style={{ margin:'9px 0 0 28px' }}>
                                  {rec ? (
                                    <button onClick={() => openRecordSheet(step, i, status, 'view')}
                                      style={{ fontFamily:'Nunito,sans-serif', fontSize:11.5, fontWeight:800, cursor:'pointer', background:'none', border:'none', padding:0, color:'var(--tmu)', borderBottom:`1.5px solid ${BORDER}` }}>
                                      내 기록 보기
                                    </button>
                                  ) : (
                                    <button onClick={() => openRecordSheet(step, i, status, 'create')}
                                      style={{ fontFamily:'Nunito,sans-serif', fontSize:11.5, fontWeight:800, cursor:'pointer', background:'none', border:'none', padding:0,
                                        color: active ? ACCENT : 'var(--tmu)', borderBottom:`1.5px solid ${active ? 'rgb(var(--ac-rgb) / 0.3)' : BORDER}` }}>
                                      기록 남기기 →
                                    </button>
                                  )}
                                </div>
                              )}
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
                  <div style={{ display:'flex', alignItems:'center', gap:9, margin:'4px 0 11px' }}>
                    <span style={{ fontSize:10.5, fontWeight:800, letterSpacing:1.2, textTransform:'uppercase', color:'var(--tm)', whiteSpace:'nowrap' }}>{group.label}</span>
                    <span style={{ flex:1, height:1, background:BORDER }}/>
                    <span style={{ fontSize:10.5, fontWeight:800, color:'var(--tl)', fontVariantNumeric:'tabular-nums' }}>{group.courses.length}</span>
                  </div>
                  {group.courses.map(course => {
                    const key = `${group.category}__${course.name}`
                    const isOpen = expandedCore === key
                    // 저장된 리치 문서 우선 → 없고 텍스트/사진도 없으면 기본 샘플 폼(예시) 노출
                    const savedRich = hasRichDoc(course.coreDoc)
                    const emptyCore = !savedRich && !course.coreContent && course.coreImages.length === 0
                    const richDoc = savedRich ? course.coreDoc : (emptyCore ? DEFAULT_CORE_DOC : null)
                    // ⚠️ 카드의 overflow 는 hidden 이 아니라 clip — hidden 은 이 카드를 스크롤 컨테이너로
                    //    만들어 안쪽 CoreDocView 의 모듈 카테고리 스티키 헤더를 조용히 죽인다(2026-10-05).
                    return (
                      <div key={course.name} ref={el => { if (el) coreCardRefs.current[key] = el }}
                        style={{ borderRadius:12, marginBottom:8, border:`1px solid ${isOpen ? ACCENT : BORDER}`, background:'var(--surf)', overflow:'clip',
                          boxShadow: isOpen ? `0 2px 14px rgb(var(--ac-rgb) / 0.1)` : 'none', transition:'border-color 0.15s' }}>
                        {/* 헤더 — 클릭해서 펼치고 접기 */}
                        <div onClick={() => setExpandedCore(isOpen ? null : key)}
                          style={{ padding:'14px 15px', display:'flex', alignItems:'center', cursor:'pointer', gap:10 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                              <span style={{ fontSize:14.5, fontWeight:800, color: isOpen ? ACCENT_TEXT : 'var(--td)', letterSpacing:-0.35 }}>{course.name}</span>
                              {course.isEnrolled && (
                                <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:0.5, color:'var(--surf)', background:ACCENT, borderRadius:4, padding:'2px 6px', flexShrink:0 }}>수강 중</span>
                              )}
                            </div>
                            <div style={{ fontSize:11.5, color:'var(--tmu)', fontWeight:600, marginTop:3, fontVariantNumeric:'tabular-nums' }}>
                              {course.steps.length}회차{course.teacher ? ` · 강사 ${course.teacher}` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize:18, color: isOpen ? ACCENT : 'var(--tl)', display:'inline-block', transition:'transform 0.18s', transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink:0 }}>›</span>
                        </div>

                        {/* 펼친 내용 — 리치 문서(있으면 실제, 없으면 예시 샘플), 아니면 텍스트+이미지
                            ⚠️ overflow:hidden 을 걸지 말 것 — 모듈 카테고리 스티키 헤더가 죽는다. */}
                        {isOpen && richDoc && (
                          <div style={{ borderTop:`1px solid ${BORDER}`, margin:'0 -15px' }}>
                            <CoreDocView doc={richDoc} sample={!savedRich}
                              onCta={() => { setExpandedCourse(key); handleTabSwitch('browse') }}/>
                            <div style={{ display:'flex', gap:8, padding:'15px 15px 4px', flexWrap:'wrap' }}>
                              <button
                                onClick={() => router.push(`/student/calendar?course=${encodeURIComponent(course.name)}`)}
                                style={{ fontSize:12.5, padding:'9px 16px', borderRadius:9, background:ACCENT, color:'#fff', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:800, letterSpacing:-0.2 }}>
                                이 수업 예약하기
                              </button>
                              <button
                                onClick={() => { setExpandedCourse(key); handleTabSwitch('browse') }}
                                style={{ fontSize:12.5, padding:'9px 15px', borderRadius:9, background:'transparent', color:'var(--tm)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:800, letterSpacing:-0.2 }}>
                                회차 보기
                              </button>
                            </div>
                            <div style={{ padding:'0 15px 15px' }}>
                              <CourseWeeklyTimetable schedules={course.schedules} onPickTime={(dw, start) => router.push(`/student/calendar?course=${encodeURIComponent(course.name)}&dow=${dw}&start=${encodeURIComponent(start)}`)} />
                            </div>
                          </div>
                        )}
                        {isOpen && !richDoc && (
                          <div style={{ borderTop:`1px solid ${BORDER}`, padding:'15px' }}>
                            <div style={{ fontSize:10.5, fontWeight:800, color:'var(--tm)', letterSpacing:1.2, textTransform:'uppercase', marginBottom:7 }}>핵심 내용</div>
                            <div style={{ fontSize:13.5, lineHeight:1.8, whiteSpace:'pre-wrap', color: course.coreContent ? 'var(--td)' : 'var(--tmu)' }}>
                              {course.coreContent || '핵심 내용을 준비 중이에요 🐾'}
                            </div>
                            {course.coreImages.length > 0 && (
                              <div style={{ marginTop:12 }}>
                                {course.coreImages.map((url, i) => (
                                  <img key={url + i} src={url} alt="" loading="lazy"
                                    style={{ width:'100%', borderRadius:10, border:`1px solid ${BORDER}`, display:'block', marginBottom:8, boxSizing:'border-box' }}/>
                                ))}
                              </div>
                            )}
                            <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                              <button
                                onClick={() => router.push(`/student/calendar?course=${encodeURIComponent(course.name)}`)}
                                style={{ fontSize:12.5, padding:'9px 16px', borderRadius:9, background:ACCENT, color:'#fff', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:800, letterSpacing:-0.2 }}>
                                이 수업 예약하기
                              </button>
                              <button
                                onClick={() => { setExpandedCourse(key); handleTabSwitch('browse') }}
                                style={{ fontSize:12.5, padding:'9px 15px', borderRadius:9, background:'transparent', color:'var(--tm)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:800, letterSpacing:-0.2 }}>
                                회차 보기
                              </button>
                            </div>
                            <CourseWeeklyTimetable schedules={course.schedules} onPickTime={(dw, start) => router.push(`/student/calendar?course=${encodeURIComponent(course.name)}&dow=${dw}&start=${encodeURIComponent(start)}`)} />
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
                <div key={group.category} style={{ marginBottom:22 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9, margin:'4px 0 11px' }}>
                    <span style={{ fontSize:10.5, fontWeight:800, letterSpacing:1.2, textTransform:'uppercase', color:'var(--tm)', whiteSpace:'nowrap' }}>{group.label}</span>
                    <span style={{ flex:1, height:1, background:BORDER }}/>
                    <span style={{ fontSize:10.5, fontWeight:800, color:'var(--tl)', fontVariantNumeric:'tabular-nums' }}>{group.courses.length}</span>
                  </div>
                  {group.courses.map(course => {
                    const key = `${group.category}__${course.name}`
                    const isOpen = expandedCourse === key
                    return (
                      <div key={course.name} ref={el => { if (el) browseCardRefs.current[key] = el }}
                        style={{ borderRadius:12, marginBottom:8, border:`1px solid ${isOpen ? ACCENT : BORDER}`, background:'var(--surf)', overflow:'hidden',
                          boxShadow: isOpen ? `0 2px 14px rgb(var(--ac-rgb) / 0.1)` : 'none' }}>
                        <div onClick={() => setExpandedCourse(isOpen ? null : key)}
                          style={{ padding:'14px 15px', display:'flex', alignItems:'center', cursor:'pointer', gap:10 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                              <span style={{ fontSize:14.5, fontWeight:800, color: isOpen ? ACCENT_TEXT : 'var(--td)', letterSpacing:-0.35 }}>{course.name}</span>
                              {course.isEnrolled && (
                                <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:0.5, color:'var(--surf)', background:ACCENT, borderRadius:4, padding:'2px 6px', flexShrink:0 }}>수강 중</span>
                              )}
                            </div>
                            <div style={{ fontSize:11.5, color:'var(--tmu)', fontWeight:600, marginTop:3, fontVariantNumeric:'tabular-nums' }}>
                              {course.steps.length}회차{course.teacher ? ` · 강사 ${course.teacher}` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize:18, color: isOpen ? ACCENT : 'var(--tl)', display:'inline-block', transition:'transform 0.18s', transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink:0 }}>›</span>
                        </div>

                        {isOpen && (
                          <div style={{ borderTop:`1px solid ${BORDER}`, padding:'15px' }}>
                            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                              <button
                                onClick={() => router.push(`/student/calendar?course=${encodeURIComponent(course.name)}`)}
                                style={{ fontSize:12.5, padding:'9px 16px', borderRadius:9, background:ACCENT, color:'#fff', border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:800, letterSpacing:-0.2 }}>
                                이 수업 예약하기
                              </button>
                              {course.isEnrolled && (
                                <button
                                  onClick={() => {
                                    setTab('my')
                                    if (courseNames.includes(course.name)) handleSelectName(course.name)
                                  }}
                                  style={{ fontSize:12.5, padding:'9px 15px', borderRadius:9, background:'transparent', color:'var(--tm)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:800, letterSpacing:-0.2 }}>
                                  내 경로 보기
                                </button>
                              )}
                            </div>
                            <div style={{ position:'relative', paddingLeft:22 }}>
                              <div style={{ position:'absolute', left:3, top:6, bottom:6, width:1, background:BORDER }}/>
                              {course.steps.map((step, idx) => (
                                <div key={step.id} style={{ position:'relative', padding:'7px 0' }}>
                                  <div style={{ position:'absolute', left:-22, top:12, width:7, height:7, borderRadius:'50%', background:'var(--surf)', border:`1.5px solid var(--tl)`, boxSizing:'border-box' }}/>
                                  <div style={{ fontSize:12.5, fontWeight:700, color:'var(--td)', letterSpacing:-0.25 }}>
                                    <span style={{ fontSize:10, fontWeight:800, color:'var(--tl)', marginRight:6, fontVariantNumeric:'tabular-nums' }}>{String(idx + 1).padStart(2, '0')}</span>
                                    {step.title}
                                  </div>
                                  {step.keyword && (
                                    <div style={{ fontSize:10.5, color:'var(--tmu)', fontWeight:600, marginTop:2, marginLeft:22 }}>
                                      {step.keyword.split(',').map(k=>k.trim()).filter(Boolean).map(k=>`#${k}`).join(' ')}
                                    </div>
                                  )}
                                  {step.image_url && (
                                    <img src={step.image_url} alt="" style={{ marginTop:6, marginLeft:22, width:'calc(100% - 22px)', maxWidth:240, borderRadius:8, display:'block' }}/>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                        }
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
