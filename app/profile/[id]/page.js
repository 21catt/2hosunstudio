'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import LoadingCat from '../../../components/LoadingCat'
import { pixelCatImg, DEFAULT_PROFILE_CAT, getSavedProfileCat, isValidPixelCat } from '../../../lib/pixelCats'

// 인스타형 개인 프로필 — 그 사람이 "라운지 공유 ON"으로 올린 글(posts)만 그리드로 보여준다.
// 공유 OFF 기록은 애초에 posts에 없어서 여기 안 뜬다(= 공유 토글이 노출 게이트).
// 색·말풍선·픽셀 고양이 전부 라운지와 동일 컨셉을 재사용.
const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'

function catOf(key) { return isValidPixelCat(key) ? key : DEFAULT_PROFILE_CAT }

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
  const [likeCount, setLikeCount] = useState({})   // {postId: n}
  const [myLikes, setMyLikes] = useState(() => new Set())
  const [profileMap, setProfileMap] = useState({}) // {userId: profile_cat} — 댓글 아바타용
  const [viewer, setViewer] = useState(null)       // { images, idx, postId }
  const [viewerText, setViewerText] = useState('')
  const [viewerSending, setViewerSending] = useState(false)

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

    // 프로필 고양이 + 이름
    const { data: pref } = await supabase.from('user_prefs').select('profile_cat').eq('user_id', targetId).single()
    setProfileCat(catOf(pref?.profile_cat || list[0]?.author_cat))
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

  if (loading) return <LoadingCat />

  const recordCount = posts.length
  const likeSum = posts.reduce((s, p) => s + (likeCount[p.id] || 0), 0)
  const isMe = user && user.id === targetId

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
        <div style={{ padding:'0 16px 12px', fontSize:10.5, fontWeight:700, color:'var(--tmu)', lineHeight:1.5 }}>
          🔒 라운지에 공유한 기록만 보여요{isMe ? ' · 공유 ON으로 올리면 여기 쌓여요' : ''}
        </div>

        {/* 섹션 라벨 */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderTop:'2px dashed var(--g1)' }}>
          <span style={{ fontSize:12, fontWeight:900, color:ACCENT_TEXT }}>공유한 기록</span>
          <span style={{ fontSize:10, fontWeight:800, color:'var(--tmu)' }}>{recordCount}</span>
        </div>

        {/* 인스타 3열 그리드 */}
        {posts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--tmu)' }}>
            <img src={pixelCatImg('06-sleepy')} alt="" width={56} height={56} style={{ imageRendering:'pixelated', display:'inline-block', opacity:0.8 }} />
            <div style={{ fontSize:12.5, fontWeight:800, marginTop:10, color:'var(--tm)' }}>아직 공유한 기록이 없어요</div>
            <div style={{ fontSize:11, fontWeight:600, marginTop:4 }}>{isMe ? '기록 저장 시 "라운지 공유 ON"으로 올려보세요 🐾' : '라운지에 글을 올리면 여기 모여요 🐾'}</div>
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

      {/* 라이트박스 — 사진 크게 보기 + 좋아요 + 댓글 (라운지와 동일 컨셉) */}
      {viewer && (
        <div onClick={() => setViewer(null)}
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={viewerSwipe}
          style={{ position:'fixed', inset:0, background:'rgba(10,11,35,0.93)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:'46px 12px 170px' }}>
          {viewer.images.length > 0 ? (
            <img src={viewer.images[viewer.idx]} alt="" onClick={e => e.stopPropagation()}
              style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:18, display:'block' }} />
          ) : (
            <div onClick={e => e.stopPropagation()}
              style={{ maxWidth:320, background:'rgba(255,255,255,0.1)', border:'2px solid rgba(255,255,255,0.25)', borderRadius:18, padding:'22px 20px', color:'#fff', fontSize:14, fontWeight:600, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
              {posts.find(x => x.id === viewer.postId)?.content || ''}
            </div>
          )}
          <button onClick={() => setViewer(null)}
            style={{ position:'absolute', top:14, right:14, width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', fontSize:17, cursor:'pointer', lineHeight:1 }}>✕</button>
          {viewer.images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setViewer(v => ({ ...v, idx:(v.idx-1+v.images.length)%v.images.length })) }}
                style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setViewer(v => ({ ...v, idx:(v.idx+1)%v.images.length })) }}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>›</button>
            </>
          )}

          <div onClick={e => e.stopPropagation()}
            style={{ position:'absolute', left:0, right:0, bottom:0, maxWidth:390, margin:'0 auto', padding:'22px 14px 16px', boxSizing:'border-box', display:'flex', flexDirection:'column', gap:8, background:'linear-gradient(to top, rgba(10,11,35,0.97) 65%, rgba(10,11,35,0))' }}>
            {viewer.images.length > 1 && (
              <div style={{ display:'flex', gap:7, justifyContent:'center' }}>
                {viewer.images.map((_, i) => (
                  <div key={i} onClick={() => setViewer(v => ({ ...v, idx:i }))}
                    style={{ width:9, height:9, borderRadius:'50%', background: i===viewer.idx ? '#fff' : 'rgba(255,255,255,0.4)', cursor:'pointer' }}/>
                ))}
              </div>
            )}
            {/* 좋아요 */}
            <div onClick={() => toggleLike(viewer.postId)} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', alignSelf:'flex-start' }}>
              <span style={{ fontSize:17, color: myLikes.has(viewer.postId) ? '#ff5a7a' : 'rgba(255,255,255,0.85)' }}>{myLikes.has(viewer.postId) ? '♥' : '♡'}</span>
              <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{likeCount[viewer.postId] || 0}</span>
            </div>
            {(() => {
              const cs = posts.find(x => x.id === viewer.postId)?.comments || []
              return cs.length > 0 && (
                <div className="no-scrollbar" style={{ maxHeight:110, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
                  {cs.map(c => (
                    <div key={c.id} style={{ fontSize:11.5, color:'#fff', lineHeight:1.5, wordBreak:'break-word' }}>
                      <span onClick={() => c.user_id && router.push(`/profile/${c.user_id}`)} style={{ fontWeight:900, color:'rgba(255,255,255,0.72)', marginRight:6, cursor:'pointer' }}>{c.author_name}</span>
                      <span style={{ fontWeight:600 }}>{c.content}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ display:'flex', gap:7, alignItems:'center' }}>
              <input className="viewer-input" value={viewerText} onChange={e => setViewerText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendViewerComment() }}
                placeholder={user ? '귀엽게 댓글 남기기…' : '로그인하고 댓글 남기기…'}
                style={{ flex:1, minWidth:0, height:38, borderRadius:20, border:'2px solid rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.14)', color:'#fff', padding:'0 14px', fontSize:12, fontWeight:600, outline:'none', fontFamily:'Nunito,sans-serif', boxSizing:'border-box' }}/>
              <button onClick={sendViewerComment} disabled={viewerSending || !viewerText.trim()}
                style={{ width:38, height:38, flexShrink:0, borderRadius:'50%', border:'none', color:'#fff', fontSize:13, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', background: viewerText.trim() ? 'var(--ac)' : 'rgba(255,255,255,0.22)' }}>
                {viewerSending ? '…' : '➤'}
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
