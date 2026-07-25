'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import { pixelCatImg, DEFAULT_PROFILE_CAT, isValidPixelCat, getSavedProfileCat } from '../../../lib/pixelCats'
import { sendPushToUser } from '../../../lib/pushNotify'
import { compressImage } from '../../../lib/imageCompress'

const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'
const CARD = 'var(--card)'
const BORDER = 'var(--line)'
const DOW = ['일','월','화','수','목','금','토']

export default function AdminRecordsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [records, setRecords] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [search, setSearch] = useState('')
  const [fbInputs, setFbInputs] = useState({})
  const [fbEditing, setFbEditing] = useState({})
  const [fbSubmitting, setFbSubmitting] = useState({})
  const [fbFiles, setFbFiles] = useState({})       // record_id → File[] (첨부 대기 사진)
  const [fbPreviews, setFbPreviews] = useState({}) // record_id → objectURL[]
  const [rcMap, setRcMap] = useState({})       // record_id → 댓글/답글 스레드
  const [rcInput, setRcInput] = useState({})
  const [rcSending, setRcSending] = useState({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadAll()
    })
  }, [])

  async function loadAll() {
    const [{ data: recs }, { data: usrs }] = await Promise.all([
      supabase
        .from('class_records')
        .select('*, class_record_photos(*), class_record_feedback(*)')
        .order('class_date', { ascending: false }),
      supabase.from('users').select('id, name')
    ])
    setRecords(recs || [])
    const map = {}
    ;(usrs || []).forEach(u => { map[u.id] = u.name })
    setUserMap(map)
    // 사진 댓글/답글 스레드 로드 (테이블 없으면 조용히 빈 값)
    const recIds = (recs || []).map(r => r.id)
    if (recIds.length) {
      const { data: cs } = await supabase.from('record_comments').select('*').in('record_id', recIds).order('created_at', { ascending: true })
      const rc = {}; (cs || []).forEach(c => { (rc[c.record_id] = rc[c.record_id] || []).push(c) })
      setRcMap(rc)
    }
    setLoading(false)
  }

  // 강사 답글 → record_comments 저장 + 학생에게 알림
  async function handleRcSubmit(record) {
    const text = (rcInput[record.id] || '').trim()
    if (!text || !user || rcSending[record.id]) return
    setRcSending(prev => ({ ...prev, [record.id]: true }))
    try {
      const cbase = { record_id: record.id, user_id: user.id, author_name: user.user_metadata?.name || '강사', content: text }
      let { data: c, error } = await supabase.from('record_comments').insert({ ...cbase, author_cat: getSavedProfileCat() }).select().single()
      if (error) { ;({ data: c, error } = await supabase.from('record_comments').insert(cbase).select().single()) }
      if (error) { alert('답글 등록에 실패했어요. record_comments 마이그레이션 확인이 필요해요 🐾'); return }
      setRcMap(prev => ({ ...prev, [record.id]: [...(prev[record.id] || []), c] }))
      setRcInput(prev => ({ ...prev, [record.id]: '' }))
      const label = record.class_name ? `${record.class_name} 기록` : '기록'
      const body = `${user.user_metadata?.name || '강사'} 쌤이 ${label}에 답글을 남겼어요: ${text.slice(0, 40)}`
      await supabase.from('notifications').insert({ user_id: record.user_id, type: 'record_reply', title: '💬 기록 답글', body })
      sendPushToUser(record.user_id, '💬 기록 답글', body)
    } finally {
      setRcSending(prev => ({ ...prev, [record.id]: false }))
    }
  }

  async function loadPhotos(record) {
    // 학생 기록 사진 + 강사 피드백 첨부 사진 모두 서명(관리자는 버킷 전체 열람 가능)
    const paths = [
      ...(record.class_record_photos || []).map(p => p.storage_path),
      ...(record.class_record_feedback || []).flatMap(fb => Array.isArray(fb.photos) ? fb.photos : []),
    ].filter(p => p && !signedUrls[p])
    if (!paths.length) return
    const pairs = await Promise.all(paths.map(async path => {
      const { data } = await supabase.storage.from('class-records').createSignedUrl(path, 300)
      return [path, data?.signedUrl || null]
    }))
    const next = Object.fromEntries(pairs.filter(([, url]) => url))
    if (Object.keys(next).length) setSignedUrls(prev => ({ ...prev, ...next }))
  }

  // 피드백 첨부 사진 선택(여러 장, 미리보기)
  function pickFbFiles(recordId, e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const cur = fbFiles[recordId] || []
    if (cur.length + files.length > 6) { alert('피드백 사진은 6장까지 첨부할 수 있어요'); return }
    setFbFiles(prev => ({ ...prev, [recordId]: [...cur, ...files] }))
    setFbPreviews(prev => ({ ...prev, [recordId]: [...(prev[recordId] || []), ...files.map(f => URL.createObjectURL(f))] }))
  }
  function removeFbPick(recordId, i) {
    const prevs = fbPreviews[recordId] || []
    if (prevs[i]) URL.revokeObjectURL(prevs[i])
    setFbFiles(prev => ({ ...prev, [recordId]: (prev[recordId] || []).filter((_, idx) => idx !== i) }))
    setFbPreviews(prev => ({ ...prev, [recordId]: (prev[recordId] || []).filter((_, idx) => idx !== i) }))
  }
  function clearFbPicks(recordId) {
    ;(fbPreviews[recordId] || []).forEach(u => URL.revokeObjectURL(u))
    setFbFiles(prev => { const n = { ...prev }; delete n[recordId]; return n })
    setFbPreviews(prev => { const n = { ...prev }; delete n[recordId]; return n })
  }

  // 첨부 사진 업로드 → 저장 경로 배열 반환(압축은 클라이언트에서, 업로드는 service-role 라우트)
  async function uploadFbPhotos(recordId, files) {
    if (!files?.length) return []
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const paths = []
    for (const f of files) {
      const opt = await compressImage(f) // 업로드 전 리사이즈·재인코딩(용량 최적화)
      const form = new FormData()
      form.append('recordId', recordId)
      form.append('file', opt, opt.name || 'photo.jpg')
      try {
        const res = await fetch('/api/records/feedback-photo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
        const json = await res.json()
        if (res.ok && json.path) paths.push(json.path)
      } catch {}
    }
    return paths
  }

  function handleExpand(record) {
    if (expanded === record.id) { setExpanded(null); return }
    setExpanded(record.id)
    loadPhotos(record)
  }

  async function handleFeedbackSubmit(record) {
    const recordId = record.id
    const body = (fbInputs[recordId] || '').trim()
    const files = fbFiles[recordId] || []
    if ((!body && files.length === 0) || !user) return
    setFbSubmitting(prev => ({ ...prev, [recordId]: true }))
    try {
      const photos = await uploadFbPhotos(recordId, files) // 압축 후 업로드 → 경로 배열

      // photos 컬럼(마이그레이션) 미실행 시 없이 재시도 → 텍스트 피드백은 저장 유지
      const base = { record_id: recordId, teacher_id: user.id, body: body || '' }
      let { error } = await supabase.from('class_record_feedback').insert(photos.length ? { ...base, photos } : base)
      if (error && photos.length) { ({ error } = await supabase.from('class_record_feedback').insert(base)) }

      // 학생에게 알림 + 푸시 (기록 답글과 동일)
      const label = record.class_name ? `${record.class_name} 기록` : '기록'
      const summary = body ? body.slice(0, 40) : `사진 ${photos.length}장`
      const nbody = `${user.user_metadata?.name || '강사'} 쌤이 ${label}에 피드백을 남겼어요: ${summary}`
      await supabase.from('notifications').insert({ user_id: record.user_id, type: 'record_feedback', title: '📝 기록 피드백', body: nbody })
      sendPushToUser(record.user_id, '📝 기록 피드백', nbody)

      setFbInputs(prev => ({ ...prev, [recordId]: '' }))
      clearFbPicks(recordId)
      await loadAll()
    } finally {
      setFbSubmitting(prev => ({ ...prev, [recordId]: false }))
    }
  }

  async function handleFeedbackUpdate(fbId, body) {
    if (!body.trim()) return
    await supabase.from('class_record_feedback').update({ body, updated_at: new Date().toISOString() }).eq('id', fbId)
    setFbEditing(prev => { const n = { ...prev }; delete n[fbId]; return n })
    loadAll()
  }

  async function handleFeedbackDelete(fbId) {
    await supabase.from('class_record_feedback').delete().eq('id', fbId)
    loadAll()
  }

  const filtered = search.trim()
    ? records.filter(r => {
        const name = userMap[r.user_id] || ''
        const q = search.trim().toLowerCase()
        return name.toLowerCase().includes(q)
          || r.class_date.includes(q)
          || (r.class_name || '').toLowerCase().includes(q)
      })
    : records

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="clipboard" color="#fff" size={20} />
          <span className="header-title">수업 기록 관리</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 0', minHeight:'80vh' }}>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="학생명 / 날짜 / 수업명 검색..."
          style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:`1.5px solid ${BORDER}`, fontSize:13, background:'var(--g1)', fontFamily:'Nunito,sans-serif', marginBottom:14, boxSizing:'border-box', outline:'none' }}/>

        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10 }}>
          전체 {filtered.length}건
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13 }}>기록이 없어요 🐾</div>
        ) : filtered.map(r => {
          const isOpen = expanded === r.id
          const d = new Date(r.class_date + 'T00:00:00')
          const dateLabel = `${r.class_date.slice(5).replace('-','/')} (${DOW[d.getDay()]})`
          const studentName = userMap[r.user_id] || '학생'
          return (
            <div key={r.id} style={{ borderRadius:14, marginBottom:8, overflow:'hidden', border:`1.5px solid ${isOpen?ACCENT:BORDER}`, background:isOpen?ACCENT_BG:CARD }}>
              <div onClick={() => handleExpand(r)}
                style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:isOpen?ACCENT_TEXT:'var(--td)' }}>
                    {studentName} · {r.class_name || '자유 기록'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--tmu)', marginTop:2, display:'flex', gap:8 }}>
                    <span>{dateLabel}</span>
                    {r.class_record_photos?.length > 0 && <span>📷 {r.class_record_photos.length}</span>}
                    {r.class_record_feedback?.length > 0 && <span>💬 {r.class_record_feedback.length}</span>}
                  </div>
                </div>
                <span style={{ fontSize:16, color:isOpen?ACCENT:'var(--tmu)', display:'inline-block', transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'none' }}>›</span>
              </div>

              {isOpen && (
                <div style={{ borderTop:'1px solid rgb(var(--ac-rgb) / 0.16)', padding:'10px 14px 14px' }}>

                  {r.note && (
                    <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:`1px solid ${BORDER}`, marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>학생 메모</div>
                      <div style={{ fontSize:12, color:'var(--td)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{r.note}</div>
                    </div>
                  )}

                  {r.class_record_photos?.length > 0 && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {r.class_record_photos.map(p => (
                        <div key={p.id} style={{ width:80, height:80, borderRadius:10, background:'var(--g1)', overflow:'hidden', flexShrink:0 }}>
                          {signedUrls[p.storage_path]
                            ? <img src={signedUrls[p.storage_path]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>📷</div>
                          }
                        </div>
                      ))}
                    </div>
                  )}

                  {r.class_record_feedback?.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      {r.class_record_feedback.map(fb => (
                        <div key={fb.id} style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:`1px solid ${BORDER}`, marginBottom:6 }}>
                          {fbEditing[fb.id] !== undefined ? (
                            <>
                              <textarea value={fbEditing[fb.id]}
                                onChange={e => setFbEditing(prev => ({ ...prev, [fb.id]: e.target.value }))}
                                rows={3}
                                style={{ width:'100%', padding:'6px 8px', borderRadius:8, border:`1.5px solid ${BORDER}`, fontSize:12, resize:'none', fontFamily:'Nunito,sans-serif', boxSizing:'border-box', marginBottom:6 }}/>
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => setFbEditing(prev => { const n={...prev}; delete n[fb.id]; return n })}
                                  style={{ flex:1, padding:'6px', background:'var(--g1)', border:'none', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                                  취소
                                </button>
                                <button onClick={() => handleFeedbackUpdate(fb.id, fbEditing[fb.id])}
                                  style={{ flex:2, padding:'6px', background:ACCENT, color:'#fff', border:'none', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                                  저장
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {fb.body && (
                                <div style={{ fontSize:12, color:'var(--td)', lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom: 6 }}>
                                  {fb.body}
                                </div>
                              )}
                              {Array.isArray(fb.photos) && fb.photos.length > 0 && (
                                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: fb.teacher_id === user?.id ? 6 : 0 }}>
                                  {fb.photos.map((path, pi) => (
                                    <div key={pi} style={{ width:72, height:72, borderRadius:8, background:'var(--g1)', overflow:'hidden', flexShrink:0 }}>
                                      {signedUrls[path]
                                        ? <img src={signedUrls[path]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                                        : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📷</div>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {fb.teacher_id === user?.id && (
                                <div style={{ display:'flex', gap:6 }}>
                                  <button onClick={() => setFbEditing(prev => ({ ...prev, [fb.id]: fb.body }))}
                                    style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'transparent', color:'var(--tmu)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                                    수정
                                  </button>
                                  <button onClick={() => handleFeedbackDelete(fb.id)}
                                    style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'transparent', color:'#c0392b', border:'1px solid #f5c6cb', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                                    삭제
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <textarea value={fbInputs[r.id] || ''}
                      onChange={e => setFbInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                      rows={3} placeholder="피드백 입력..."
                      style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:12, resize:'none', fontFamily:'Nunito,sans-serif', marginBottom:6, boxSizing:'border-box' }}/>

                    {/* 첨부 사진 미리보기 */}
                    {(fbPreviews[r.id] || []).length > 0 && (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                        {(fbPreviews[r.id] || []).map((u, i) => (
                          <div key={i} style={{ position:'relative', width:64, height:64, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
                            <img src={u} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                            <button onClick={() => removeFbPick(r.id, i)}
                              style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:11, lineHeight:1, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display:'flex', gap:6 }}>
                      <label style={{ flexShrink:0, width:40, height:38, borderRadius:10, border:`1.5px solid ${BORDER}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, cursor:'pointer' }} title="사진 첨부">
                        📷
                        <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e => pickFbFiles(r.id, e)}/>
                      </label>
                      <button
                        onClick={() => handleFeedbackSubmit(r)}
                        disabled={fbSubmitting[r.id] || !((fbInputs[r.id]?.trim()) || (fbFiles[r.id]?.length))}
                        style={{ flex:1, padding:'9px', background:ACCENT, color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: fbSubmitting[r.id] || !((fbInputs[r.id]?.trim()) || (fbFiles[r.id]?.length)) ? 0.45 : 1 }}>
                        {fbSubmitting[r.id] ? '저장 중...' : '피드백 저장'}
                      </button>
                    </div>
                  </div>

                  {/* 사진 댓글 / 답글 스레드 — 학생 사진 댓글에 강사가 답글, 학생에게 알림 */}
                  <div style={{ marginTop:12, paddingTop:12, borderTop:'1px dashed rgb(var(--ac-rgb) / 0.25)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>💬 사진 댓글 · 답글</div>
                    {(rcMap[r.id] || []).length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                        {(rcMap[r.id] || []).map(c => {
                          const fromStudent = c.user_id === r.user_id
                          const catKey = isValidPixelCat(c.author_cat) ? c.author_cat : DEFAULT_PROFILE_CAT
                          return (
                            <div key={c.id} style={{ display:'flex', gap:6, alignItems:'flex-end', flexDirection: fromStudent ? 'row' : 'row-reverse' }}>
                              <div style={{ width:26, height:26, flexShrink:0, borderRadius:'50%', background:ACCENT_BG, border:`2px solid ${ACCENT}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                                <img src={pixelCatImg(catKey)} alt="" width={17} height={17} style={{ imageRendering:'pixelated', display:'block' }}/>
                              </div>
                              <div style={{ maxWidth:'76%', display:'flex', flexDirection:'column', alignItems: fromStudent ? 'flex-start' : 'flex-end', gap:2 }}>
                                <span style={{ fontSize:9.5, fontWeight:800, color:'var(--tmu)' }}>{c.author_name}{fromStudent ? '' : ' 쌤'}</span>
                                <div style={{ background: fromStudent ? 'var(--surf)' : ACCENT, color: fromStudent ? 'var(--td)' : '#fff', border: fromStudent ? `2px solid ${BORDER}` : 'none', fontSize:12, fontWeight:600, lineHeight:1.5, padding:'7px 11px', borderRadius: fromStudent ? '16px 16px 16px 4px' : '16px 16px 4px 16px', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                                  {c.content}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input value={rcInput[r.id] || ''} onChange={e => setRcInput(prev => ({ ...prev, [r.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleRcSubmit(r) }}
                        placeholder="답글 남기기…"
                        style={{ flex:1, minWidth:0, height:36, background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:18, padding:'0 12px', fontSize:12, color:'var(--td)', fontWeight:600, fontFamily:'Nunito,sans-serif', outline:'none', boxSizing:'border-box' }}/>
                      <button onClick={() => handleRcSubmit(r)} disabled={rcSending[r.id] || !(rcInput[r.id]?.trim())}
                        style={{ width:36, height:36, flexShrink:0, borderRadius:'50%', border:'none', color:'#fff', fontSize:13, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', background: rcInput[r.id]?.trim() ? ACCENT : 'rgb(var(--ac-rgb) / 0.35)' }}>
                        {rcSending[r.id] ? '…' : '➤'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div style={{ height:80 }}/>
      </div>

      <AdminNav active="records"/>
    </>
  )
}
