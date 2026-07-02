'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import LoadingCat from '../../../components/LoadingCat'

const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'
const CARD = 'var(--card)'
const BORDER = 'var(--line)'
const DOW = ['일','월','화','수','목','금','토']

function RecordsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  // URL params
  const qDate = searchParams.get('date')
  const qClass = searchParams.get('class')
  const qExpand = searchParams.get('expand')

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

  // Apply URL params after records load
  useEffect(() => {
    if (initialized) return
    if (loading) return
    setInitialized(true)

    if (qExpand) {
      setExpanded(qExpand)
      // load photos for that record
      const rec = records.find(r => r.id === qExpand)
      if (rec) loadPhotos(rec)
    } else if (qDate || qClass) {
      setCreating(true)
    }
  }, [loading, records])

  async function loadRecords(userId) {
    const { data } = await supabase
      .from('class_records')
      .select('*, class_record_photos(*), class_record_feedback(*)')
      .eq('user_id', userId)
      .order('class_date', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  async function loadPhotos(record) {
    if (!record.class_record_photos?.length) return
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const pairs = await Promise.all(
      record.class_record_photos
        .filter(p => !signedUrls[p.storage_path])
        .map(async p => {
          const res = await fetch(`/api/records/signed-url?path=${encodeURIComponent(p.storage_path)}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const json = await res.json()
          return [p.storage_path, json.url || null]
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
        if (!upErr) {
          await supabase.from('class_record_photos').insert({ record_id: rec.id, storage_path: path })
        }
      }

      previewUrls.forEach(u => URL.revokeObjectURL(u))
      setCreating(false)
      setNewDate(todayStr)
      setNewClass('')
      setNewMemo('')
      setPendingFiles([])
      setPreviewUrls([])
      loadRecords(user.id)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('기록을 삭제할까요?')) return
    await supabase.from('class_records').delete().eq('id', id)
    setExpanded(null)
    loadRecords(user.id)
  }

  function cancelCreate() {
    previewUrls.forEach(u => URL.revokeObjectURL(u))
    setCreating(false)
    setNewDate(todayStr)
    setNewClass('')
    setNewMemo('')
    setPendingFiles([])
    setPreviewUrls([])
  }

  if (loading) return <LoadingCat />

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>📋</span>
          <span className="p-title">수업 기록</span>
        </div>
      </div>

      <div style={{ background:'#fff', padding:'8px 14px 0', minHeight:'80vh' }}>

        {creating ? (
          <div style={{ background:ACCENT_BG, borderRadius:14, padding:'14px', marginBottom:14, border:`1.5px solid rgb(var(--ac-rgb) / 0.33)` }}>
            <div style={{ fontSize:13, fontWeight:700, color:ACCENT_TEXT, marginBottom:12 }}>새 기록</div>

            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>날짜</div>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:13, background:'#fff', fontFamily:'Nunito,sans-serif', boxSizing:'border-box' }}/>
            </div>

            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>수업명 (선택)</div>
              <input type="text" value={newClass} onChange={e => setNewClass(e.target.value)}
                placeholder="예: 페인팅 기초"
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:13, background:'#fff', fontFamily:'Nunito,sans-serif', boxSizing:'border-box' }}/>
            </div>

            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>메모</div>
              <textarea value={newMemo} onChange={e => setNewMemo(e.target.value)} rows={4}
                placeholder="오늘 배운 것, 느낀 점, 다음에 해볼 것..."
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, border:`1.5px solid ${BORDER}`, fontSize:13, resize:'none', background:'#fff', fontFamily:'Nunito,sans-serif', boxSizing:'border-box' }}/>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:4 }}>사진 (선택)</div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'#fff', border:`1.5px solid ${BORDER}`, borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500 }}>
                📷 사진 선택
                <input type="file" multiple accept="image/*" onChange={handleFilePick} style={{ display:'none' }}/>
              </label>
              {previewUrls.length > 0 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                  {previewUrls.map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width:64, height:64, objectFit:'cover', borderRadius:8 }}/>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={cancelCreate}
                style={{ flex:1, padding:'10px', background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                취소
              </button>
              <button onClick={handleCreate} disabled={saving || !newDate}
                style={{ flex:2, padding:'10px', background:saving?'#aaa':ACCENT, color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:saving?'default':'pointer', fontFamily:'Nunito,sans-serif' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            style={{ width:'100%', padding:'12px', background:ACCENT_BG, color:ACCENT_TEXT, border:`1.5px solid rgb(var(--ac-rgb) / 0.33)`, borderRadius:14, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif', marginBottom:14 }}>
            + 새 기록 추가
          </button>
        )}

        {records.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:13, lineHeight:1.8 }}>
            아직 기록이 없어요 🐾<br/>
            <span style={{ fontSize:11 }}>수업 후 메모와 사진을 남겨보세요</span>
          </div>
        ) : records.map(r => {
          const isOpen = expanded === r.id
          const d = new Date(r.class_date + 'T00:00:00')
          const dateLabel = `${r.class_date.slice(5).replace('-','/')} (${DOW[d.getDay()]})`
          const hasFeedback = r.class_record_feedback?.length > 0
          return (
            <div key={r.id} style={{ borderRadius:14, marginBottom:8, overflow:'hidden', border:`1.5px solid ${isOpen?ACCENT:BORDER}`, background:isOpen?ACCENT_BG:CARD }}>
              <div onClick={() => handleExpand(r)}
                style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:isOpen?ACCENT_TEXT:'var(--td)' }}>
                    {r.class_name || '자유 기록'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--tmu)', marginTop:2, display:'flex', gap:8 }}>
                    <span>{dateLabel}</span>
                    {r.class_record_photos?.length > 0 && <span>📷 {r.class_record_photos.length}</span>}
                    {hasFeedback && <span style={{ color:ACCENT, fontWeight:600 }}>💬 피드백 {r.class_record_feedback.length}</span>}
                  </div>
                </div>
                <span style={{ fontSize:16, color:isOpen?ACCENT:'var(--tmu)', display:'inline-block', transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'none' }}>›</span>
              </div>

              {isOpen && (
                <div style={{ borderTop:`1px solid rgb(var(--ac-rgb) / 0.16)`, padding:'10px 14px 14px' }}>
                  {r.note && (
                    <div style={{ fontSize:12, color:'var(--td)', lineHeight:1.7, marginBottom:10, whiteSpace:'pre-wrap' }}>
                      {r.note}
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

                  {hasFeedback && (
                    <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:`1.5px solid rgb(var(--ac-rgb) / 0.25)`, marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginBottom:6 }}>강사 피드백</div>
                      {r.class_record_feedback.map(fb => (
                        <div key={fb.id} style={{ fontSize:12, color:'var(--td)', lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:4 }}>
                          {fb.body}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ textAlign:'right' }}>
                    <button onClick={() => handleDelete(r.id)}
                      style={{ fontSize:10, padding:'4px 10px', borderRadius:20, background:'transparent', color:'var(--tmu)', border:`1px solid ${BORDER}`, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div style={{ height:80 }}/>
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
