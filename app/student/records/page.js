'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import LoadingCat from '../../../components/LoadingCat'
import GlassBg from '../../../components/GlassBg'
import SpaceBg from '../../../components/SpaceBg'
import { useFreshTheme, useSpaceTheme } from '../../../lib/useFreshTheme'
import PalettePlanner from '../../../components/PalettePlanner'
import { compressImage } from '../../../lib/imageCompress'
import { pixelCatImg, DEFAULT_PROFILE_CAT, isValidPixelCat, getSavedProfileCat } from '../../../lib/pixelCats'

// 날짜 중심 기록 — 월 달력에서 날짜를 고르면 그날의 기록(사진·메모·강사 피드백)이 다이어리처럼 펼쳐진다.
// 하단 입력바로 '선택한 날짜'에 바로 기록. 사진 라이트박스·색 계획·라운지 공유는 그대로.
const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'
const BORDER = 'var(--line)'
const DOW = ['일','월','화','수','목','금','토']

function catFace(catMap, userId, size = 38) {
  const key = isValidPixelCat(catMap[userId]) ? catMap[userId] : DEFAULT_PROFILE_CAT
  return (
    <div style={{ width:size, height:size, flexShrink:0, borderRadius:'50%', background:ACCENT_BG, border:`2.5px solid ${ACCENT}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
      <img src={pixelCatImg(key)} alt="" width={size-10} height={size-10} style={{ imageRendering:'pixelated', display:'block' }}/>
    </div>
  )
}

// 강사 피드백 한 칸 — 달력 보기와 피드백 노트가 같은 코드를 쓴다.
// 두 벌로 두면 한쪽만 고쳐져서 같은 피드백이 화면마다 다르게 보인다.
function FeedbackBox({ fb, catMap, nameMap, signedUrls, onOpenPhotos }) {
  return (
    <div style={{ marginTop:11, background:'var(--acBg)', border:`2px solid ${ACCENT}`, borderRadius:14, padding:'11px 13px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        {catFace(catMap, fb.teacher_id, 24)}
        <span style={{ fontSize:9, fontWeight:900, letterSpacing:0.5, background:ACCENT, color:'#fff', padding:'2px 8px', borderRadius:9 }}>강사 피드백</span>
        <span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)' }}>{nameMap[fb.teacher_id] ? `${nameMap[fb.teacher_id]} 쌤` : '선생님'}</span>
      </div>
      {fb.body && <div style={{ fontSize:13, fontWeight:600, color:'var(--td)', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{fb.body}</div>}
      {Array.isArray(fb.photos) && fb.photos.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop: fb.body ? 8 : 0 }}>
          {fb.photos.map((path, pi) => (
            <div key={pi} onClick={() => onOpenPhotos(fb.photos, path)}
              style={{ width:88, height:88, borderRadius:10, background:'var(--surf)', overflow:'hidden', flexShrink:0, cursor: signedUrls[path] ? 'pointer' : 'default' }}>
              {signedUrls[path]
                ? <img src={signedUrls[path]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📷</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 사진 댓글 스레드(강사 ↔ 나) + 이어서 답글. 위와 같은 이유로 한 벌만 둔다.
function CommentThread({ comments, userId, draft, onDraft, onSend, sending }) {
  return (
    <div style={{ marginTop:11, display:'flex', flexDirection:'column', gap:6 }}>
      {comments.map(c => {
        const mine = c.user_id === userId
        const catKey = isValidPixelCat(c.author_cat) ? c.author_cat : DEFAULT_PROFILE_CAT
        return (
          <div key={c.id} style={{ display:'flex', gap:6, alignItems:'flex-end', flexDirection: mine ? 'row-reverse' : 'row' }}>
            <div style={{ width:26, height:26, flexShrink:0, borderRadius:'50%', background:ACCENT_BG, border:`2px solid ${ACCENT}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
              <img src={pixelCatImg(catKey)} alt="" width={17} height={17} style={{ imageRendering:'pixelated', display:'block' }}/>
            </div>
            <div style={{ maxWidth:'72%', display:'flex', flexDirection:'column', alignItems: mine ? 'flex-end' : 'flex-start', gap:2 }}>
              {!mine && <span style={{ fontSize:9.5, fontWeight:800, color:'var(--tmu)', marginLeft:4 }}>{c.author_name} 쌤</span>}
              <div style={{ background: mine ? ACCENT : 'var(--surf)', color: mine ? '#fff' : 'var(--td)', border: mine ? 'none' : `2px solid rgb(var(--ac-rgb) / 0.3)`, fontSize:12, fontWeight:600, lineHeight:1.5, padding:'7px 11px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {c.content}
              </div>
            </div>
          </div>
        )
      })}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
        <input value={draft} onChange={e => onDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSend() }}
          placeholder="답글 남기기…"
          style={{ flex:1, minWidth:0, height:34, background:'var(--bg)', border:`2px solid rgb(var(--ac-rgb) / 0.25)`, borderRadius:18, padding:'0 12px', fontSize:12, color:'var(--td)', fontWeight:600, fontFamily:'Nunito,sans-serif', outline:'none', boxSizing:'border-box' }}/>
        <button onClick={onSend} disabled={sending || !draft.trim()}
          style={{ width:34, height:34, flexShrink:0, borderRadius:'50%', border:'none', color:'#fff', fontSize:12, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', background: draft.trim() ? ACCENT : 'rgb(var(--ac-rgb) / 0.35)' }}>
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  )
}

function RecordsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [signedUrls, setSignedUrls] = useState({})
  const [catMap, setCatMap] = useState({})       // user_id → profile_cat (개인설정 프로필)
  const [nameMap, setNameMap] = useState({})     // teacher_id → 이름
  // 같은 기록을 세 가지 눈으로 본다 — 날짜(달력) · 그림만(앨범) · 말만(피드백 노트).
  // 화면 상태일 뿐이라 데이터는 하나도 더 불러오지 않는다.
  const [view, setView] = useState('calendar')   // calendar | album | notes

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  // 커리큘럼 '기록 남기기'에서 넘어온 날짜·수업 컨텍스트. ctx.date = 선택(=기록 대상) 날짜
  const qDate = searchParams.get('date')
  const qClass = searchParams.get('class')
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(qDate || '') ? qDate : todayStr
  const [ctx, setCtx] = useState({ date: validDate, cls: qClass || '' })
  // 달력에 표시 중인 연·월(m: 0-based). 진입 날짜의 달로 시작.
  const [calYM, setCalYM] = useState(() => ({ y: +validDate.slice(0, 4), m: +validDate.slice(5, 7) - 1 }))

  // 하단 입력바
  const [composeText, setComposeText] = useState('')
  const [composeFiles, setComposeFiles] = useState([])
  const [composePreviews, setComposePreviews] = useState([])
  const [sending, setSending] = useState(false)
  const [lastAddedId, setLastAddedId] = useState(null)
  const [editingId, setEditingId] = useState(null)   // 내용(메모) 수정 중인 기록 id
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [shareLounge, setShareLounge] = useState(true) // 라운지 '수업' 카테고리로도 공유
  // 사진 확대 라이트박스 + 댓글 (라운지와 동일 UX)
  const [viewer, setViewer] = useState(null)        // { photos:[url], idx, recordId }
  const [viewerText, setViewerText] = useState('')
  const [viewerSending, setViewerSending] = useState(false)
  const [recordComments, setRecordComments] = useState({}) // { recordId: [comment] } — 강사·나 대화 스레드
  const [rcInput, setRcInput] = useState({})   // 기록 아래 인라인 답글 입력
  const [rcSending, setRcSending] = useState({})
  const viewerTouchX = useRef(null)
  // 색 계획 도구(삼색) — 열림 상태 + 재편집용 초기 팔레트
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [plannerInit, setPlannerInit] = useState(null)
  const [savingPlan, setSavingPlan] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadRecords(data.user.id)
    })
  }, [])

  async function loadRecords(userId) {
    const { data } = await supabase
      .from('class_records')
      .select('*, class_record_photos(*), class_record_feedback(*)')
      .eq('user_id', userId)
      .order('class_date', { ascending: true })
    const recs = data || []
    setRecords(recs)

    // 프로필 고양이(강사+나) + 사진 라이트박스 댓글을 한 번에 병렬 로드 — 모두 recs에만 의존
    const tIds = [...new Set(recs.flatMap(r => (r.class_record_feedback || []).map(f => f.teacher_id)).filter(Boolean))]
    const prefIds = [...new Set([userId, ...tIds])]
    const recIds = recs.map(r => r.id)
    const [{ data: prefs }, { data: usrs }, { data: cs }] = await Promise.all([
      supabase.from('user_prefs').select('user_id, profile_cat').in('user_id', prefIds),
      tIds.length ? supabase.from('users').select('id, name').in('id', tIds) : Promise.resolve({ data: [] }),
      // 사진 라이트박스 댓글 (테이블 없으면 조용히 빈 값)
      recIds.length ? supabase.from('record_comments').select('*').in('record_id', recIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
    ])
    const cm = {}; (prefs || []).forEach(p => { cm[p.user_id] = p.profile_cat })
    const nm = {}; (usrs || []).forEach(u => { nm[u.id] = u.name })
    setCatMap(cm); setNameMap(nm)
    const rc = {}; (cs || []).forEach(c => { (rc[c.record_id] = rc[c.record_id] || []).push(c) })
    setRecordComments(rc)

    setLoading(false)
    loadAllPhotos(recs)
  }

  function recordPhotos(r) {
    return (r.class_record_photos || []).map(p => signedUrls[p.storage_path]).filter(Boolean)
  }

  // 라이트박스 스와이프
  function viewerSwipe(e) {
    if (viewerTouchX.current == null || !viewer || viewer.photos.length < 2) return
    const delta = e.changedTouches[0].clientX - viewerTouchX.current
    viewerTouchX.current = null
    if (Math.abs(delta) < 50) return
    setViewer(v => ({ ...v, idx: delta < 0 ? (v.idx+1)%v.photos.length : (v.idx-1+v.photos.length)%v.photos.length }))
  }

  // 기록 댓글 등록 (라이트박스·인라인 공용).
  async function postRecordComment(recordId, text) {
    const t = (text || '').trim()
    if (!t || !user) return false
    const cbase = { record_id: recordId, user_id: user.id, author_name: user.user_metadata?.name || '나', content: t }
    let { data: c, error } = await supabase.from('record_comments').insert({ ...cbase, author_cat: catMap[user.id] || getSavedProfileCat() }).select().single()
    if (error) { // author_cat 컬럼/테이블 문제 시 최소 필드로 재시도
      ;({ data: c, error } = await supabase.from('record_comments').insert(cbase).select().single())
    }
    if (error) { alert('댓글 등록에 실패했어요. record_comments 마이그레이션이 실행됐는지 확인해 주세요 🐾'); return false }
    setRecordComments(prev => ({ ...prev, [recordId]: [...(prev[recordId] || []), c] }))
    return true
  }

  // 사진 보면서 댓글 (라이트박스)
  async function sendRecordComment() {
    if (!viewer?.recordId || viewerSending) return
    setViewerSending(true)
    try { if (await postRecordComment(viewer.recordId, viewerText)) setViewerText('') }
    finally { setViewerSending(false) }
  }

  // 기록 아래 인라인 답글
  async function sendInlineComment(recordId) {
    if (rcSending[recordId]) return
    setRcSending(prev => ({ ...prev, [recordId]: true }))
    try { if (await postRecordComment(recordId, rcInput[recordId])) setRcInput(prev => ({ ...prev, [recordId]: '' })) }
    finally { setRcSending(prev => ({ ...prev, [recordId]: false })) }
  }

  async function loadAllPhotos(recs) {
    const paths = recs.flatMap(r => [
      ...(r.class_record_photos || []).map(p => p.storage_path),
      ...(r.class_record_feedback || []).flatMap(fb => Array.isArray(fb.photos) ? fb.photos : []),
    ]).filter(Boolean)
    if (!paths.length) return
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const pairs = await Promise.all(paths.map(async path => {
      try {
        const res = await fetch(`/api/records/signed-url?path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        return [path, json.url || null]
      } catch { return [path, null] }
    }))
    setSignedUrls(prev => ({ ...prev, ...Object.fromEntries(pairs.filter(([, u]) => u)) }))
  }

  // 📷 아이콘 → 바로 사진 선택 (여러 장, 입력바 위에 미리보기)
  function pickFiles(e) {
    const files = Array.from(e.target.files)
    e.target.value = ''
    if (!files.length) return
    if (composeFiles.length + files.length > 10) { alert('사진은 한 번에 10장까지 보낼 수 있어요'); return }
    setComposeFiles(prev => [...prev, ...files])
    setComposePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  function removePick(i) {
    URL.revokeObjectURL(composePreviews[i])
    setComposeFiles(prev => prev.filter((_, idx) => idx !== i))
    setComposePreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  // 전송 — 선택한 날짜(ctx.date)에 기록 저장, 사진은 로컬 미리보기로 즉시 표시
  async function handleSend() {
    const text = composeText.trim()
    if (!user || sending || (!text && composeFiles.length === 0)) return
    setSending(true)
    try {
      const { data: rec } = await supabase
        .from('class_records')
        .insert({ user_id: user.id, class_date: ctx.date, class_name: ctx.cls || null, note: text || null })
        .select().single()
      if (!rec) throw new Error('insert failed')

      // 업로드 전 사진 최적화(리사이즈·JPEG 재인코딩) — 원본 대용량 그대로 올리지 않음
      const compressed = await Promise.all(composeFiles.map(f => compressImage(f)))

      const photoRows = []
      const urlByPath = {}
      for (let i = 0; i < compressed.length; i++) {
        const file = compressed[i]
        const raw = (file.name.split('.').pop() || '').toLowerCase()
        const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : 'jpg'
        const path = `${user.id}/${rec.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('class-records').upload(path, file)
        if (!upErr) {
          const { data: pr } = await supabase.from('class_record_photos').insert({ record_id: rec.id, storage_path: path }).select().single()
          photoRows.push(pr || { id: `tmp-${i}`, storage_path: path })
          urlByPath[path] = composePreviews[i] // 서명 URL 대신 로컬 미리보기로 즉시 표시
        }
      }

      const newRec = { ...rec, class_record_photos: photoRows, class_record_feedback: [] }
      setRecords(prev => [...prev, newRec].sort((a, b) => a.class_date.localeCompare(b.class_date)))
      setSignedUrls(prev => ({ ...prev, ...urlByPath }))
      setLastAddedId(rec.id)

      // 라운지 '수업' 카테고리로도 공유 (전체 탭에도 자연히 노출)
      // 기록 사진은 비공개 버킷이라, 공유용으로 공개 버킷(lounge-images)에 한 번 더 올린다
      if (shareLounge) {
        try {
          const shareUrls = []
          for (const file of compressed) {
            const ext0 = (file.name.split('.').pop() || '').toLowerCase()
            const ext = /^[a-z0-9]{1,5}$/.test(ext0) ? ext0 : 'jpg'
            const lpath = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
            const { error: lErr } = await supabase.storage.from('lounge-images').upload(lpath, file)
            if (!lErr) {
              const { data } = supabase.storage.from('lounge-images').getPublicUrl(lpath)
              shareUrls.push(data.publicUrl)
            }
          }
          // 작가 기록은 라운지 '전시회의' 카테고리로, 수강생은 '수업'으로 공유
          const isArtist = user.user_metadata?.role === 'artist'
          const pbase = {
            title: isArtist ? (ctx.cls ? `🖼️ ${ctx.cls} 전시 기록` : '🖼️ 오늘의 전시 기록')
                            : (ctx.cls ? `🎨 ${ctx.cls} 수업 기록` : '📋 오늘의 수업 기록'),
            content: text || '',
            tag: isArtist ? 'exhibit' : 'class',
            author_id: user.id,
            author_name: user.user_metadata?.name || '익명',
            image_url: shareUrls[0] || null,
            images: shareUrls,
          }
          // record_id 로 원본 기록을 연결 → 라운지 뷰어에서 강사 피드백을 되짚어 보여줄 수 있게.
          // 컬럼 유무를 모르므로 단계적 폴백: (author_cat+record_id) → (record_id) → (기본).
          let { error: shErr } = await supabase.from('posts').insert({ ...pbase, record_id: rec.id, author_cat: catMap[user.id] || getSavedProfileCat() })
          if (shErr) ({ error: shErr } = await supabase.from('posts').insert({ ...pbase, record_id: rec.id })) // author_cat 컬럼 없음
          if (shErr) await supabase.from('posts').insert(pbase) // record_id 컬럼도 없으면 최종 폴백

        } catch {} // 공유 실패해도 기록 저장은 유지
      }
      setComposeText('')
      setComposeFiles([]); setComposePreviews([]) // objectURL은 표시에 쓰므로 revoke하지 않음
    } finally {
      setSending(false)
    }
  }

  // 색 계획 카드 저장 — 도구가 만든 합성 PNG + palette JSON을 그날 기록 사진으로 저장
  async function handleSavePlan(blob, palette, note) {
    if (!user || savingPlan) return
    setSavingPlan(true)
    try {
      const { data: rec } = await supabase
        .from('class_records')
        .insert({ user_id: user.id, class_date: ctx.date, class_name: ctx.cls || null, note: note || '🎨 색 계획' })
        .select().single()
      if (!rec) throw new Error('insert failed')

      const path = `${user.id}/${rec.id}/${Date.now()}_plan.png`
      const file = new File([blob], 'plan.png', { type: 'image/png' })
      const { error: upErr } = await supabase.storage.from('class-records').upload(path, file)
      if (upErr) throw upErr

      // palette 컬럼(마이그레이션) 미실행 시 조용히 없이 재시도 → 저장은 유지
      let { data: pr } = await supabase.from('class_record_photos').insert({ record_id: rec.id, storage_path: path, palette }).select().single()
      if (!pr) { ({ data: pr } = await supabase.from('class_record_photos').insert({ record_id: rec.id, storage_path: path }).select().single()) }

      const photoRow = { ...(pr || { id: `tmp-${rec.id}` }), storage_path: path, palette }
      const newRec = { ...rec, class_record_photos: [photoRow], class_record_feedback: [] }
      setRecords(prev => [...prev, newRec].sort((a, b) => a.class_date.localeCompare(b.class_date)))
      setSignedUrls(prev => ({ ...prev, [path]: URL.createObjectURL(blob) }))
      setLastAddedId(rec.id)
      setPlannerOpen(false); setPlannerInit(null)
    } catch {
      alert('색 계획 저장에 실패했어요 🐾')
    } finally {
      setSavingPlan(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 기록을 삭제할까요?')) return
    await supabase.from('class_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  // 기록 내용(메모) 수정 저장 — 본인 기록만
  async function handleEditSave(r) {
    if (editSaving) return
    const note = editText.trim()
    setEditSaving(true)
    try {
      await supabase.from('class_records').update({ note: note || null }).eq('id', r.id)
      setRecords(prev => prev.map(x => x.id === r.id ? { ...x, note: note || null } : x))
      setEditingId(null)
    } finally {
      setEditSaving(false)
    }
  }

  const fresh = useFreshTheme()
  const space = useSpaceTheme()

  if (loading) return <LoadingCat />

  // 달력 셀 계산 + 기록 있는 날 표시
  const selDate = ctx.date
  const selD = new Date(selDate + 'T00:00:00')
  const recordDates = new Set(records.map(r => r.class_date))
  const firstDow = new Date(calYM.y, calYM.m, 1).getDay()
  const daysInMonth = new Date(calYM.y, calYM.m + 1, 0).getDate()
  const calCells = []
  for (let i = 0; i < firstDow; i++) calCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d)
  const cellYmd = (d) => `${calYM.y}-${String(calYM.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const shiftMonth = (delta) => setCalYM(({ y, m }) => { const t = m + delta; return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 } })
  const dayRecords = records.filter(r => r.class_date === selDate)
  // 앨범 — 사진만 최근 → 과거로. 달로 끊어 지금 어디쯤을 보고 있는지 알게 한다.
  const albumGroups = []
  {
    const items = records.flatMap(r => (r.class_record_photos || []).map(ph => ({ ph, r })))
    items.sort((a, b) => b.r.class_date.localeCompare(a.r.class_date))
    for (const it of items) {
      const key = it.r.class_date.slice(0, 7)
      const last = albumGroups[albumGroups.length - 1]
      if (last && last.key === key) last.items.push(it)
      else albumGroups.push({ key, items: [it] })
    }
  }
  const albumCount = albumGroups.reduce((a, g) => a + g.items.length, 0)
  const firstRecordDate = records.length ? records[0].class_date : null   // 기록은 날짜 오름차순
  // 피드백 노트 — 강사 말이나 주고받은 대화가 있는 기록만, 최근 것부터.
  const noteRecords = records
    .filter(r => (r.class_record_feedback || []).length > 0 || (recordComments[r.id] || []).length > 0)
    .slice().sort((a, b) => b.class_date.localeCompare(a.class_date))
  const fbCount = noteRecords.reduce((a, r) => a + (r.class_record_feedback || []).length, 0)
  const talkCount = noteRecords.reduce((a, r) => a + (recordComments[r.id] || []).length, 0)
  const openPhotos = (paths, path) => {
    const urls = paths.map(x => signedUrls[x]).filter(Boolean)
    if (!urls.length) return
    return { photos: urls, idx: Math.max(0, urls.indexOf(signedUrls[path])) }
  }
  const monthLabel = (g, i) => {
    const [y, m] = g.key.split('-')
    const prevY = i > 0 ? albumGroups[i - 1].key.slice(0, 4) : null
    return (i === 0 || prevY !== y) ? `${y} · ${+m}월` : `${+m}월`
  }
  const viewTabs = [['calendar', '달력'], ['album', '앨범'], ['notes', '피드백 노트']]

  const arrowBtn = { width:28, height:28, borderRadius:9, border:'1.5px solid var(--g2)', background:'var(--surf)', color:'var(--ac)', fontSize:15, cursor:'pointer', lineHeight:1, padding:0 }

  return (
    <>
      {fresh && <GlassBg />}
      {space && <SpaceBg />}
      <style>{`
        @keyframes thumbIn {
          0%   { opacity:0; transform: scale(0.3, 0.45) rotate(-8deg); }
          42%  { opacity:1; transform: scale(1.15, 0.88) rotate(3deg); }
          62%  { transform: scale(0.93, 1.08) rotate(-1.5deg); }
          78%  { transform: scale(1.045, 0.97) rotate(0.6deg); }
          90%  { transform: scale(0.99, 1.008) rotate(-0.2deg); }
          100% { opacity:1; transform: scale(1, 1) rotate(0); }
        }
        .thumb-in { animation: thumbIn 0.62s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .press { transition: transform 0.12s cubic-bezier(0.34,1.56,0.64,1); }
        .press:active { transform: scale(0.84); }
        @media (prefers-reduced-motion: reduce) { .thumb-in { animation: none } .press:active { transform:none } }
        .viewer-input::placeholder { color: rgba(255,255,255,0.55); }
      `}</style>

      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="clipboard" color="var(--ac)" size={20} />
          <span className="p-title">수업 기록</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--acTx)', background:ACCENT_BG, border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', padding:'4px 10px', borderRadius:20 }}>
            기록 {records.length}개
          </span>
        </div>
      </div>

      <div style={{ background: (fresh || space) ? 'transparent' : '#fff', padding: view === 'calendar' ? '12px 12px 150px' : '12px 12px 90px', minHeight:'80vh' }}>

        {/* 보기 전환 — 날짜로 볼지, 그림만 볼지, 받은 말만 볼지 */}
        <div style={{ display:'flex', gap:5, background:'var(--card)', borderRadius:14, padding:4, marginBottom:14 }}>
          {viewTabs.map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} aria-pressed={view === k}
              style={{ flex:1, border:'none', borderRadius:11, padding:'7px 0', fontFamily:'Nunito,sans-serif', fontSize:12.5, fontWeight:800, cursor:'pointer',
                color: view === k ? '#fff' : 'var(--tm)',
                background: view === k ? ACCENT : 'transparent',
                boxShadow: view === k ? '0 4px 10px -3px rgb(var(--ac-rgb) / 0.6)' : 'none', transition:'background 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {view === 'calendar' && (<>

        {/* 월 달력 — 날짜에 기록. 기록 있는 날 점 표시, 날짜 눌러 그날 다이어리 열기 */}
        <div className="p-card" style={{ padding:'13px 13px 11px', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:14, fontWeight:800, color:'var(--td)' }}>{calYM.y}년 {calYM.m + 1}월</span>
            <div style={{ display:'flex', gap:5 }}>
              <button className="press" onClick={() => shiftMonth(-1)} style={arrowBtn}>‹</button>
              <button className="press" onClick={() => shiftMonth(1)} style={arrowBtn}>›</button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, textAlign:'center', fontSize:9.5, fontWeight:800, color:'var(--tmu)', marginBottom:4 }}>
            {DOW.map(d => <span key={d}>{d}</span>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, textAlign:'center' }}>
            {calCells.map((d, i) => {
              if (d == null) return <span key={`e${i}`} />
              const ds = cellYmd(d)
              const isSel = ds === selDate
              const isToday = ds === todayStr
              const has = recordDates.has(ds)
              return (
                <button key={ds} onClick={() => setCtx({ date: ds, cls: '' })}
                  style={{ position:'relative', padding:'6px 0', border:'none', background: isSel ? ACCENT : 'transparent', borderRadius:9, cursor:'pointer', fontFamily:'Nunito,sans-serif',
                    fontSize:12, fontWeight: (isSel || isToday) ? 800 : 600, color: isSel ? '#fff' : 'var(--td)' }}>
                  {isToday && !isSel && <span style={{ position:'absolute', inset:2, border:`1.5px solid ${ACCENT}`, borderRadius:8, pointerEvents:'none' }} />}
                  <span style={{ position:'relative' }}>{d}</span>
                  {has && !isSel && <span style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:ACCENT }} />}
                </button>
              )
            })}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:9, paddingTop:8, borderTop:'1px solid var(--g1)', fontSize:10, fontWeight:700, color:'var(--tmu)' }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:ACCENT, display:'inline-block' }} /> 기록이 있는 날 · 날짜를 눌러 그날 기록을 봐요
          </div>
        </div>

        {/* 선택한 날짜 헤더 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 2px 10px' }}>
          <span style={{ fontSize:13.5, fontWeight:800, color:'var(--td)' }}>{selD.getMonth() + 1}월 {selD.getDate()}일 ({DOW[selD.getDay()]})</span>
          <span style={{ fontSize:10.5, fontWeight:700, color:'var(--tmu)' }}>{dayRecords.length}개 기록</span>
        </div>

        {/* 선택한 날짜의 다이어리 */}
        {dayRecords.length === 0 ? (
          <div style={{ textAlign:'center', padding:'34px 0', color:'var(--tmu)', fontSize:12.5, border:'1.5px dashed var(--g2)', borderRadius:16, lineHeight:1.9 }}>
            이 날은 기록이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>아래 입력창에 이 날짜 기록을 남겨보세요</span>
          </div>
        ) : dayRecords.map(r => {
          const isNew = r.id === lastAddedId
          return (
            <div key={r.id} className="p-card" style={{ padding:'13px', marginBottom:12 }}>
              {/* 상단: 수업명 배지 + 삭제 */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:(r.note || r.class_record_photos?.length || editingId === r.id) ? 10 : 0 }}>
                {r.class_name
                  ? <span style={{ fontSize:11, fontWeight:800, color:ACCENT_TEXT, background:ACCENT_BG, border:`2px solid rgb(var(--ac-rgb) / 0.35)`, borderRadius:20, padding:'3px 11px' }}>🎨 {r.class_name}</span>
                  : <span style={{ fontSize:11.5, fontWeight:800, color:'var(--tmu)' }}>수업 기록</span>}
                <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                  <button onClick={() => { setEditingId(r.id); setEditText(r.note || '') }} title="기록 수정"
                    style={{ width:24, height:24, borderRadius:'50%', border:'2px solid var(--g2)', background:'var(--surf)', color:'var(--tmu)', fontSize:11, lineHeight:1, cursor:'pointer', padding:0 }}>✏️</button>
                  <button onClick={() => handleDelete(r.id)} title="기록 삭제"
                    style={{ width:24, height:24, borderRadius:'50%', border:'2px solid var(--g2)', background:'var(--surf)', color:'var(--tmu)', fontSize:11, lineHeight:1, cursor:'pointer', padding:0 }}>✕</button>
                </div>
              </div>

              {/* 사진 그리드 */}
              {r.class_record_photos?.length > 0 && (
                <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom: r.note ? 11 : 0 }}>
                  {r.class_record_photos.map((p, i) => {
                    const url = signedUrls[p.storage_path]
                    return (
                      <div key={p.id} className={isNew ? 'thumb-in' : ''}
                        title={p.palette ? '탭하면 이 색으로 컬러휠 열기' : undefined}
                        onClick={() => {
                          if (p.palette) { setPlannerInit(p.palette); setPlannerOpen(true); return }
                          if (!url) return
                          const photos = recordPhotos(r); setViewer({ photos, idx: Math.max(0, photos.indexOf(url)), recordId: r.id }); setViewerText('')
                        }}
                        style={{ position:'relative', width:92, height:92, borderRadius:18, overflow:'hidden', border:`3px solid ${ACCENT}`, boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.22)', background:ACCENT_BG, flexShrink:0, cursor: (url || p.palette) ? 'pointer' : 'default', animationDelay:`${i * 70}ms` }}>
                        {url
                          ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📷</div>
                        }
                        {p.palette && (
                          <>
                            {/* 색 계획 카드 표식 (탭 = 컬러휠 복원) */}
                            <span style={{ position:'absolute', top:4, left:4, height:20, borderRadius:8, background:'rgba(11,11,14,0.72)', color:'#fff', fontSize:10, fontWeight:800, lineHeight:1, padding:'0 6px', display:'flex', alignItems:'center', gap:3, pointerEvents:'none' }}>🎨 색</span>
                            {url && (
                              <button onClick={e => { e.stopPropagation(); const photos = recordPhotos(r); setViewer({ photos, idx: Math.max(0, photos.indexOf(url)), recordId: r.id }); setViewerText('') }}
                                title="사진 크게 보기"
                                style={{ position:'absolute', top:4, right:4, width:24, height:24, borderRadius:8, border:'none', background:'rgba(11,11,14,0.72)', color:'#fff', fontSize:11, lineHeight:1, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}>🔍</button>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 메모 — ✏️ 누르면 인라인 수정 */}
              {editingId === r.id ? (
                <div>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                    placeholder="기록 내용을 적어주세요…"
                    style={{ width:'100%', padding:'9px 11px', borderRadius:12, border:`2px solid rgb(var(--ac-rgb) / 0.35)`, background:ACCENT_BG, fontSize:13, fontWeight:600, color:'var(--td)', lineHeight:1.6, resize:'none', fontFamily:'Nunito,sans-serif', outline:'none', boxSizing:'border-box' }}/>
                  <div style={{ display:'flex', gap:6, marginTop:6 }}>
                    <button onClick={() => setEditingId(null)}
                      style={{ flex:1, padding:'8px', background:'var(--g1)', color:'var(--tm)', border:'none', borderRadius:10, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>취소</button>
                    <button onClick={() => handleEditSave(r)} disabled={editSaving}
                      style={{ flex:2, padding:'8px', background:ACCENT, color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: editSaving ? 0.5 : 1 }}>{editSaving ? '저장 중…' : '저장'}</button>
                  </div>
                </div>
              ) : (
                r.note && <div style={{ fontSize:13, fontWeight:600, color:'var(--td)', lineHeight:1.65, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{r.note}</div>
              )}

              {/* 강사 피드백 */}
              {(r.class_record_feedback || []).map(fb => (
                <FeedbackBox key={fb.id} fb={fb} catMap={catMap} nameMap={nameMap} signedUrls={signedUrls}
                  onOpenPhotos={(paths, path) => {
                    const urls = paths.map(x => signedUrls[x]).filter(Boolean)
                    if (!urls.length) return
                    setViewer({ photos: urls, idx: Math.max(0, urls.indexOf(signedUrls[path])), recordId: r.id }); setViewerText('')
                  }}/>
              ))}

              {/* 사진 댓글 스레드 (강사 ↔ 나) — 대화가 있으면 표시 + 이어서 답글 */}
              {(recordComments[r.id] || []).length > 0 && (
                <CommentThread comments={recordComments[r.id]} userId={user?.id}
                  draft={rcInput[r.id] || ''} onDraft={v => setRcInput(prev => ({ ...prev, [r.id]: v }))}
                  onSend={() => sendInlineComment(r.id)} sending={!!rcSending[r.id]}/>
              )}
            </div>
          )
        })}

        </>)}

        {/* 앨범 — 사진만. 메모·피드백을 칸에 넣으면 칸이 커져서 "쌓였다"가 안 보인다. */}
        {view === 'album' && (albumCount === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--tmu)', fontSize:12.5, border:'1.5px dashed var(--g2)', borderRadius:16, lineHeight:1.9 }}>
            아직 앨범에 담긴 그림이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>기록에 사진을 올리면 여기에 하나씩 쌓여요</span>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:6, margin:'0 2px 12px', fontSize:11.5, fontWeight:800, color:'var(--tmu)' }}>
              <span style={{ color:ACCENT_TEXT }}>그림 {albumCount}장</span>
              {firstRecordDate && <><span style={{ width:3, height:3, borderRadius:'50%', background:'var(--tmu)' }} />{firstRecordDate.replace(/-/g, '.')}부터</>}
            </div>
            {albumGroups.map((g, gi) => (
              <div key={g.key} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, margin:'0 2px 7px' }}>
                  <span style={{ fontSize:11.5, fontWeight:800, color:'var(--tmu)', flexShrink:0 }}>{monthLabel(g, gi)}</span>
                  <span style={{ height:1, background:'var(--g1)', flex:1 }} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
                  {g.items.map(({ ph, r }) => {
                    const url = signedUrls[ph.storage_path]
                    const hasFb = (r.class_record_feedback || []).length > 0
                    const md = r.class_date.slice(5).replace('-', '.')
                    return (
                      <button key={ph.id} className="press" title={`${md} 기록 보기`}
                        onClick={() => { setView('calendar'); setCtx({ date: r.class_date, cls: r.class_name || '' }); setCalYM({ y:+r.class_date.slice(0,4), m:+r.class_date.slice(5,7) - 1 }); window.scrollTo(0, 0) }}
                        style={{ position:'relative', aspectRatio:'1', borderRadius:12, overflow:'hidden', border:'none', padding:0, background:ACCENT_BG, cursor:'pointer', display:'block' }}>
                        {url
                          ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                          : <span style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📷</span>}
                        <span style={{ position:'absolute', left:4, bottom:4, fontSize:9.5, fontWeight:800, color:'#fff', background:'rgba(11,11,14,0.62)', borderRadius:6, padding:'1px 5px' }}>{md}</span>
                        {ph.palette && <span style={{ position:'absolute', left:4, top:4, fontSize:9.5, fontWeight:800, color:'#fff', background:'rgba(11,11,14,0.62)', borderRadius:6, padding:'1px 5px' }}>🎨</span>}
                        {hasFb && <span title="강사 피드백이 있어요" style={{ position:'absolute', top:5, right:5, width:7, height:7, borderRadius:'50%', background:'var(--ac2)', boxShadow:'0 0 0 2px rgba(11,11,14,0.35)' }} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        ))}

        {/* 피드백 노트 — 받은 말과 그때 오간 대화를 한 덩어리로 */}
        {view === 'notes' && (noteRecords.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--tmu)', fontSize:12.5, border:'1.5px dashed var(--g2)', borderRadius:16, lineHeight:1.9 }}>
            아직 받은 피드백이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>기록에 강사 피드백이 달리면 여기에 모여요</span>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:6, margin:'0 2px 12px', fontSize:11.5, fontWeight:800, color:'var(--tmu)' }}>
              <span style={{ color:ACCENT_TEXT }}>받은 피드백 {fbCount}개</span>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--tmu)' }} />
              주고받은 말 {talkCount}개
            </div>
            {noteRecords.map(r => {
              const thumbPath = (r.class_record_photos || [])[0]?.storage_path
              const thumb = thumbPath ? signedUrls[thumbPath] : null
              const nd = new Date(r.class_date + 'T00:00:00')
              return (
                <div key={r.id} className="p-card" style={{ padding:'13px', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11.5, fontWeight:800, color:'var(--td)' }}>{nd.getMonth()+1}월 {nd.getDate()}일 ({DOW[nd.getDay()]})</span>
                    {r.class_name && <span style={{ fontSize:10.5, fontWeight:800, color:ACCENT_TEXT, background:ACCENT_BG, border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', borderRadius:20, padding:'2px 9px' }}>{r.class_name}</span>}
                  </div>
                  {thumb && (
                    <div className="press" onClick={() => { const photos = recordPhotos(r); if (photos.length) { setViewer({ photos, idx:0, recordId: r.id }); setViewerText('') } }}
                      style={{ display:'flex', alignItems:'center', gap:8, marginTop:9, cursor:'pointer' }}>
                      <img src={thumb} alt="" style={{ width:34, height:34, borderRadius:9, objectFit:'cover', display:'block', flexShrink:0 }}/>
                      <span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)' }}>이 그림에 남겨진 말</span>
                    </div>
                  )}
                  {(r.class_record_feedback || []).map(fb => (
                    <FeedbackBox key={fb.id} fb={fb} catMap={catMap} nameMap={nameMap} signedUrls={signedUrls}
                      onOpenPhotos={(paths, path) => { const v = openPhotos(paths, path); if (v) { setViewer({ ...v, recordId: r.id }); setViewerText('') } }}/>
                  ))}
                  {(recordComments[r.id] || []).length > 0 && (
                    <CommentThread comments={recordComments[r.id]} userId={user?.id}
                      draft={rcInput[r.id] || ''} onDraft={v => setRcInput(prev => ({ ...prev, [r.id]: v }))}
                      onSend={() => sendInlineComment(r.id)} sending={!!rcSending[r.id]}/>
                  )}
                </div>
              )
            })}
          </>
        ))}
      </div>

      {/* 하단 입력바 — 선택한 날짜에 바로 기록. 📷 사진, 🎨 색 계획.
          앨범·피드백 노트는 지난 것을 읽는 자리라 입력바를 내린다(어느 날짜에 쓰는지가 사라지므로). */}
      {view === 'calendar' && (
      <div className="g-glass-bar" style={{ position:'fixed', bottom:66, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:390, background:'#fff', borderTop:`2px solid rgb(var(--ac-rgb) / 0.15)`, zIndex:90, boxSizing:'border-box' }}>

        {/* 대상 날짜 칩 + 라운지 공유 토글 */}
        <div className="no-scrollbar" style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px 0', overflowX:'auto' }}>
          <span onClick={() => setShareLounge(v => !v)} className="press"
            style={{ flexShrink:0, fontSize:10.5, fontWeight:800, cursor:'pointer', borderRadius:20, padding:'4px 11px', display:'flex', alignItems:'center', gap:5,
              color: shareLounge ? '#fff' : 'var(--tmu)',
              background: shareLounge ? ACCENT : 'var(--surf)',
              border: `2px solid ${shareLounge ? ACCENT : 'rgb(var(--ac-rgb) / 0.3)'}`,
              boxShadow: shareLounge ? '2px 2px 0 rgb(var(--ac-rgb) / 0.25)' : 'none', transition:'all 0.15s' }}>
            💬 라운지 공유 {shareLounge ? 'ON' : 'OFF'}
          </span>
          <span style={{ flexShrink:0, fontSize:10.5, fontWeight:800, color:ACCENT_TEXT, background:ACCENT_BG, border:`2px solid rgb(var(--ac-rgb) / 0.35)`, borderRadius:20, padding:'4px 11px', display:'flex', alignItems:'center', gap:6 }}>
            📌 {selD.getMonth()+1}월 {selD.getDate()}일에 기록{ctx.cls ? ` · ${ctx.cls}` : ''}
          </span>
        </div>

        {/* 선택한 사진 미리보기 */}
        {composePreviews.length > 0 && (
          <div style={{ display:'flex', gap:7, padding:'10px 12px 0', overflowX:'auto' }} className="no-scrollbar">
            {composePreviews.map((url, i) => (
              <div key={url} className="thumb-in" style={{ position:'relative', width:56, height:56, flexShrink:0, borderRadius:14, overflow:'hidden', border:`2.5px solid rgb(var(--ac-rgb) / 0.4)` }}>
                <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                <button onClick={() => removePick(i)}
                  style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:9, background:'rgba(27,28,70,0.6)', color:'#fff', border:'none', fontSize:10, cursor:'pointer', lineHeight:1, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px 10px' }}>
          <label className="press" title="사진 첨부"
            style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', background:'var(--surf)', border:`3px solid ${ACCENT}`, fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            📷
            <input type="file" multiple accept="image/*" onChange={pickFiles} style={{ display:'none' }}/>
          </label>
          <button className="press" title="색 계획 (삼색)" onClick={() => { setPlannerInit(null); setPlannerOpen(true) }}
            style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', background:'var(--surf)', border:`3px solid ${ACCENT}`, fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
            🎨
          </button>
          <input value={composeText} onChange={e => setComposeText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend() }}
            placeholder={selDate === todayStr ? '오늘 기록 남기기…' : `${selD.getMonth()+1}월 ${selD.getDate()}일 기록 남기기…`}
            style={{ flex:1, height:42, background:ACCENT_BG, border:`3px solid ${ACCENT}`, borderRadius:24, padding:'0 16px', fontSize:13, color:'var(--td)', fontWeight:600, fontFamily:'Nunito,sans-serif', outline:'none', boxSizing:'border-box', minWidth:0 }}/>
          <button className="press" onClick={handleSend} disabled={sending || (!composeText.trim() && composeFiles.length === 0)}
            style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', border:`3px solid ${ACCENT}`, color:'#fff', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0,
              background: (composeText.trim() || composeFiles.length) ? ACCENT : 'rgb(var(--ac-rgb) / 0.35)',
              boxShadow:'2px 2px 0 rgb(var(--ac-rgb) / 0.3)' }}>
            {sending ? '…' : '➤'}
          </button>
        </div>
      </div>
      )}

      {/* 사진 크게 보기 — 라이트박스 + 댓글 (라운지와 동일) */}
      {viewer && (
        <div onClick={() => setViewer(null)}
          onTouchStart={e => { viewerTouchX.current = e.touches[0].clientX }}
          onTouchEnd={viewerSwipe}
          style={{ position:'fixed', inset:0, background:'rgba(10,11,35,0.93)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:'46px 12px 150px' }}>
          <img src={viewer.photos[viewer.idx]} alt="" onClick={e => e.stopPropagation()}
            style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:18, display:'block' }}/>
          <button onClick={() => setViewer(null)}
            style={{ position:'absolute', top:14, right:14, width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', fontSize:17, cursor:'pointer', lineHeight:1 }}>✕</button>
          {viewer.photos.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setViewer(v => ({ ...v, idx:(v.idx-1+v.photos.length)%v.photos.length })) }}
                style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setViewer(v => ({ ...v, idx:(v.idx+1)%v.photos.length })) }}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>›</button>
            </>
          )}

          {/* 사진 보면서 댓글 — 하단 패널 */}
          <div onClick={e => e.stopPropagation()}
            style={{ position:'absolute', left:0, right:0, bottom:0, maxWidth:390, margin:'0 auto', padding:'22px 14px 16px', boxSizing:'border-box', display:'flex', flexDirection:'column', gap:8, background:'linear-gradient(to top, rgba(10,11,35,0.97) 65%, rgba(10,11,35,0))' }}>
            {viewer.photos.length > 1 && (
              <div style={{ display:'flex', gap:7, justifyContent:'center' }}>
                {viewer.photos.map((_, i) => (
                  <div key={i} onClick={() => setViewer(v => ({ ...v, idx:i }))}
                    style={{ width:9, height:9, borderRadius:'50%', background: i===viewer.idx ? '#fff' : 'rgba(255,255,255,0.4)', cursor:'pointer' }}/>
                ))}
              </div>
            )}
            {(recordComments[viewer.recordId] || []).length > 0 && (
              <div className="no-scrollbar" style={{ maxHeight:110, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
                {(recordComments[viewer.recordId] || []).map(c => (
                  <div key={c.id} style={{ fontSize:11.5, color:'#fff', lineHeight:1.5, wordBreak:'break-word' }}>
                    <span style={{ fontWeight:900, color:'rgba(255,255,255,0.72)', marginRight:6 }}>{c.author_name}{c.user_id !== user?.id ? ' 쌤' : ''}</span>
                    <span style={{ fontWeight:600 }}>{c.content}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:'flex', gap:7, alignItems:'center' }}>
              <input className="viewer-input" value={viewerText} onChange={e => setViewerText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendRecordComment() }}
                placeholder="사진 보면서 댓글 남기기…"
                style={{ flex:1, minWidth:0, height:38, borderRadius:20, border:'2px solid rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.14)', color:'#fff', padding:'0 14px', fontSize:12, fontWeight:600, outline:'none', fontFamily:'Nunito,sans-serif', boxSizing:'border-box' }}/>
              <button onClick={sendRecordComment} disabled={viewerSending || !viewerText.trim()}
                style={{ width:38, height:38, flexShrink:0, borderRadius:'50%', border:'none', color:'#fff', fontSize:13, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', background: viewerText.trim() ? ACCENT : 'rgba(255,255,255,0.22)' }}>
                {viewerSending ? '…' : '➤'}
              </button>
            </div>
          </div>
        </div>
      )}

      {plannerOpen && (
        <PalettePlanner
          initial={plannerInit}
          role={user?.user_metadata?.role}
          saving={savingPlan}
          onClose={() => { setPlannerOpen(false); setPlannerInit(null) }}
          onSave={handleSavePlan}
        />
      )}

      <StudentNav active="records" role={user?.user_metadata?.role || undefined}/>
    </>
  )
}

export default function RecordsPage() {
  return (
    <Suspense fallback={null}>
      <RecordsInner />
    </Suspense>
  )
}
