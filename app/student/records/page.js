'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import LoadingCat from '../../../components/LoadingCat'
import { pixelCatImg, DEFAULT_PROFILE_CAT, isValidPixelCat } from '../../../lib/pixelCats'

// 카톡형 채팅 로그 — 하단 입력바에서 바로 쓰고 보내면 말풍선이 튕기며 등장한다.
// 사진은 📷 아이콘 → 바로 선택, 날짜는 오늘(커리큘럼에서 넘어오면 그 날짜·수업 칩 표시).
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

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  // 커리큘럼 '기록 남기기'에서 넘어온 날짜·수업 컨텍스트 (칩으로 표시, 해제 가능)
  const qDate = searchParams.get('date')
  const qClass = searchParams.get('class')
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(qDate || '') ? qDate : todayStr
  const [ctx, setCtx] = useState({ date: validDate, cls: qClass || '' })
  const hasCtx = ctx.date !== todayStr || !!ctx.cls

  // 카톡식 입력바
  const [composeText, setComposeText] = useState('')
  const [composeFiles, setComposeFiles] = useState([])
  const [composePreviews, setComposePreviews] = useState([])
  const [sending, setSending] = useState(false)
  const [lastAddedId, setLastAddedId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadRecords(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (loading) return
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

  // 전송 — 낙관적으로 바로 말풍선 등장(튕기는 인터랙션), 사진은 로컬 미리보기로 즉시 표시
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

      const photoRows = []
      const urlByPath = {}
      for (let i = 0; i < composeFiles.length; i++) {
        const file = composeFiles[i]
        const raw = file.name.split('.').pop().toLowerCase()
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
      setComposeText('')
      setComposeFiles([]); setComposePreviews([]) // objectURL은 표시에 쓰므로 revoke하지 않음
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }), 60)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 기록을 삭제할까요?')) return
    await supabase.from('class_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <LoadingCat />

  const groups = []
  for (const r of records) {
    const last = groups[groups.length - 1]
    if (last && last.date === r.class_date) last.items.push(r)
    else groups.push({ date: r.class_date, items: [r] })
  }

  return (
    <>
      <style>{`
        @keyframes bubIn { 0%{opacity:0; transform:translateY(22px) scale(0.55)} 55%{opacity:1; transform:translateY(-5px) scale(1.07)} 78%{transform:translateY(2px) scale(0.97)} 100%{opacity:1; transform:translateY(0) scale(1)} }
        .bub-in { animation: bubIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: 100% 100%; }
        @keyframes thumbIn { 0%{opacity:0; transform:scale(0.4) rotate(-6deg)} 70%{opacity:1; transform:scale(1.09) rotate(2deg)} 100%{opacity:1; transform:scale(1) rotate(0)} }
        .thumb-in { animation: thumbIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
        .press { transition: transform 0.12s cubic-bezier(0.34,1.56,0.64,1); }
        .press:active { transform: scale(0.84); }
        @media (prefers-reduced-motion: reduce) { .bub-in, .thumb-in { animation: none } .press:active { transform:none } }
      `}</style>

      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>📋</span>
          <span className="p-title">수업 기록</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--acTx)', background:ACCENT_BG, border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', padding:'4px 10px', borderRadius:20 }}>
          기록 {records.length}개
        </span>
      </div>

      <div style={{ background:'#fff', padding:'12px 12px 170px', minHeight:'80vh' }}>

        {records.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--tmu)', fontSize:13, lineHeight:1.9 }}>
            아직 기록이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>아래 입력창에 바로 써서 남겨보세요</span>
          </div>
        )}

        {groups.map(g => {
          const d = new Date(g.date + 'T00:00:00')
          return (
            <div key={g.date}>
              <div style={{ display:'flex', justifyContent:'center', margin:'10px 0 14px' }}>
                <span style={{ fontSize:10.5, fontWeight:800, color:ACCENT_TEXT, background:'rgb(var(--ac-rgb) / 0.1)', padding:'5px 14px', borderRadius:20 }}>
                  {d.getMonth()+1}월 {d.getDate()}일 ({DOW[d.getDay()]})
                </span>
              </div>

              {g.items.map(r => {
                const isNew = r.id === lastAddedId
                return (
                  <div key={r.id} style={{ marginBottom:16 }}>
                    {/* 내 기록 — 오른쪽 말풍선 */}
                    <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:6 }}>
                      <div style={{ maxWidth:'80%', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                        {r.class_name && (
                          <span className={isNew ? 'bub-in' : ''} style={{ fontSize:10, fontWeight:800, color:ACCENT_TEXT, background:ACCENT_BG, border:`2px solid rgb(var(--ac-rgb) / 0.35)`, borderRadius:20, padding:'3px 10px' }}>
                            🎨 {r.class_name}
                          </span>
                        )}
                        {(r.note || !r.class_record_photos?.length) && (
                          <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
                            <button onClick={() => handleDelete(r.id)} title="기록 삭제"
                              style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${BORDER}`, background:'#fff', color:'var(--tl)', fontSize:11, lineHeight:1, cursor:'pointer', flexShrink:0, padding:0 }}>✕</button>
                            <div className={isNew ? 'bub-in' : ''}
                              style={{ background:ACCENT, color:'#fff', fontSize:13.5, fontWeight:600, lineHeight:1.6, padding:'12px 15px', borderRadius:'24px 24px 8px 24px', boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.22)', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                              {r.note || (r.class_name ? `${r.class_name} 수업 기록` : '수업 기록')}
                            </div>
                          </div>
                        )}
                        {r.class_record_photos?.length > 0 && (
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end', alignItems:'flex-end' }}>
                            {!r.note && (
                              <button onClick={() => handleDelete(r.id)} title="기록 삭제"
                                style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${BORDER}`, background:'#fff', color:'var(--tl)', fontSize:11, lineHeight:1, cursor:'pointer', flexShrink:0, padding:0, marginRight:2 }}>✕</button>
                            )}
                            {r.class_record_photos.map((p, i) => (
                              <div key={p.id} className={isNew ? 'thumb-in' : ''} style={{ width:92, height:92, borderRadius:18, overflow:'hidden', border:`3px solid ${ACCENT}`, boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.22)', background:ACCENT_BG, flexShrink:0, animationDelay:`${i * 70}ms` }}>
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
                )
              })}
            </div>
          )
        })}
      </div>

      {/* 카톡식 입력바 — 바로 쓰고 ➤, 📷은 즉시 사진 선택 */}
      <div style={{ position:'fixed', bottom:66, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:390, background:'#fff', borderTop:`2px solid rgb(var(--ac-rgb) / 0.15)`, zIndex:90, boxSizing:'border-box' }}>

        {/* 다른 날짜·수업 컨텍스트 칩 (커리큘럼에서 넘어온 경우) */}
        {hasCtx && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px 0' }}>
            <span style={{ fontSize:10.5, fontWeight:800, color:ACCENT_TEXT, background:ACCENT_BG, border:`2px solid rgb(var(--ac-rgb) / 0.35)`, borderRadius:20, padding:'4px 11px', display:'flex', alignItems:'center', gap:6 }}>
              📌 {ctx.date.slice(5).replace('-','/')}{ctx.cls ? ` · ${ctx.cls}` : ''} 기록으로 남겨요
              <span onClick={() => setCtx({ date: todayStr, cls: '' })} style={{ cursor:'pointer', fontWeight:900 }}>✕</span>
            </span>
          </div>
        )}

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
            style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', background:'#fff', border:`3px solid ${ACCENT}`, fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            📷
            <input type="file" multiple accept="image/*" onChange={pickFiles} style={{ display:'none' }}/>
          </label>
          <input value={composeText} onChange={e => setComposeText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend() }}
            placeholder="오늘 기록 남기기…"
            style={{ flex:1, height:42, background:ACCENT_BG, border:`3px solid ${ACCENT}`, borderRadius:24, padding:'0 16px', fontSize:13, color:'var(--td)', fontWeight:600, fontFamily:'Nunito,sans-serif', outline:'none', boxSizing:'border-box', minWidth:0 }}/>
          <button className="press" onClick={handleSend} disabled={sending || (!composeText.trim() && composeFiles.length === 0)}
            style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', border:`3px solid ${ACCENT}`, color:'#fff', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0,
              background: (composeText.trim() || composeFiles.length) ? ACCENT : 'rgb(var(--ac-rgb) / 0.35)',
              boxShadow:'2px 2px 0 rgb(var(--ac-rgb) / 0.3)' }}>
            {sending ? '…' : '➤'}
          </button>
        </div>
      </div>

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
