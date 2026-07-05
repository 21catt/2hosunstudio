'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import LoadingCat from '../../../components/LoadingCat'
import { pixelCatImg, DEFAULT_PROFILE_CAT, getSavedProfileCat, isValidPixelCat } from '../../../lib/pixelCats'
import { FARM_CATS } from '../../../lib/farmCats'

// 인스타형 개인 프로필 — 그 사람이 "라운지 공유 ON"으로 올린 글(posts)만 그리드로 보여준다.
// 공유 OFF 기록은 posts에 없어서 여기 안 뜬다(= 공유 토글이 노출 게이트).
// 본인이면 비공개 기록 사진을 나중에 골라 공개(앨범 1글)로 올릴 수 있다.
const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'

function catOf(key) { return isValidPixelCat(key) ? key : DEFAULT_PROFILE_CAT }

function CatAvatar({ catKey, size = 30 }) {
  const s = Math.round(size * 0.72)
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:ACCENT_BG, border:'2.5px solid var(--ac)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
      <img src={pixelCatImg(catKey || DEFAULT_PROFILE_CAT)} alt="" width={s} height={s} style={{ imageRendering:'pixelated', display:'block' }} />
    </div>
  )
}

function getImages(p) {
  if (p.images && p.images.length > 0) return p.images
  if (p.image_url) return [p.image_url]
  return []
}

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const targetId = params?.id

  const [user, setUser] = useState(null)          // 보는 사람(로그인 시)
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [profileCat, setProfileCat] = useState(DEFAULT_PROFILE_CAT)
  const [name, setName] = useState('')
  const [farmCat, setFarmCat] = useState('')
  const [harvestCount, setHarvestCount] = useState(0)
  const [likeCount, setLikeCount] = useState({})   // {postId: n}
  const [myLikes, setMyLikes] = useState(() => new Set())
  const [profileMap, setProfileMap] = useState({}) // {userId: profile_cat} — 댓글 아바타용
  const [viewer, setViewer] = useState(null)       // { images, idx, postId }
  const [viewerText, setViewerText] = useState('')
  const [viewerSending, setViewerSending] = useState(false)

  // 비공개 기록 사진 공개하기(본인 전용)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [myPhotos, setMyPhotos] = useState([])     // [{ storage_path, url, cls, date }]
  const [selected, setSelected] = useState(() => new Set())
  const [publishing, setPublishing] = useState(false)

  const touchX = useRef(null)
  function viewerSwipe(e) {
    if (touchX.current == null || !viewer || viewer.images.length < 2) return
    const delta = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(delta) < 50) return
    setViewer(v => ({ ...v, idx: delta < 0 ? (v.idx+1)%v.images.length : (v.idx-1+v.images.length)%v.images.length }))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null)
      setRole(data.user?.user_metadata?.role || 'student')
      load(data.user || null)
    })
  }, [targetId])

  async function load(me) {
    if (!targetId) { setLoading(false); return }
    const uid = me?.id || null

    // 공유한 글(posts) — 최신순
    const { data } = await supabase
      .from('posts')
      .select('*, comments(*)')
      .eq('author_id', targetId)
      .order('created_at', { ascending: false })
    const list = data || []
    setPosts(list)

    // 프로필 고양이 + 이름 + 냥밭(농부·수확)
    const { data: pref } = await supabase.from('user_prefs').select('profile_cat, farm_cat, harvest_count').eq('user_id', targetId).single()
    setProfileCat(catOf(pref?.profile_cat || list[0]?.author_cat))
    setFarmCat(pref?.farm_cat || FARM_CATS[0].key)
    setHarvestCount(Number.isFinite(pref?.harvest_count) ? pref.harvest_count : 0)
    const nm = list[0]?.author_name || (targetId === uid ? (me?.user_metadata?.name || '') : '') || '냥작가'
    setName(nm)

    // 댓글 작성자 아바타 맵
    const ids = new Set([targetId])
    list.forEach(p => (p.comments || []).forEach(c => c.user_id && ids.add(c.user_id)))
    const { data: prefs } = await supabase.from('user_prefs').select('user_id, profile_cat').in('user_id', [...ids])
    const pm = {}
    ;(prefs || []).forEach(pr => { if (pr.profile_cat) pm[pr.user_id] = pr.profile_cat })
    setProfileMap(pm)

    // 좋아요 — 이 사람 글에 대한 것만 집계
    const postIds = list.map(p => p.id)
    if (postIds.length) {
      const { data: likes } = await supabase.from('likes').select('post_id, user_id').in('post_id', postIds)
      const cnt = {}; const mine = new Set()
      ;(likes || []).forEach(l => { cnt[l.post_id] = (cnt[l.post_id] || 0) + 1; if (l.user_id === uid) mine.add(l.post_id) })
      setLikeCount(cnt); setMyLikes(mine)
    } else {
      setLikeCount({}); setMyLikes(new Set())
    }

    setLoading(false)
  }

  async function toggleLike(postId) {
    if (!user) { router.push('/login'); return }
    const liked = myLikes.has(postId)
    const nextCount = Math.max(0, (likeCount[postId] || 0) + (liked ? -1 : 1))
    setMyLikes(prev => { const n = new Set(prev); liked ? n.delete(postId) : n.add(postId); return n })
    setLikeCount(prev => ({ ...prev, [postId]: nextCount }))
    const { error } = liked
      ? await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      : await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    if (error) load(user)
  }

  async function sendViewerComment() {
    const text = viewerText.trim()
    if (!text || !viewer?.postId || viewerSending) return
    if (!user) { router.push('/login'); return }
    setViewerSending(true)
    try {
      const cbase = { post_id: viewer.postId, user_id: user.id, author_name: user.user_metadata?.name || '익명', content: text }
      let { data: c, error } = await supabase.from('comments').insert({ ...cbase, author_cat: profileMap[user.id] || getSavedProfileCat() }).select().single()
      if (error) { ({ data: c, error } = await supabase.from('comments').insert(cbase).select().single()) }
      if (error) { alert('댓글 등록에 실패했어요 🐾'); return }
      setPosts(prev => prev.map(p => p.id === viewer.postId ? { ...p, comments: [...(p.comments || []), c] } : p))
      setViewerText('')
    } finally {
      setViewerSending(false)
    }
  }

  // 비공개 기록 사진 목록 로드(본인) — 서명 URL로 미리보기
  async function openPicker() {
    setPickerOpen(true)
    if (myPhotos.length || pickerLoading || !user) return
    setPickerLoading(true)
    try {
      const { data: recs } = await supabase
        .from('class_records')
        .select('id, class_name, class_date, class_record_photos(storage_path)')
        .eq('user_id', user.id)
        .order('class_date', { ascending: false })
      const flat = []
      ;(recs || []).forEach(r => (r.class_record_photos || []).forEach(ph => flat.push({ storage_path: ph.storage_path, cls: r.class_name, date: r.class_date })))
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const withUrls = await Promise.all(flat.map(async f => {
        try {
          const res = await fetch(`/api/records/signed-url?path=${encodeURIComponent(f.storage_path)}`, { headers: { Authorization: `Bearer ${token}` } })
          const j = await res.json()
          return { ...f, url: j.url || null }
        } catch { return { ...f, url: null } }
      }))
      setMyPhotos(withUrls.filter(f => f.url))
    } finally {
      setPickerLoading(false)
    }
  }

  function togglePick(path) {
    setSelected(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n })
  }

  // 고른 비공개 사진을 공개 버킷에 재업로드 → 앨범 1글로 공개
  async function publishSelected() {
    if (!user || publishing) return
    const chosen = myPhotos.filter(p => selected.has(p.storage_path))
    if (!chosen.length) return
    setPublishing(true)
    try {
      const urls = []
      for (const p of chosen) {
        try {
          const blob = await (await fetch(p.url)).blob()
          const raw = (p.storage_path.split('.').pop() || 'jpg').toLowerCase()
          const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : 'jpg'
          const lpath = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
          const { error } = await supabase.storage.from('lounge-images').upload(lpath, blob, { contentType: blob.type || 'image/jpeg' })
          if (!error) { const { data } = supabase.storage.from('lounge-images').getPublicUrl(lpath); urls.push(data.publicUrl) }
        } catch {}
      }
      if (!urls.length) { alert('사진 공개에 실패했어요. 잠시 후 다시 시도해 주세요 🐾'); return }
      const isArtist = role === 'artist'
      const pbase = {
        title: isArtist ? '🖼️ 공개한 전시 기록' : '🎨 공개한 수업 기록',
        content: '',
        tag: isArtist ? 'exhibit' : 'class',
        author_id: user.id,
        author_name: user.user_metadata?.name || '익명',
        image_url: urls[0],
        images: urls,
      }
      let { error } = await supabase.from('posts').insert({ ...pbase, author_cat: profileCat })
      if (error) await supabase.from('posts').insert(pbase)
      setPickerOpen(false); setSelected(new Set())
      await load(user)
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <LoadingCat />

  const recordCount = posts.length
  const likeSum = posts.reduce((s, p) => s + (likeCount[p.id] || 0), 0)
  const isMe = user && user.id === targetId
  const farmer = FARM_CATS.find(c => c.key === farmCat) || FARM_CATS[0]
  const viewerPost = viewer ? posts.find(x => x.id === viewer.postId) : null

  return (
    <>
      {/* 상단바 */}
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span onClick={() => router.back()} style={{ fontSize:22, fontWeight:900, color:'var(--ac)', cursor:'pointer', lineHeight:1, marginTop:-2 }} title="뒤로">‹</span>
          <span className="p-title">프로필</span>
        </div>
      </div>

      <div style={{ background:'#fff', minHeight:'100vh', padding:'8px 0 90px' }}>

        {/* 프로필 헤더 */}
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px 10px' }}>
          <div style={{ width:74, height:74, borderRadius:'50%', background:ACCENT_BG, border:'3px solid var(--ac)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden', boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.2)' }}>
            <img src={pixelCatImg(profileCat)} alt="" width={54} height={54} style={{ imageRendering:'pixelated', display:'block' }} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:17, fontWeight:900, color:'var(--td)', letterSpacing:'-0.3px' }}>{name}</div>
            <div style={{ display:'flex', gap:16, marginTop:8 }}>
              <div><span style={{ fontSize:15, fontWeight:900, color:'var(--td)' }}>{recordCount}</span><span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)', marginLeft:4 }}>기록</span></div>
              <div><span style={{ fontSize:15, fontWeight:900, color:'var(--td)' }}>{likeSum}</span><span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)', marginLeft:4 }}>♥ 좋아요</span></div>
            </div>
          </div>
        </div>

        {/* 냥밭 상황 — 농부 고양이 + 수확 */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, margin:'0 16px 10px', background:ACCENT_BG, border:'2px solid rgb(var(--ac-rgb) / 0.22)', borderRadius:16, padding:'5px 12px 5px 6px' }}>
          <img src={farmer.img} alt="" width={30} height={30} style={{ imageRendering:'pixelated', display:'block' }} />
          <span style={{ fontSize:11, fontWeight:800, color:ACCENT_TEXT }}>냥밭 · {farmer.name}</span>
          <span style={{ width:1, height:12, background:'rgb(var(--ac-rgb) / 0.25)' }} />
          <span style={{ fontSize:11.5, fontWeight:900, color:'var(--td)' }}>🌾 수확 {harvestCount}개</span>
        </div>

        <div style={{ padding:'0 16px 12px', fontSize:10.5, fontWeight:700, color:'var(--tmu)', lineHeight:1.5 }}>
          🔒 라운지에 공유한 기록만 보여요{isMe ? ' · 아래 “사진 공개”로 비공개 기록도 올릴 수 있어요' : ''}
        </div>

        {/* 섹션 라벨 + (본인) 사진 공개 버튼 */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderTop:'2px dashed var(--g1)' }}>
          <span style={{ fontSize:12, fontWeight:900, color:ACCENT_TEXT }}>공유한 기록</span>
          <span style={{ fontSize:10, fontWeight:800, color:'var(--tmu)' }}>{recordCount}</span>
          {isMe && (
            <button onClick={openPicker}
              style={{ marginLeft:'auto', fontSize:10.5, fontWeight:900, color:'#fff', background:'var(--ac)', border:'none', borderRadius:16, padding:'5px 12px', cursor:'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'2px 2px 0 rgb(var(--ac-rgb) / 0.25)' }}>
              ＋ 사진 공개
            </button>
          )}
        </div>

        {/* 인스타 3열 그리드 */}
        {posts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--tmu)' }}>
            <img src={pixelCatImg('06-sleepy')} alt="" width={56} height={56} style={{ imageRendering:'pixelated', display:'inline-block', opacity:0.8 }} />
            <div style={{ fontSize:12.5, fontWeight:800, marginTop:10, color:'var(--tm)' }}>아직 공유한 기록이 없어요</div>
            <div style={{ fontSize:11, fontWeight:600, marginTop:4 }}>{isMe ? '“＋ 사진 공개”로 기록 사진을 올려보세요 🐾' : '라운지에 글을 올리면 여기 모여요 🐾'}</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:3, padding:'0 3px' }}>
            {posts.map(p => {
              const imgs = getImages(p)
              const has = imgs.length > 0
              return (
                <div key={p.id} onClick={() => setViewer({ images: imgs, idx: 0, postId: p.id })}
                  style={{ position:'relative', aspectRatio:'1', cursor:'pointer', overflow:'hidden', background: has ? '#eee' : ACCENT_BG }}>
                  {has ? (
                    <img src={imgs[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  ) : (
                    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'8px 9px', boxSizing:'border-box', fontSize:10.5, fontWeight:700, color:ACCENT_TEXT, lineHeight:1.4, overflow:'hidden', textAlign:'center' }}>
                      {(p.content || p.title || '').slice(0, 48) || '📝'}
                    </div>
                  )}
                  {imgs.length > 1 && (
                    <span style={{ position:'absolute', top:5, right:6, fontSize:12, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,0.5)' }}>🗂️</span>
                  )}
                  {(likeCount[p.id] || 0) > 0 && (
                    <span style={{ position:'absolute', bottom:5, left:6, fontSize:9.5, fontWeight:900, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,0.55)' }}>♥ {likeCount[p.id]}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 밝은 말풍선 상세뷰 — 사진 + 좋아요 + 귀여운 댓글 (바텀시트) */}
      {viewer && viewerPost && (
        <div onClick={() => setViewer(null)}
          style={{ position:'fixed', inset:0, background:'rgba(27,28,70,0.45)', zIndex:1200, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            onTouchStart={e => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={viewerSwipe}
            style={{ background:'#fff', border:'3px solid var(--ac)', borderBottom:'none', borderRadius:'28px 28px 0 0', maxHeight:'88vh', overflowY:'auto', maxWidth:390, width:'100%', margin:'0 auto', boxSizing:'border-box' }}>

            {/* 사진 or 글카드 */}
            <div style={{ position:'relative', background:'var(--bg)', borderRadius:'25px 25px 0 0', overflow:'hidden' }}>
              {viewer.images.length > 0 ? (
                <div style={{ width:'100%', maxHeight:'46vh', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <img src={viewer.images[viewer.idx]} alt="" style={{ maxWidth:'100%', maxHeight:'46vh', objectFit:'contain', display:'block' }} />
                </div>
              ) : (
                <div style={{ padding:'22px 18px', fontSize:13.5, fontWeight:600, color:'var(--td)', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                  {viewerPost.content || viewerPost.title || ''}
                </div>
              )}
              {viewer.images.length > 1 && (
                <>
                  <button onClick={() => setViewer(v => ({ ...v, idx:(v.idx-1+v.images.length)%v.images.length }))}
                    style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.35)', color:'#fff', border:'none', borderRadius:'50%', width:34, height:34, cursor:'pointer', fontSize:20, lineHeight:1 }}>‹</button>
                  <button onClick={() => setViewer(v => ({ ...v, idx:(v.idx+1)%v.images.length }))}
                    style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.35)', color:'#fff', border:'none', borderRadius:'50%', width:34, height:34, cursor:'pointer', fontSize:20, lineHeight:1 }}>›</button>
                  <div style={{ position:'absolute', bottom:8, left:0, right:0, display:'flex', gap:6, justifyContent:'center' }}>
                    {viewer.images.map((_, i) => (
                      <div key={i} onClick={() => setViewer(v => ({ ...v, idx:i }))}
                        style={{ width:7, height:7, borderRadius:'50%', background: i===viewer.idx ? '#fff' : 'rgba(255,255,255,0.5)', cursor:'pointer' }}/>
                    ))}
                  </div>
                </>
              )}
              <button onClick={() => setViewer(null)}
                style={{ position:'absolute', top:10, right:10, width:30, height:30, borderRadius:'50%', background:'rgba(0,0,0,0.4)', color:'#fff', border:'none', fontSize:13, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>

            {/* 작성자 + 좋아요 */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px 6px' }}>
              <span onClick={() => router.push(`/profile/${targetId}`)} style={{ cursor:'pointer', display:'flex' }}><CatAvatar catKey={profileCat} size={30} /></span>
              <span style={{ fontSize:12, fontWeight:900, color:'var(--td)' }}>{name}</span>
              <div onClick={() => toggleLike(viewer.postId)} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                <span style={{ fontSize:17, color: myLikes.has(viewer.postId) ? '#ff5a7a' : 'var(--tmu)' }}>{myLikes.has(viewer.postId) ? '♥' : '♡'}</span>
                <span style={{ fontSize:12.5, fontWeight:900, color:'var(--ac)' }}>{likeCount[viewer.postId] || 0}</span>
              </div>
            </div>

            {/* 캡션 */}
            {(viewerPost.content || viewerPost.title) && viewer.images.length > 0 && (
              <div style={{ padding:'0 14px 8px', fontSize:11.5, fontWeight:600, color:'var(--td)', lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {viewerPost.content || viewerPost.title}
              </div>
            )}

            {/* 댓글 말풍선 */}
            <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'8px 14px 10px', borderTop:'2px dashed var(--g1)' }}>
              {(viewerPost.comments || []).length === 0 && (
                <div style={{ fontSize:11, fontWeight:600, color:'var(--tmu)', textAlign:'center', padding:'6px 0' }}>첫 댓글을 남겨보세요 🐾</div>
              )}
              {(viewerPost.comments || []).map(c => {
                const mine = c.user_id && c.user_id === user?.id
                return (
                  <div key={c.id} style={{ display:'flex', gap:6, alignItems:'flex-end', flexDirection: mine ? 'row-reverse' : 'row' }}>
                    <span onClick={() => c.user_id && router.push(`/profile/${c.user_id}`)} style={{ cursor:'pointer', display:'flex' }}>
                      <CatAvatar catKey={c.author_cat || profileMap[c.user_id]} size={24} />
                    </span>
                    <div style={{ background: mine ? 'var(--ac)' : ACCENT_BG, border: mine ? 'none' : '2px solid rgb(var(--ac-rgb) / 0.3)', borderRadius:14, padding:'6px 10px', maxWidth:240, boxShadow: mine ? '2px 2px 0 rgb(var(--ac-rgb) / 0.25)' : 'none' }}>
                      {!mine && <span style={{ fontSize:9, fontWeight:900, color:ACCENT_TEXT, marginRight:5 }}>{c.author_name}</span>}
                      <span style={{ fontSize:11, color: mine ? '#fff' : 'var(--td)', fontWeight:600, lineHeight:1.4 }}>{c.content}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 귀여운 입력칸 */}
            <div style={{ display:'flex', gap:7, alignItems:'center', padding:'6px 12px 14px', position:'sticky', bottom:0, background:'#fff' }}>
              <input value={viewerText} onChange={e => setViewerText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendViewerComment() }}
                placeholder={user ? '귀엽게 댓글 남기기…' : '로그인하고 댓글 남기기…'}
                style={{ flex:1, minWidth:0, height:38, borderRadius:20, border:'2px solid rgb(var(--ac-rgb) / 0.3)', background:'var(--surf)', color:'var(--td)', padding:'0 14px', fontSize:11.5, fontWeight:600, outline:'none', fontFamily:'Nunito,sans-serif', boxSizing:'border-box' }}/>
              <button onClick={sendViewerComment} disabled={viewerSending || !viewerText.trim()}
                style={{ width:38, height:38, flexShrink:0, borderRadius:'50%', border:'none', color:'#fff', fontSize:14, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', background: viewerText.trim() ? 'var(--ac)' : 'rgb(var(--ac-rgb) / 0.35)', boxShadow: viewerText.trim() ? '2px 2px 0 rgb(var(--ac-rgb) / 0.25)' : 'none' }}>
                {viewerSending ? '…' : '➤'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비공개 기록 사진 공개하기 — 본인 전용 (바텀시트) */}
      {pickerOpen && (
        <div onClick={() => !publishing && setPickerOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(27,28,70,0.45)', zIndex:1300, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', border:'3px solid var(--ac)', borderBottom:'none', borderRadius:'28px 28px 0 0', maxHeight:'88vh', display:'flex', flexDirection:'column', maxWidth:390, width:'100%', margin:'0 auto', boxSizing:'border-box' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 16px 10px', borderBottom:'2px dashed var(--g1)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14.5, fontWeight:900, color:'var(--td)' }}>공개할 기록 사진 고르기 🐾</div>
                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--tmu)', marginTop:2 }}>고른 사진이 프로필에 공개돼요 · 이미 공개한 사진과 중복될 수 있어요</div>
              </div>
              <button onClick={() => !publishing && setPickerOpen(false)}
                style={{ width:30, height:30, borderRadius:'50%', border:'2px solid var(--g1)', background:'#fff', color:'var(--tmu)', fontWeight:900, fontSize:13, cursor:'pointer', flexShrink:0, padding:0 }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'10px 10px 6px' }}>
              {pickerLoading ? (
                <div style={{ textAlign:'center', padding:'34px 0', color:'var(--tmu)', fontSize:12, fontWeight:700 }}>사진 불러오는 중… 🐾</div>
              ) : myPhotos.length === 0 ? (
                <div style={{ textAlign:'center', padding:'34px 16px', color:'var(--tmu)', fontSize:12, fontWeight:700, lineHeight:1.7 }}>공개할 수 있는 기록 사진이 없어요<br/>기록에 사진을 먼저 남겨보세요 🐾</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:5 }}>
                  {myPhotos.map(ph => {
                    const on = selected.has(ph.storage_path)
                    return (
                      <div key={ph.storage_path} onClick={() => togglePick(ph.storage_path)}
                        style={{ position:'relative', aspectRatio:'1', borderRadius:12, overflow:'hidden', cursor:'pointer', border: on ? '3px solid var(--ac)' : '3px solid transparent', boxSizing:'border-box' }}>
                        <img src={ph.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                        <span style={{ position:'absolute', top:5, right:5, width:20, height:20, borderRadius:'50%', border:'2px solid #fff', background: on ? 'var(--ac)' : 'rgba(0,0,0,0.28)', color:'#fff', fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>{on ? '✓' : ''}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ padding:'10px 14px 16px', borderTop:'2px solid var(--g1)' }}>
              <button onClick={publishSelected} disabled={publishing || selected.size === 0}
                style={{ width:'100%', height:44, borderRadius:22, border:'none', color:'#fff', fontSize:13.5, fontWeight:900, cursor: selected.size ? 'pointer' : 'default', fontFamily:'Nunito,sans-serif', background: selected.size ? 'var(--ac)' : 'rgb(var(--ac-rgb) / 0.35)', boxShadow: selected.size ? '3px 3px 0 rgb(var(--ac-rgb) / 0.25)' : 'none' }}>
                {publishing ? '공개하는 중… 🐾' : selected.size ? `${selected.size}장 프로필에 공개하기` : '사진을 골라주세요'}
              </button>
            </div>
          </div>
        </div>
      )}

      {role === 'admin' ? (
        <nav className="bottom-nav">
          {[
            { href:'/admin', label:'홈', icon:'home' },
            { href:'/admin/notification', label:'알림', icon:'bell' },
            { href:'/lounge', label:'라운지', icon:'chat' },
          ].map(t => (
            <a key={t.label} href={t.href} className="nav-item">
              <NavIcon name={t.icon} />
              <span>{t.label}</span>
            </a>
          ))}
        </nav>
      ) : (
        <StudentNav active="" role={role === 'artist' ? 'artist' : 'student'} />
      )}
    </>
  )
}
