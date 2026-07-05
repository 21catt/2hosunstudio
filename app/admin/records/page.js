'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import { pixelCatImg, DEFAULT_PROFILE_CAT, isValidPixelCat, getSavedProfileCat } from '../../../lib/pixelCats'
import { sendPushToUser } from '../../../lib/pushNotify'

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
    if (!record.class_record_photos?.length) return
    const pairs = await Promise.all(
      record.class_record_photos
        .filter(p => !signedUrls[p.storage_path])
        .map(async p => {
          const { data } = await supabase.storage
            .from('class-records')
            .createSignedUrl(p.storage_path, 300)
          return [p.storage_path, data?.signedUrl || null]
        })
    )
    const next = Object.fromEntries(pairs.filter(([, url]) => url))
    if (Object.keys(next).length) setSignedUrls(prev => ({ ...prev, ...next }))
  }

  function handleExpand(record) {
    if (expanded === record.id) { setExpanded(null); return }
    setExpanded(record.id)
    loadPhotos(record)
  }

  async function handleFeedbackSubmit(recordId) {
    const body = (fbInputs[recordId] || '').trim()
    if (!body || !user) return
    setFbSubmitting(prev => ({ ...prev, [recordId]: true }))
    await supabase.from('class_record_feedback').insert({ record_id: recordId, teacher_id: user.id, body })
    setFbInputs(prev => ({ ...prev, [recordId]: '' }))
    setFbSubmitting(prev => ({ ...prev, [recordId]: false }))
    loadAll()
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
                              <div style={{ fontSize:12, color:'var(--td)', lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom: fb.teacher_id === user?.id ? 6 : 0 }}>
                                {fb.body}
                              </div>
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
                    <button
                      onClick={() => handleFeedbackSubmit(r.id)}
                      disabled={fbSubmitting[r.id] || !(fbInputs[r.id]?.trim())}
                      style={{ width:'100%', padding:'9px', background:ACCENT, color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: fbSubmitting[r.id] || !(fbInputs[r.id]?.trim()) ? 0.45 : 1 }}>
                      {fbSubmitting[r.id] ? '저장 중...' : '피드백 저장'}
                    </button>
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
