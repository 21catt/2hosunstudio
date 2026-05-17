'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

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
  const [carouselIdx, setCarouselIdx] = useState({})
  const fileRef = useRef()
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
      loadPosts()
    })
  }, [])

  async function loadPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, comments(*)')
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
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

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

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
        {/* 탭 */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--g1)', marginBottom:14, overflowX:'auto' }}>
          {TAGS.map((t,i) => (
            <div key={t} onClick={() => setTab(i)}
              style={{ flexShrink:0, textAlign:'center', padding:'9px 14px', fontSize:12, fontWeight:700,
                color:tab===i?'var(--g4)':'var(--tmu)', cursor:'pointer',
                borderBottom:tab===i?'2.5px solid var(--g4)':'2.5px solid transparent', marginBottom:-2 }}>
              {t}
            </div>
          ))}
        </div>

        {/* 게시글 목록 */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tmu)', fontSize:12 }}>게시글이 없어요 🐾</div>
        ) : filtered.map(p => {
          const isExp = expanded === p.id
          const tagStyle = TAG_COLORS[p.tag] || TAG_COLORS.etc
          const images = getImages(p)
          const idx = carouselIdx[p.id] || 0
          
          return (
            <div key={p.id} onClick={() => setExpanded(isExp?null:p.id)}
              style={{ background:'var(--surf)', borderRadius:16, border:`1.5px solid ${isExp?'var(--g3)':'var(--g1)'}`,
                marginBottom:10, overflow:'hidden', cursor:'pointer' }}>

              {/* 이미지: 접힌 상태는 첫 장만, 펼친 상태는 캐러셀 */}
              {images.length > 0 && !isExp && (
                <div style={{ position:'relative' }}>
                  <img src={images[0]} alt="" style={{ width:'100%', height:180, objectFit:'cover', display:'block' }}/>
                  {images.length > 1 && (
                    <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:12 }}>
                      📷 {images.length}
                    </div>
                  )}
                </div>
              )}
              
              {images.length > 0 && isExp && (
                <div style={{ position:'relative', background:'#000' }} onClick={e => e.stopPropagation()}>
                  <img src={images[idx]} alt="" style={{ width:'100%', maxHeight:360, objectFit:'contain', display:'block' }}/>
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setCarouselIdx(c => ({...c,[p.id]:(idx-1+images.length)%images.length}))}
                        style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', color:'#fff', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:16 }}>‹</button>
                      <button onClick={() => setCarouselIdx(c => ({...c,[p.id]:(idx+1)%images.length}))}
                        style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', color:'#fff', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:16 }}>›</button>
                      <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:12 }}>
                        {idx+1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div style={{ padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:8,
                    background:tagStyle.bg, color:tagStyle.color }}>
                    {TAGS[TAG_IDS.indexOf(p.tag)]}
                  </span>
                </div>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:4, lineHeight:1.4 }}>{p.title}</div>
                {!isExp && (
                  <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.5,
                    display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {p.content}
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--tm)' }}>{p.author_name}</span>
                    <span style={{ fontSize:10, color:'var(--tl)' }}>{p.created_at?.split('T')[0]}</span>
                  </div>
                  <div style={{ display:'flex', gap:10 }}>
                    <span style={{ fontSize:10, color:'var(--tmu)' }}>💬 {p.comments?.length||0}</span>
                    <span style={{ fontSize:10, color:'var(--tmu)' }}>❤️ {p.likes_count||0}</span>
                  </div>
                </div>
              </div>

              {/* 펼쳐진 상태 */}
              {isExp && (
  <div style={{ borderTop:'1px solid var(--g1)', padding:'12px 14px' }} onClick={e => e.stopPropagation()}>
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
    <div style={{ fontSize:12, color:'var(--td)', lineHeight:1.8, marginBottom:12, whiteSpace:'pre-wrap' }}>{p.content}</div>
                  {/* 댓글 */}
                  <div style={{ borderTop:'1px solid var(--g1)', paddingTop:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>댓글 {p.comments?.length||0}개</div>
                    {p.comments?.map(c => (
                      <div key={c.id} style={{ display:'flex', gap:8, marginBottom:8 }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--g2)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:10, fontWeight:800, color:'var(--g5)', flexShrink:0 }}>
                          {c.author_name?.[0]}
                        </div>
                        <div style={{ background:'var(--bg)', borderRadius:10, padding:'7px 10px', flex:1 }}>
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--tm)' }}>{c.author_name}</div>
                          <div style={{ fontSize:11, color:'var(--td)', lineHeight:1.5, marginTop:1 }}>{c.content}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:6, marginTop:8 }}>
                      <input value={comment} onChange={e => setComment(e.target.value)}
                        placeholder="댓글을 남겨보세요..."
                        onKeyDown={e => e.key==='Enter' && addComment(p.id)}
                        style={{ flex:1, background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:20,
                          padding:'7px 12px', fontSize:11, fontFamily:'Nunito,sans-serif', outline:'none', color:'var(--td)' }}/>
                      <button onClick={() => addComment(p.id)}
                        style={{ background:'var(--g4)', color:'#fff', border:'none', borderRadius:20,
                          padding:'7px 14px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        등록
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* 글쓰기 버튼 (관리자만) */}
        {role === 'admin' && (
          <button onClick={() => setShowWrite(true)}
            style={{ position:'fixed', bottom:76, right:'calc(50% - 185px)',
              display:'flex', alignItems:'center', gap:6, background:'var(--g4)', color:'#fff',
              border:'none', borderRadius:24, padding:'10px 16px', fontSize:12, fontWeight:700,
              cursor:'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'0 2px 8px rgba(61,139,80,0.3)' }}>
            ✏️ 글쓰기
          </button>
        )}
      </div>

      <nav className="bottom-nav">
        {[
          { href:role==='admin'?'/admin':'/student', label:'홈', icon:'🏠' },
          { href:role==='admin'?'/admin/notification':'/student/notification', label:'알림', icon:'🔔' },
          { href:'/lounge', label:'라운지', icon:'💬', active:true },
          { href:'/student/farm', label:'냥밭', icon:'🌱' },
        ].map(t => (
          <a key={t.label} href={t.href} className={`nav-item ${t.active?'active':''}`}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  )
}