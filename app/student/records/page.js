'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import LoadingCat from '../../../components/LoadingCat'
import { pixelCatImg, DEFAULT_PROFILE_CAT, isValidPixelCat } from '../../../lib/pixelCats'

// 카톡형 채팅 로그 — 내 메모(오른쪽 말풍선) ↔ 강사 피드백(왼쪽 말풍선).
// 외곽선·말풍선은 전부 테마 변수(--ac 계열)라 4가지 컬러모드를 따라간다.
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

function RecordsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [signedUrls, setSignedUrls] = useState({})
  const [catMap, setCatMap] = useState({})       // user_id → profile_cat (개인설정 프로필)
  const [nameMap, setNameMap] = useState({})     // teacher_id → 이름
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  const qDate = searchParams.get('date')
  const qClass = searchParams.get('class')
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(qDate || '') ? qDate : todayStr

  const [newDate, setNewDate] = useState(validDate)
  const [newClass, setNewClass] = useState(qClass || '')
  const [newMemo, setNewMemo] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadRecords(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (initialized || loading) return
    setInitialized(true)
    if (qDate || qClass) setCreating(true)
    // 채팅처럼 최신(맨 아래)으로 스크롤
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 120)
  }, [loading])

  async function loadRecords(userId) {
    const { data } = await supabase
      .from('class_records')
      .select('*, class_record_photos(*), class_record_feedback(*)')
      .eq('user_id', userId)
      .order('class_date', { ascending: true })
    const recs = data || []
    setRecords(recs)

    // 피드백 남긴 강사들의 프로필 고양이·이름
    const tIds = [...new Set(recs.flatMap(r => (r.class_record_feedback || []).map(f => f.teacher_id)).filter(Boolean))]
    if (tIds.length) {
      const [{ data: prefs }, { data: usrs }] = await Promise.all([
        supabase.from('user_prefs').select('user_id, profile_cat').in('user_id', tIds),
        supabase.from('users').select('id, name').in('id', tIds),
      ])
      const cm = {}; (prefs || []).forEach(p => { cm[p.user_id] = p.profile_cat })
      const nm = {}; (usrs || []).forEach(u => { nm[u.id] = u.name })
      setCatMap(cm); setNameMap(nm)
    }
    setLoading(false)
    // 사진 서명 URL은 뒤에서 채운다 (표시는 placeholder → 로드되면 교체)
    loadAllPhotos(recs)
  }

  async function loadAllPhotos(recs) {
    const paths = recs.flatMap(r => (r.class_record_photos || []).map(p => p.storage_path))
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
    setSignedUrls(Object.fromEntries(pairs.filter(([, u]) => u)))
  }

  function handleFilePick(e) {
    const files = Array.from(e.target.files)
    previewUrls.forEach(u => URL.revokeObjectURL(u))
    setPendingFiles(files)
    setPreviewUrls(files.map(f => URL.createObjectURL(f)))
  }

  async function handleCreate() {
    if (!user || !newDate) return
    setSaving(true)
    try {
      const { data: rec } = await supabase
        .from('class_records')
        .insert({ user_id: user.id, class_date: newDate, class_name: newClass || null, note: newMemo || null })
        .select().single()
      if (!rec) throw new Error('insert failed')
      for (const file of pendingFiles) {
        const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, 'jpg')
        const path = `${user.id}/${rec.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('class-records').upload(path, file)
        if (!upErr) await supabase.from('class_record_photos').insert({ record_id: rec.id, storage_path: path })
      }
      previewUrls.forEach(u => URL.revokeObjectURL(u))
      setCreating(false)
      setNewDate(todayStr); setNewClass(''); setNewMemo('')
      setPendingFiles([]); setPreviewUrls([])
      await loadRecords(user.id)
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }), 150)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 기록을 삭제할까요?')) return
    await supabase.from('class_records').delete().eq('id', id)
    loadRecords(user.id)
  }

  function cancelCreate() {
    previewUrls.forEach(u => URL.revokeObjectURL(u))
    setCreating(false)
    setNewDate(todayStr); setNewClass(''); setNewMemo('')
    setPendingFiles([]); setPreviewUrls([])
  }

  if (loading) return <LoadingCat />

  // 날짜별 그룹 (오름차순 → 채팅처럼 아래가 최신)
  const groups = []
  for (const r of records) {
    const last = groups[groups.length - 1]
    if (last && last.date === r.class_date) last.items.push(r)
    else groups.push({ date: r.class_date, items: [r] })
  }

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>📋</span>
          <span className="p-title">수업 기록</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--acTx)', background:ACCENT_BG, border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', padding:'4px 10px', borderRadius:20 }}>
          기록 {records.length}개
        </span>
      </div>

      <div style={{ background:'#fff', padding:'12px 12px 158px', minHeight:'80vh' }}>

        {records.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--tmu)', fontSize:13, lineHeight:1.9 }}>
            아직 기록이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>아래 입력창을 눌러 첫 기록을 남겨보세요</span>
          </div>
        )}

        {groups.map(g => {
          const d = new Date(g.date + 'T00:00:00')
          return (
            <div key={g.date}>
              {/* 날짜 구분선 */}
              <div style={{ display:'flex', justifyContent:'center', margin:'10px 0 14px' }}>
                <span style={{ fontSize:10.5, fontWeight:800, color:ACCENT_TEXT, background:'rgb(var(--ac-rgb) / 0.1)', padding:'5px 14px', borderRadius:20 }}>
                  {d.getMonth()+1}월 {d.getDate()}일 ({DOW[d.getDay()]})
                </span>
              </div>

              {g.items.map(r => (
                <div key={r.id} style={{ marginBottom:16 }}>
                  {/* 내 기록 — 오른쪽 말풍선 */}
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:6 }}>
                    <div style={{ maxWidth:'80%', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      {r.class_name && (
                        <span style={{ fontSize:10, fontWeight:800, color:ACCENT_TEXT, background:ACCENT_BG, border:`2px solid rgb(var(--ac-rgb) / 0.35)`, borderRadius:20, padding:'3px 10px' }}>
                          🎨 {r.class_name}
                        </span>
                      )}
                      <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
                        <button onClick={() => handleDelete(r.id)} title="기록 삭제"
                          style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${BORDER}`, background:'#fff', color:'var(--tl)', fontSize:11, lineHeight:1, cursor:'pointer', flexShrink:0, padding:0 }}>✕</button>
                        <div style={{ background:ACCENT, color:'#fff', fontSize:13.5, fontWeight:600, lineHeight:1.6, padding:'12px 15px', borderRadius:'24px 24px 8px 24px', boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.22)', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                          {r.note || (r.class_name ? `${r.class_name} 수업 기록` : '수업 기록')}
                        </div>
                      </div>
                      {r.class_record_photos?.length > 0 && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                          {r.class_record_photos.map(p => (
                            <div key={p.id} style={{ width:92, height:92, borderRadius:18, overflow:'hidden', border:`3px solid ${ACCENT}`, boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.22)', background:ACCENT_BG, flexShrink:0 }}>
                              {signedUrls[p.storage_path]
                                ? <img src={signedUrls[p.storage_path]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📷</div>
                              }
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 강사 피드백 — 왼쪽 말풍선 + 프로필 고양이 */}
                  {(r.class_record_feedback || []).map(fb => (
                    <div key={fb.id} style={{ display:'flex', gap:8, alignItems:'flex-end', marginBottom:6 }}>
                      {catFace(catMap, fb.teacher_id)}
                      <div style={{ maxWidth:'76%', display:'flex', flexDirection:'column', gap:3 }}>
                        <span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)', marginLeft:4 }}>
                          {nameMap[fb.teacher_id] ? `${nameMap[fb.teacher_id]} 쌤` : '선생님'}
                        </span>
                        <div style={{ background:'var(--ac2)', color:'var(--td)', border:`3px solid ${ACCENT}`, fontSize:13.5, fontWeight:600, lineHeight:1.6, padding:'11px 14px', borderRadius:'24px 24px 24px 8px', boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.25)', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                          <span style={{ display:'inline-block', fontSize:9, fontWeight:900, letterSpacing:0.5, background:ACCENT, color:'#fff', padding:'2px 8px', borderRadius:9, marginBottom:5 }}>강사 피드백</span>
                          <div>{fb.body}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* 카톡식 입력 바 — 누르면 기록 작성 시트 */}
      <div style={{ position:'fixed', bottom:66, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:390, padding:'8px 12px 10px', background:'#fff', borderTop:`2px solid rgb(var(--ac-rgb) / 0.15)`, display:'flex', alignItems:'center', gap:8, zIndex:90, boxSizing:'border-box' }}>
        <button onClick={() => setCreating(true)}
          style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', background:'#fff', border:`3px solid ${ACCENT}`, fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>📷</button>
        <div onClick={() => setCreating(true)}
          style={{ flex:1, height:42, background:ACCENT_BG, border:`3px solid ${ACCENT}`, borderRadius:24, display:'flex', alignItems:'center', padding:'0 16px', fontSize:12.5, color:'var(--tmu)', fontWeight:700, cursor:'pointer' }}>
          오늘 기록 남기기…
        </div>
        <button onClick={() => setCreating(true)}
          style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', background:ACCENT, border:`3px solid ${ACCENT}`, color:'#fff', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, boxShadow:'2px 2px 0 rgb(var(--ac-rgb) / 0.3)' }}>➤</button>
      </div>

      {/* 작성 바텀시트 */}
      {creating && (
        <div onClick={e => { if (e.target === e.currentTarget && !saving) cancelCreate() }}
          style={{ position:'fixed', inset:0, background:'rgba(27,28,70,0.45)', zIndex:1000, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div style={{ background:'#fff', borderRadius:'28px 28px 0 0', border:`3px solid ${ACCENT}`, borderBottom:'none', maxHeight:'86vh', overflowY:'auto', padding:'14px 18px 26px', maxWidth:390, width:'100%', margin:'0 auto', boxSizing:'border-box' }}>
            <div style={{ display:'flex', justifyContent:'center', paddingBottom:10 }}>
              <div style={{ width:40, height:5, borderRadius:3, background:'rgb(var(--ac-rgb) / 0.25)' }}/>
            </div>
            <div style={{ fontSize:15, fontWeight:900, color:ACCENT_TEXT, marginBottom:14 }}>🐾 오늘의 기록</div>

            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--tmu)', marginBottom:4 }}>날짜</div>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:16, border:`2.5px solid rgb(var(--ac-rgb) / 0.4)`, fontSize:13, background:'#fff', fontFamily:'Nunito,sans-serif', boxSizing:'border-box', outline:'none' }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--tmu)', marginBottom:4 }}>수업명 (선택)</div>
              <input type="text" value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="예: 페인팅 기초"
                style={{ width:'100%', padding:'10px 12px', borderRadius:16, border:`2.5px solid rgb(var(--ac-rgb) / 0.4)`, fontSize:13, background:'#fff', fontFamily:'Nunito,sans-serif', boxSizing:'border-box', outline:'none' }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--tmu)', marginBottom:4 }}>메모</div>
              <textarea value={newMemo} onChange={e => setNewMemo(e.target.value)} rows={4}
                placeholder="오늘 배운 것, 느낀 점, 다음에 해볼 것..."
                style={{ width:'100%', padding:'10px 12px', borderRadius:16, border:`2.5px solid rgb(var(--ac-rgb) / 0.4)`, fontSize:13, resize:'none', background:'#fff', fontFamily:'Nunito,sans-serif', boxSizing:'border-box', outline:'none' }}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--tmu)', marginBottom:4 }}>사진 (선택)</div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'8px 16px', background:ACCENT_BG, border:`2.5px solid rgb(var(--ac-rgb) / 0.4)`, borderRadius:22, fontSize:12, cursor:'pointer', fontWeight:800, color:ACCENT_TEXT }}>
                📷 사진 선택
                <input type="file" multiple accept="image/*" onChange={handleFilePick} style={{ display:'none' }}/>
              </label>
              {previewUrls.length > 0 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                  {previewUrls.map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width:64, height:64, objectFit:'cover', borderRadius:14, border:`2.5px solid rgb(var(--ac-rgb) / 0.4)` }}/>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={cancelCreate} disabled={saving}
                style={{ flex:1, padding:'12px', background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:18, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                취소
              </button>
              <button onClick={handleCreate} disabled={saving || !newDate}
                style={{ flex:2, padding:'12px', background:saving?'#aaa':ACCENT, color:'#fff', border:'none', borderRadius:18, fontSize:13, fontWeight:900, cursor:saving?'default':'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.25)' }}>
                {saving ? '저장 중...' : '기록 남기기 ➤'}
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentNav active="records"/>
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
