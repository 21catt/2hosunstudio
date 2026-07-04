'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import StudentNav from '../../components/StudentNav'
import LoadingCat from '../../components/LoadingCat'
import { pixelCatImg, DEFAULT_PROFILE_CAT } from '../../lib/pixelCats'

// 작성자 프로필 고양이 아바타 (설정에서 고른 픽셀 고양이 얼굴)
function CatAvatar({ catKey, size = 36 }) {
  const s = Math.round(size * 0.78)
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'var(--acBg)', border:'2.5px solid var(--ac)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
      <img src={pixelCatImg(catKey || DEFAULT_PROFILE_CAT)} alt="" width={s} height={s} style={{ imageRendering:'pixelated', display:'block' }} />
    </div>
  )
}

export default function LoungePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('')
  const [tab, setTab] = useState(0)
  const [posts, setPosts] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [showWrite, setShowWrite] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newTag, setNewTag] = useState('notice')
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [uploading, setUploading] = useState(false)
  const [profileMap, setProfileMap] = useState({})   // {userId: profile_cat}
  const [likeCount, setLikeCount] = useState({})      // {postId: n}
  const [myLikes, setMyLikes] = useState(() => new Set())
  const [viewer, setViewer] = useState(null)          // { images, idx } — 이미지 크게 보기
  const fileRef = useRef()
  const touchX = useRef(null)
  function viewerSwipe(e) {
    if (touchX.current == null || !viewer || viewer.images.length < 2) return
    const delta = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(delta) < 50) return
    setViewer(v => ({ ...v, idx: delta < 0 ? (v.idx+1)%v.images.length : (v.idx-1+v.images.length)%v.images.length }))
  }
const [editingId, setEditingId] = useState(null)
const [existingImages, setExistingImages] = useState([])
  const TAGS = ['전체','공지','행사','수업','기타']
  const TAG_IDS = ['all','notice','event','class','etc']
  const TAG_COLORS = {
    notice:{bg:'var(--g1)',color:'var(--g5)'},
    event:{bg:'#FFF3E0',color:'#E65100'},
    class:{bg:'#EDE7F6',color:'#4A148C'},
    etc:{bg:'#F3F3F0',color:'#5a5a50'},
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      setRole(data.user.user_metadata?.role || 'student')
      loadPosts(data.user.id)
    })
  }, [])

  async function loadPosts(uid = user?.id) {
    const { data } = await supabase
      .from('posts')
      .select('*, comments(*)')
      .order('created_at', { ascending: false })
    const list = data || []
    setPosts(list)

    // 글·댓글 작성자들의 프로필 고양이 조회 → 아바타 표시
    const ids = new Set()
    list.forEach(p => { if (p.author_id) ids.add(p.author_id); (p.comments || []).forEach(c => c.user_id && ids.add(c.user_id)) })
    if (ids.size > 0) {
      const { data: prefs } = await supabase.from('user_prefs').select('user_id, profile_cat').in('user_id', [...ids])
      const pm = {}
      ;(prefs || []).forEach(pr => { if (pr.profile_cat) pm[pr.user_id] = pr.profile_cat })
      setProfileMap(pm)
    }

    // 공감(하트): 전체 likes → 게시글별 카운트 + 내 공감 집합
    const { data: likes } = await supabase.from('likes').select('post_id, user_id')
    const cnt = {}
    const mine = new Set()
    ;(likes || []).forEach(l => { cnt[l.post_id] = (cnt[l.post_id] || 0) + 1; if (l.user_id === uid) mine.add(l.post_id) })
    setLikeCount(cnt)
    setMyLikes(mine)

    setLoading(false)
  }

  // 하트 공감 토글 — likes 테이블(1인 1공감)이 단일 소스, 낙관적 갱신.
  // (posts.likes_count는 남의 글에 UPDATE 불가할 수 있어 건드리지 않음)
  async function toggleLike(postId) {
    if (!user) return
    const liked = myLikes.has(postId)
    const nextCount = Math.max(0, (likeCount[postId] || 0) + (liked ? -1 : 1))
    setMyLikes(prev => { const n = new Set(prev); liked ? n.delete(postId) : n.add(postId); return n })
    setLikeCount(prev => ({ ...prev, [postId]: nextCount }))
    const { error } = liked
      ? await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      : await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    if (error) loadPosts() // 실패 시 서버 상태로 되돌림
  }

  function handleImageSelect(e) {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    const total = imageFiles.length + files.length
    if (total > 10) { alert('이미지는 최대 10장까지 올릴 수 있어요'); return }
    setImageFiles(prev => [...prev, ...files])
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  function removeImage(idx) {
    setImageFiles(prev => prev.filter((_,i) => i !== idx))
    setImagePreviews(prev => prev.filter((_,i) => i !== idx))
  }

  async function uploadImages() {
    if (imageFiles.length === 0) return []
    const urls = []
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
      const { error } = await supabase.storage.from('lounge-images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('lounge-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }
    return urls
  }

  async function writePost() {
  if (!newTitle.trim() || !newBody.trim()) return
  setUploading(true)
  const newUrls = await uploadImages()
  const allUrls = [...existingImages, ...newUrls]
  
  if (editingId) {
    // 수정
    await supabase.from('posts').update({
      title: newTitle,
      content: newBody,
      tag: newTag,
      image_url: allUrls[0] || null,
      images: allUrls,
    }).eq('id', editingId)
  } else {
    // 새 글
    await supabase.from('posts').insert({
      title: newTitle,
      content: newBody,
      tag: newTag,
      author_id: user.id,
      author_name: user.user_metadata?.name || '익명',
      image_url: allUrls[0] || null,
      images: allUrls,
    })
  }
  
  setNewTitle(''); setNewBody(''); setImageFiles([]); setImagePreviews([])
  setExistingImages([]); setEditingId(null)
  setShowWrite(false); setUploading(false)
  loadPosts()
}
function startEdit(p) {
  setEditingId(p.id)
  setNewTitle(p.title)
  setNewBody(p.content)
  setNewTag(p.tag)
  setExistingImages(getImages(p))
  setImageFiles([])
  setImagePreviews([])
  setShowWrite(true)
}

async function deletePost(postId) {
  if (!confirm('정말 삭제할까요?')) return
  await supabase.from('posts').delete().eq('id', postId)
  setExpanded(null)
  loadPosts()
}

function removeExistingImage(idx) {
  setExistingImages(prev => prev.filter((_,i) => i !== idx))
}

  async function addComment(postId) {
    if (!comment.trim()) return
    await supabase.from('comments').insert({
      post_id: postId, user_id: user.id,
      content: comment, author_name: user.user_metadata?.name || '익명'
    })
    setComment('')
    loadPosts()
  }

  // 이미지 배열로 통일 (이전 데이터 호환)
  function getImages(p) {
    if (p.images && p.images.length > 0) return p.images
    if (p.image_url) return [p.image_url]
    return []
  }

  const filtered = tab === 0 ? posts : posts.filter(p => p.tag === TAG_IDS[tab])

  if (loading) return <LoadingCat />

  if (showWrite) return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => { setShowWrite(false); setImageFiles([]); setImagePreviews([]); setExistingImages([]); setEditingId(null) }}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'#fff', fontSize:18 }}>‹</button>
          <span className="header-title">{editingId ? '글 수정' : '글쓰기'}</span>
        </div>
        <button onClick={writePost} disabled={uploading||!newTitle||!newBody}
          style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:20, padding:'4px 14px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', opacity:uploading?0.6:1 }}>
          {uploading ? '올리는 중...' : '등록'}
        </button>
      </div>
      <div className="page-body">
        <div className="field">
          <label>태그</label>
          <select value={newTag} onChange={e => setNewTag(e.target.value)}>
            <option value="notice">공지</option>
            <option value="event">행사</option>
            <option value="class">수업</option>
            <option value="etc">기타</option>
          </select>
        </div>
        <div className="field">
          <label>제목</label>
          <input placeholder="제목을 입력해 주세요" value={newTitle} onChange={e => setNewTitle(e.target.value)}/>
        </div>
        <div className="field">
          <label>내용</label>
          <textarea placeholder="내용을 입력해 주세요" value={newBody} onChange={e => setNewBody(e.target.value)}
            style={{ width:'100%', minHeight:160, background:'var(--surf)', border:'1.5px solid var(--g1)', borderRadius:12, padding:'11px 14px', fontSize:13, fontFamily:'Nunito,sans-serif', color:'var(--td)', outline:'none', resize:'vertical' }}/>
        </div>

        {/* 이미지 업로드 (여러 장) */}
        <div className="field">
          <label>이미지 첨부 (최대 10장)</label>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={handleImageSelect}/>
          {existingImages.length > 0 && (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
    {existingImages.map((src,i) => (
      <div key={`ex-${i}`} style={{ position:'relative', aspectRatio:'1/1', borderRadius:10, overflow:'hidden', background:'var(--bg)' }}>
        <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        <button onClick={() => removeExistingImage(i)}
          style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:'50%', width:22, height:22, cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        <div style={{ position:'absolute', bottom:4, left:4, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:6 }}>기존</div>
      </div>
    ))}
  </div>
)}
          {imagePreviews.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
              {imagePreviews.map((src,i) => (
                <div key={i} style={{ position:'relative', aspectRatio:'1/1', borderRadius:10, overflow:'hidden', background:'var(--bg)' }}>
                  <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  <button onClick={() => removeImage(i)}
                    style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:'50%', width:22, height:22, cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  {i === 0 && (
                    <div style={{ position:'absolute', bottom:4, left:4, background:'var(--g4)', color:'#fff', fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:6 }}>대표</div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div onClick={() => fileRef.current.click()}
            style={{ border:'1.5px dashed var(--g2)', borderRadius:12, padding:'18px', textAlign:'center', cursor:'pointer', background:'var(--bg)' }}>
            <div style={{ fontSize:24, marginBottom:4 }}>📷</div>
            <div style={{ fontSize:11, color:'var(--tmu)', fontWeight:600 }}>
              {imagePreviews.length > 0 ? '이미지 추가' : '클릭해서 이미지 선택'}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>💬</span>
          <span className="header-title">라운지</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 14px 80px' }}>
        <style>{`
          @keyframes heartPop { 0%{transform:scale(1)} 35%{transform:scale(1.45)} 60%{transform:scale(0.9)} 100%{transform:scale(1)} }
          .heart-pop { animation: heartPop 0.4s ease; display:inline-block; }
        `}</style>
        {/* 탭 — 알약 칩 */}
        <div className="no-scrollbar" style={{ display:'flex', gap:7, marginBottom:16, overflowX:'auto', paddingBottom:2 }}>
          {TAGS.map((t,i) => {
            const on = tab === i
            return (
              <button key={t} onClick={() => setTab(i)}
                style={{ flexShrink:0, padding:'8px 16px', borderRadius:22, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif',
                  border:`2.5px solid ${on ? 'var(--ac)' : 'rgb(var(--ac-rgb) / 0.25)'}`, background: on ? 'var(--ac)' : 'var(--surf)', color: on ? '#fff' : 'var(--tm)',
                  boxShadow: on ? '2px 2px 0 rgb(var(--ac-rgb) / 0.25)' : 'none', transition:'all 0.15s' }}>
                {t}
              </button>
            )
          })}
        </div>

        {/* 게시글 목록 */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--tmu)', fontSize:13, lineHeight:1.8 }}>
            <div style={{ fontSize:34, marginBottom:6 }}>🐱</div>
            아직 글이 없어요<br/>
            <span style={{ fontSize:11 }}>첫 소식을 남겨보세요 🐾</span>
          </div>
        ) : filtered.map(p => {
          const isExp = expanded === p.id
          const tagStyle = TAG_COLORS[p.tag] || TAG_COLORS.etc
          const images = getImages(p)
          const liked = myLikes.has(p.id)
          const likeN = likeCount[p.id] ?? (p.likes_count || 0)

          return (
            <div key={p.id} onClick={() => setExpanded(isExp?null:p.id)}
              style={{ background:'var(--surf)', borderRadius:26, border:`3px solid ${isExp?'var(--ac)':'rgb(var(--ac-rgb) / 0.3)'}`,
                marginBottom:14, overflow:'hidden', cursor:'pointer', boxShadow: isExp ? '4px 4px 0 rgb(var(--ac-rgb) / 0.25)' : '3px 3px 0 rgb(var(--ac-rgb) / 0.12)', transition:'border-color 0.15s, box-shadow 0.15s' }}>

              {/* 작성자 헤더 — 프로필 고양이 아바타 */}
              <div style={{ display:'flex', alignItems:'center', gap:9, padding:'12px 14px 10px' }}>
                <CatAvatar catKey={profileMap[p.author_id]} size={38} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:800, color:'var(--td)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.author_name}</div>
                  <div style={{ fontSize:10, color:'var(--tl)' }}>{p.created_at?.split('T')[0]}</div>
                </div>
                <span style={{ fontSize:9, fontWeight:900, padding:'4px 10px', borderRadius:12, background:tagStyle.bg, color:tagStyle.color, flexShrink:0 }}>
                  {TAGS[TAG_IDS.indexOf(p.tag)]}
                </span>
              </div>

              {/* 본문 */}
              <div style={{ padding:'11px 14px 13px' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:4, lineHeight:1.4 }}>{p.title}</div>
                {!isExp ? (
                  <div style={{ fontSize:11.5, color:'var(--tmu)', lineHeight:1.55,
                    display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {p.content}
                  </div>
                ) : (
                  <div style={{ fontSize:12.5, color:'var(--td)', lineHeight:1.8, whiteSpace:'pre-wrap', marginTop:2 }}>{p.content}</div>
                )}

                {/* 이미지 첨부 — 작은 썸네일, 누르면 크게 보기 */}
                {images.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }} onClick={e => e.stopPropagation()}>
                    {(isExp ? images : images.slice(0, 4)).map((src, i) => {
                      const hiddenMore = !isExp && i === 3 && images.length > 4
                      return (
                        <div key={i} onClick={() => setViewer({ images, idx: i })}
                          style={{ position:'relative', width:60, height:60, borderRadius:14, overflow:'hidden', cursor:'pointer',
                            border:'2.5px solid rgb(var(--ac-rgb) / 0.3)', background:'var(--acBg)', flexShrink:0 }}>
                          <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                          {hiddenMore && (
                            <div style={{ position:'absolute', inset:0, background:'rgba(27,28,70,0.55)', color:'#fff', fontSize:13, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              +{images.length - 4}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <span style={{ alignSelf:'center', fontSize:10, color:'var(--tl)', fontWeight:700 }}>📷 {images.length}장 · 눌러서 보기</span>
                  </div>
                )}

                {/* 액션 — 하트 공감 + 댓글 */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:11 }}>
                  <button onClick={(e) => { e.stopPropagation(); toggleLike(p.id) }} title="공감"
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 15px', borderRadius:22, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:12.5,
                      border:`2.5px solid ${liked ? '#FF8FB1' : 'rgb(var(--ac-rgb) / 0.3)'}`, background: liked ? '#FF8FB1' : 'var(--surf)', color: liked ? '#fff' : 'var(--tm)',
                      boxShadow: liked ? '2px 2px 0 rgba(255,143,177,0.4)' : 'none', transition:'all 0.15s' }}>
                    <span key={liked ? 'on' : 'off'} className={liked ? 'heart-pop' : ''} style={{ fontSize:13, lineHeight:1 }}>{liked ? '❤️' : '🤍'}</span>
                    <span style={{ fontVariantNumeric:'tabular-nums' }}>{likeN}</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setExpanded(isExp?null:p.id) }}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 15px', borderRadius:22, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:12.5,
                      border:`2.5px solid rgb(var(--ac-rgb) / 0.3)`, background: isExp ? 'var(--acBg)' : 'var(--surf)', color:'var(--tm)' }}>
                    💬 <span style={{ fontVariantNumeric:'tabular-nums' }}>{p.comments?.length||0}</span>
                  </button>
                </div>
              </div>

              {/* 펼쳐진 상태 — 수정/삭제 + 댓글 */}
              {isExp && (
                <div style={{ borderTop:'2px dashed rgb(var(--ac-rgb) / 0.25)', padding:'12px 14px' }} onClick={e => e.stopPropagation()}>
                  {(role === 'admin' || p.author_id === user?.id) && (
                    <div style={{ display:'flex', gap:6, marginBottom:10, justifyContent:'flex-end' }}>
                      <button onClick={() => startEdit(p)}
                        style={{ background:'var(--g1)', color:'var(--g5)', border:'none', borderRadius:8, padding:'5px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        수정
                      </button>
                      <button onClick={() => deletePost(p.id)}
                        style={{ background:'#ffebee', color:'#c0392b', border:'none', borderRadius:8, padding:'5px 12px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        삭제
                      </button>
                    </div>
                  )}
                  {/* 댓글 */}
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:10 }}>댓글 {p.comments?.length||0}개</div>
                  {p.comments?.map(c => (
                    <div key={c.id} style={{ display:'flex', gap:8, marginBottom:9 }}>
                      <CatAvatar catKey={profileMap[c.user_id]} size={30} />
                      <div style={{ background:'var(--acBg)', border:'2.5px solid rgb(var(--ac-rgb) / 0.35)', borderRadius:'18px 18px 18px 6px', padding:'8px 12px', maxWidth:'82%', minWidth:0 }}>
                        <div style={{ fontSize:10, fontWeight:900, color:'var(--acTx)' }}>{c.author_name}</div>
                        <div style={{ fontSize:12, color:'var(--td)', fontWeight:600, lineHeight:1.5, marginTop:1, whiteSpace:'pre-wrap' }}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:6, marginTop:10 }}>
                    <input value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="댓글을 남겨보세요…"
                      onKeyDown={e => e.key==='Enter' && addComment(p.id)}
                      style={{ flex:1, background:'var(--surf)', border:'2.5px solid rgb(var(--ac-rgb) / 0.35)', borderRadius:22,
                        padding:'9px 14px', fontSize:12, fontWeight:600, fontFamily:'Nunito,sans-serif', outline:'none', color:'var(--td)' }}/>
                    <button onClick={() => addComment(p.id)}
                      style={{ width:40, height:40, flexShrink:0, background:'var(--ac)', color:'#fff', border:'none', borderRadius:'50%',
                        fontSize:14, cursor:'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'2px 2px 0 rgb(var(--ac-rgb) / 0.3)' }}>
                      ➤
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* 글쓰기 버튼 (관리자만) */}
        
          <button onClick={() => setShowWrite(true)} title="글쓰기"
            style={{ position:'fixed', bottom:78, right:'calc(50% - 180px)',
              width:56, height:56, borderRadius:'50%', background:'var(--ac2)', color:'var(--td)',
              border:'3px solid var(--ac)', fontSize:22, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'4px 4px 0 rgb(var(--ac-rgb) / 0.3)', zIndex:90 }}>
            ✏️
          </button>
       
      </div>

     {/* 이미지 크게 보기 — 라이트박스 */}
     {viewer && (
       <div onClick={() => setViewer(null)}
         onTouchStart={e => { touchX.current = e.touches[0].clientX }}
         onTouchEnd={viewerSwipe}
         style={{ position:'fixed', inset:0, background:'rgba(10,11,35,0.93)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:'46px 12px 40px' }}>
         <img src={viewer.images[viewer.idx]} alt="" onClick={e => e.stopPropagation()}
           style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:18, display:'block' }}/>
         <button onClick={() => setViewer(null)}
           style={{ position:'absolute', top:14, right:14, width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', fontSize:17, cursor:'pointer', lineHeight:1 }}>✕</button>
         {viewer.images.length > 1 && (
           <>
             <button onClick={e => { e.stopPropagation(); setViewer(v => ({ ...v, idx:(v.idx-1+v.images.length)%v.images.length })) }}
               style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>‹</button>
             <button onClick={e => { e.stopPropagation(); setViewer(v => ({ ...v, idx:(v.idx+1)%v.images.length })) }}
               style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>›</button>
             <div style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', display:'flex', gap:7 }} onClick={e => e.stopPropagation()}>
               {viewer.images.map((_, i) => (
                 <div key={i} onClick={() => setViewer(v => ({ ...v, idx:i }))}
                   style={{ width:9, height:9, borderRadius:'50%', background: i===viewer.idx ? '#fff' : 'rgba(255,255,255,0.4)', cursor:'pointer' }}/>
               ))}
             </div>
           </>
         )}
       </div>
     )}

     {(role === 'admin' || role === 'artist') ? (
     <nav className="bottom-nav">
  {[
    { href: role==='admin'?'/admin':role==='artist'?'/artist':'/student', label:'홈', icon:'🏠' },
    ...(role === 'artist' ? [] : [{ href: role==='admin'?'/admin/notification':'/student/notification', label:'알림', icon:'🔔' }]),
    { href:'/lounge', label:'라운지', icon:'💬', active:true },
    ...(role === 'artist' ? [] : [{ href:'/student/farm', label:'냥밭', icon:'🌱' }]),
  ].map(t => (
    <a key={t.label} href={t.href} className={`nav-item ${t.active?'active':''}`}>
      <span style={{ fontSize:20 }}>{t.icon}</span>
      <span>{t.label}</span>
    </a>
  ))}
</nav>
     ) : (
     <StudentNav active="lounge" />
     )}
    </>
  )
}