'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'

const SEATS = ['A', 'B', 'C', 'D', 'E']
const SEAT_LABEL = { A:'A · 창가·자연광', B:'B · 창가·자연광', C:'C · 중앙', D:'D · 중앙', E:'E · 창가' }

export default function AdminSeatsPage() {
  const router = useRouter()
  const [selSeat, setSelSeat] = useState('A')
  const [photos, setPhotos] = useState({})
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewIdx, setPreviewIdx] = useState(0)
  const touchX = useRef(null)

  function handleSwipe(e, len) {
    if (touchX.current == null || len < 2) return
    const delta = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(delta) < 50) return
    setPreviewIdx(i => delta < 0 ? (i+1)%len : (i-1+len)%len)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/login'); return }
      loadPhotos()
    })
  }, [])

  async function loadPhotos() {
    const { data } = await supabase
      .from('seat_photos')
      .select('*')
      .order('sort_order', { ascending: true })
    const grouped = {}
    SEATS.forEach(s => { grouped[s] = [] })
    ;(data || []).forEach(p => {
      if (grouped[p.seat_id]) grouped[p.seat_id].push(p)
    })
    setPhotos(grouped)
    setLoading(false)
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const current = photos[selSeat] || []
    if (current.length + files.length > 4) {
      alert(`자리당 최대 4장까지 등록 가능해요. 현재 ${current.length}장 있어요.`)
      return
    }
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${selSeat}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('seat-photos').upload(path, file)
      if (upErr) { alert('업로드 실패: ' + upErr.message); continue }
      const { data: urlData } = supabase.storage.from('seat-photos').getPublicUrl(path)
      await supabase.from('seat_photos').insert({
        seat_id: selSeat,
        image_url: urlData.publicUrl,
        sort_order: current.length
      })
    }
    await loadPhotos()
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(photo) {
    const path = photo.image_url.split('/seat-photos/')[1]
    if (path) await supabase.storage.from('seat-photos').remove([path])
    await supabase.from('seat_photos').delete().eq('id', photo.id)
    await loadPhotos()
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  const currentPhotos = photos[selSeat] || []

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => router.push('/admin')}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'#fff', fontSize:18 }}>‹</button>
          <span className="header-title">자리 사진 관리</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'18px 14px 100px' }}>

        <div style={{ display:'flex', gap:6, marginBottom:18, overflowX:'auto', paddingBottom:4 }}>
          {SEATS.map(s => (
            <button key={s} onClick={() => { setSelSeat(s); setPreviewIdx(0) }}
              style={{ flexShrink:0, padding:'8px 16px', borderRadius:20, border:`1.5px solid ${selSeat===s?'var(--g4)':'var(--g2)'}`, background:selSeat===s?'var(--g4)':'#fff', color:selSeat===s?'#fff':'var(--td)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
              {s}
            </button>
          ))}
        </div>

        <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:4 }}>{SEAT_LABEL[selSeat]}</div>
        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:16 }}>최대 4장까지 등록 가능 · 현재 {currentPhotos.length}장</div>

        {currentPhotos.length > 0 && (
          <div style={{ position:'relative', borderRadius:14, overflow:'hidden', aspectRatio:'4/3', background:'#f0ede8', marginBottom:14 }}
            onTouchStart={e => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={e => handleSwipe(e, currentPhotos.length)}>
            <img src={currentPhotos[previewIdx]?.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
            {currentPhotos.length > 1 && (
              <>
                <button onClick={() => setPreviewIdx(i => (i-1+currentPhotos.length)%currentPhotos.length)}
                  style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', width:44, height:44, borderRadius:'50%', background:'rgba(0,0,0,0.45)', color:'#fff', border:'none', fontSize:26, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
                <button onClick={() => setPreviewIdx(i => (i+1)%currentPhotos.length)}
                  style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:44, height:44, borderRadius:'50%', background:'rgba(0,0,0,0.45)', color:'#fff', border:'none', fontSize:26, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
                <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
                  {currentPhotos.map((_,i) => (
                    <div key={i} onClick={() => setPreviewIdx(i)} style={{ width:8, height:8, borderRadius:'50%', background:i===previewIdx?'#fff':'rgba(255,255,255,0.5)', cursor:'pointer' }}/>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
          {currentPhotos.map((p, i) => (
            <div key={p.id} style={{ position:'relative', borderRadius:14, overflow:'hidden', aspectRatio:'4/3', background:'var(--bg)' }}>
              <img src={p.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
              <button onClick={() => handleDelete(p)}
                style={{ position:'absolute', top:6, right:6, width:26, height:26, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                ×
              </button>
              <div style={{ position:'absolute', bottom:6, left:8, fontSize:10, color:'#fff', fontWeight:700, background:'rgba(0,0,0,0.4)', padding:'2px 6px', borderRadius:6 }}>
                {i+1}번째
              </div>
            </div>
          ))}

          {currentPhotos.length < 4 && (
            <label style={{ aspectRatio:'4/3', borderRadius:14, border:'1.5px dashed var(--g3)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:uploading?'default':'pointer', background:'var(--g1)', opacity:uploading?0.6:1 }}>
              <div style={{ fontSize:28, marginBottom:4 }}>{uploading ? '⏳' : '+'}</div>
              <div style={{ fontSize:11, color:'var(--tm)', fontWeight:700 }}>{uploading ? '업로드 중...' : '사진 추가'}</div>
              <input type="file" accept="image/*" multiple onChange={handleUpload} disabled={uploading} style={{ display:'none' }}/>
            </label>
          )}
        </div>

        {currentPhotos.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px 0', color:'var(--tmu)', fontSize:12 }}>
            아직 사진이 없어요. + 버튼으로 추가해 주세요.
          </div>
        )}

        <div style={{ background:'var(--g1)', borderRadius:12, padding:'12px 14px', fontSize:11, color:'var(--tm)', lineHeight:1.7 }}>
          💡 학생이 자리를 선택하면 여기 등록된 사진이 보여요.<br/>
          가로 방향 사진이 잘 보여요.
        </div>
      </div>

      <AdminNav />
    </>
  )
}
