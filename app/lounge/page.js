'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import StudentNav from '../../components/StudentNav'
import { NavIcon } from '../../components/NavIcons'
import LoadingCat from '../../components/LoadingCat'
import { pixelCatImg, DEFAULT_PROFILE_CAT } from '../../lib/pixelCats'

// 카톡형 라운지 — 누구나 하단 입력바에서 바로 쓰고 보내는 단체 채팅 스타일.
// 내 메시지는 오른쪽 테마색 말풍선, 다른 사람은 왼쪽(프로필 고양이 + 이름).
// 색은 전부 --ac 계열 변수 → 개인설정 4가지 컬러모드를 따라간다.
const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'

function CatAvatar({ catKey, size = 36 }) {
  const s = Math.round(size * 0.72)
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:ACCENT_BG, border:'2.5px solid var(--ac)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
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
  const [loading, setLoading] = useState(true)
  const [profileMap, setProfileMap] = useState({})   // {userId: profile_cat}
  const [likeCount, setLikeCount] = useState({})      // {postId: n}
  const [myLikes, setMyLikes] = useState(() => new Set())
  const [viewer, setViewer] = useState(null)          // { images, idx, postId } — 이미지 크게 보기 + 댓글
  const [viewerText, setViewerText] = useState('')    // 라이트박스 댓글 입력
  const [viewerSending, setViewerSending] = useState(false)
  const [editPost, setEditPost] = useState(null)      // { id, text } — 게시글 내용 수정 중
  const [editSaving, setEditSaving] = useState(false)
  const [catMenu, setCatMenu] = useState(null)        // 카테고리 변경 중인 글 (바텀시트)
  const [catBusy, setCatBusy] = useState(false)
  const [lastAddedId, setLastAddedId] = useState(null)

  // 카톡식 입력바
  const [composeText, setComposeText] = useState('')
  const [composeFiles, setComposeFiles] = useState([])
  const [composePreviews, setComposePreviews] = useState([])
  const [sending, setSending] = useState(false)

  const touchX = useRef(null)
  function viewerSwipe(e) {
    if (touchX.current == null || !viewer || viewer.images.length < 2) return
    const delta = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(delta) < 50) return
    setViewer(v => ({ ...v, idx: delta < 0 ? (v.idx+1)%v.images.length : (v.idx-1+v.images.length)%v.images.length }))
  }

  const TAGS = ['전체','공지','행사','수업','기타']
  const TAG_IDS = ['all','notice','event','class','etc']
  const TAG_COLORS = {
    notice:{bg:'var(--acBg)',color:'var(--acTx)'},
    event:{bg:'#FFF3E0',color:'#E65100'},
    class:{bg:'#EDE7F6',color:'#4A148C'},
    etc:{bg:'#F3F3F0',color:'#5a5a50'},
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      // 비로그인도 열람 가능 — 글쓰기·공감·댓글은 로그인 유도
      setUser(data.user || null)
      setRole(data.user?.user_metadata?.role || 'student')
      loadPosts(data.user?.id || null)
    })
  }, [])

  useEffect(() => {
    if (loading) return
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 120)
  }, [loading, tab])

  async function loadPosts(uid = user?.id) {
    const { data } = await supabase
      .from('posts')
      .select('*, comments(*)')
      .order('created_at', { ascending: true })
    const list = data || []
    setPosts(list)

    const ids = new Set()
    if (uid) ids.add(uid) // 내 프로필 고양이도 항상 로드 (내 글 오른쪽 아바타)
    list.forEach(p => { if (p.author_id) ids.add(p.author_id); (p.comments || []).forEach(c => c.user_id && ids.add(c.user_id)) })
    if (ids.size > 0) {
      const { data: prefs } = await supabase.from('user_prefs').select('user_id, profile_cat').in('user_id', [...ids])
      const pm = {}
      ;(prefs || []).forEach(pr => { if (pr.profile_cat) pm[pr.user_id] = pr.profile_cat })
      setProfileMap(pm)
    }

    const { data: likes } = await supabase.from('likes').select('post_id, user_id')
    const cnt = {}
    const mine = new Set()
    ;(likes || []).forEach(l => { cnt[l.post_id] = (cnt[l.post_id] || 0) + 1; if (l.user_id === uid) mine.add(l.post_id) })
    setLikeCount(cnt)
    setMyLikes(mine)

    setLoading(false)
  }

  // 하트 공감 토글 — likes 테이블(1인 1공감)이 단일 소스, 낙관적 갱신
  async function toggleLike(postId) {
    if (!user) { router.push('/login'); return }
    const liked = myLikes.has(postId)
    const nextCount = Math.max(0, (likeCount[postId] || 0) + (liked ? -1 : 1))
    setMyLikes(prev => { const n = new Set(prev); liked ? n.delete(postId) : n.add(postId); return n })
    setLikeCount(prev => ({ ...prev, [postId]: nextCount }))
    const { error } = liked
      ? await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      : await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    if (error) loadPosts()
  }

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

  // 전송 — 현재 탭 카테고리로 바로 올린다 (전체→기타, 공지는 관리자만 공지로)
  async function handleSend() {
    const text = composeText.trim()
    if (!user || sending || (!text && composeFiles.length === 0)) return
    setSending(true)
    try {
      let tag = TAG_IDS[tab] === 'all' ? 'etc' : TAG_IDS[tab]
      if (tag === 'notice' && role !== 'admin') tag = 'etc'

      const urls = []
      for (const file of composeFiles) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
        const { error } = await supabase.storage.from('lounge-images').upload(path, file)
        if (!error) {
          const { data } = supabase.storage.from('lounge-images').getPublicUrl(path)
          urls.push(data.publicUrl)
        }
      }

      const { data: post } = await supabase.from('posts').insert({
        title: '',
        content: text || '',
        tag,
        author_id: user.id,
        author_name: user.user_metadata?.name || '익명',
        image_url: urls[0] || null,
        images: urls,
      }).select().single()

      if (post) {
        setPosts(prev => [...prev, { ...post, comments: [] }])
        setLastAddedId(post.id)
      }
      setComposeText('')
      composePreviews.forEach(u => URL.revokeObjectURL(u))
      setComposeFiles([]); setComposePreviews([])
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }), 60)
    } finally {
      setSending(false)
    }
  }

  async function deletePost(postId) {
    if (!confirm('이 메시지를 삭제할까요?')) return
    await supabase.from('posts').delete().eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  // 게시글 내용 수정 저장 — 작성자 본인 또는 관리자
  async function saveEdit() {
    if (!editPost || editSaving) return
    const text = editPost.text.trim()
    if (!text) { alert('내용을 입력해 주세요 🐾'); return }
    setEditSaving(true)
    try {
      const { error } = await supabase.from('posts').update({ content: text }).eq('id', editPost.id)
      if (error) { alert('수정에 실패했어요 🐾'); return }
      setPosts(prev => prev.map(x => x.id === editPost.id ? { ...x, content: text } : x))
      setEditPost(null)
    } finally {
      setEditSaving(false)
    }
  }

  // 글 카테고리 변경 — 작성자 본인 또는 관리자. 공지는 관리자만.
  async function changeCategory(post, newTag) {
    if (post.tag === newTag) { setCatMenu(null); return }
    if (newTag === 'notice' && role !== 'admin') { alert('공지는 관리자만 지정할 수 있어요 🐾'); return }
    setCatBusy(true)
    try {
      const { error } = await supabase.from('posts').update({ tag: newTag }).eq('id', post.id)
      if (error) { alert('카테고리 변경에 실패했어요 🐾'); return }
      setPosts(prev => prev.map(x => x.id === post.id ? { ...x, tag: newTag } : x))
      setCatMenu(null)
    } finally {
      setCatBusy(false)
    }
  }

  // 라이트박스에서 사진 보면서 댓글 남기기
  async function sendViewerComment() {
    const text = viewerText.trim()
    if (!text || !viewer?.postId || viewerSending) return
    if (!user) { router.push('/login'); return }
    setViewerSending(true)
    try {
      const { data: c, error } = await supabase.from('comments').insert({
        post_id: viewer.postId,
        user_id: user.id,
        author_name: user.user_metadata?.name || '익명',
        content: text,
      }).select().single()
      if (error) { alert('댓글 등록에 실패했어요 🐾'); return }
      setPosts(prev => prev.map(p => p.id === viewer.postId ? { ...p, comments: [...(p.comments || []), c] } : p))
      setViewerText('')
    } finally {
      setViewerSending(false)
    }
  }

  // 홈 공지 지정/해제 (관리자) — 지정된 글은 홈 하단에 노출, 최대 2개.
  // 이미 2개면 가장 오래 전에 지정한 공지를 해제하고 새 글을 지정한다.
  async function togglePin(p) {
    if (role !== 'admin') return
    if (p.pinned_at) {
      if (!confirm('이 글의 홈 공지를 해제할까요?')) return
      const { error } = await supabase.from('posts').update({ pinned_at: null }).eq('id', p.id)
      if (error) { alert('공지 해제에 실패했어요 🐾'); return }
      setPosts(prev => prev.map(x => x.id === p.id ? { ...x, pinned_at: null } : x))
    } else {
      const pinned = posts.filter(x => x.pinned_at).sort((a, b) => (a.pinned_at || '').localeCompare(b.pinned_at || ''))
      const msg = pinned.length >= 2
        ? '공지는 최대 2개까지예요.\n가장 오래된 공지를 해제하고 이 글을 홈 공지로 지정할까요?'
        : '이 글을 홈 화면 공지로 지정할까요? (최대 2개)'
      if (!confirm(msg)) return
      if (pinned.length >= 2) {
        await supabase.from('posts').update({ pinned_at: null }).eq('id', pinned[0].id)
      }
      const { error } = await supabase.from('posts').update({ pinned_at: new Date().toISOString() }).eq('id', p.id)
      if (error) { alert('공지 지정에 실패했어요. 잠시 후 다시 시도해 주세요 🐾'); return }
      loadPosts()
    }
  }

  function getImages(p) {
    if (p.images && p.images.length > 0) return p.images
    if (p.image_url) return [p.image_url]
    return []
  }

  const filtered = tab === 0 ? posts : posts.filter(p => p.tag === TAG_IDS[tab])

  // 날짜별 그룹 (created_at 기준)
  const groups = []
  for (const p of filtered) {
    const date = (p.created_at || '').split('T')[0]
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.items.push(p)
    else groups.push({ date, items: [p] })
  }

  if (loading) return <LoadingCat />

  const DOW = ['일','월','화','수','목','금','토']

  return (
    <>
      <style>{`
        /* Squash & Stretch — 빠르게 길쭉하게 솟았다(stretch), 납작하게 눌리고(squash), 잔잔한 감쇠 진동으로 정지 */
        @keyframes bubIn {
          0%   { opacity:0; transform: translateY(26px) scale(0.5, 0.72); }
          36%  { opacity:1; transform: translateY(-7px) scale(1.13, 0.9); }
          54%  { transform: translateY(3px)  scale(0.94, 1.07); }
          70%  { transform: translateY(-1.5px) scale(1.045, 0.975); }
          83%  { transform: translateY(0.5px) scale(0.985, 1.012); }
          93%  { transform: translateY(0) scale(1.006, 0.996); }
          100% { opacity:1; transform: translateY(0) scale(1, 1); }
        }
        .bub-in { animation: bubIn 0.74s cubic-bezier(0.22, 1, 0.36, 1) both; transform-origin: 100% 100%; }
        @keyframes thumbIn {
          0%   { opacity:0; transform: scale(0.3, 0.45) rotate(-8deg); }
          42%  { opacity:1; transform: scale(1.15, 0.88) rotate(3deg); }
          62%  { transform: scale(0.93, 1.08) rotate(-1.5deg); }
          78%  { transform: scale(1.045, 0.97) rotate(0.6deg); }
          90%  { transform: scale(0.99, 1.008) rotate(-0.2deg); }
          100% { opacity:1; transform: scale(1, 1) rotate(0); }
        }
        .thumb-in { animation: thumbIn 0.62s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes heartPop { 0%{transform:scale(1)} 35%{transform:scale(1.45)} 60%{transform:scale(0.9)} 100%{transform:scale(1)} }
        .heart-pop { animation: heartPop 0.4s ease; display:inline-block; }
        .press { transition: transform 0.12s cubic-bezier(0.34,1.56,0.64,1); }
        .press:active { transform: scale(0.84); }
        @media (prefers-reduced-motion: reduce) { .bub-in, .thumb-in, .heart-pop { animation: none } .press:active { transform:none } }
        .viewer-input::placeholder { color: rgba(255,255,255,0.55); }
      `}</style>

      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="chat" color="#fff" size={20} />
          <span className="header-title">라운지</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'16px 12px 176px', minHeight:'80vh' }}>
        {/* 카테고리 칩 — 보낼 때도 이 카테고리로 올라간다 */}
        <div className="no-scrollbar" style={{ display:'flex', gap:7, marginBottom:14, overflowX:'auto', paddingBottom:2 }}>
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

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--tmu)', fontSize:13, lineHeight:1.8 }}>
            <div style={{ fontSize:34, marginBottom:6 }}>🐱</div>
            아직 글이 없어요<br/>
            <span style={{ fontSize:11 }}>{user ? '아래 입력창에 바로 써서 첫 소식을 남겨보세요 🐾' : '스튜디오 소식과 수강생 이야기가 올라오는 공간이에요 🐾'}</span>
          </div>
        ) : groups.map(g => {
          const d = g.date ? new Date(g.date + 'T00:00:00') : null
          return (
            <div key={g.date || 'nodate'}>
              {d && (
                <div style={{ display:'flex', justifyContent:'center', margin:'10px 0 14px' }}>
                  <span style={{ fontSize:10.5, fontWeight:800, color:ACCENT_TEXT, background:'rgb(var(--ac-rgb) / 0.1)', padding:'5px 14px', borderRadius:20 }}>
                    {d.getMonth()+1}월 {d.getDate()}일 ({DOW[d.getDay()]})
                  </span>
                </div>
              )}

              {g.items.map(p => {
                const isMine = p.author_id === user?.id
                const isNew = p.id === lastAddedId
                const images = getImages(p)
                const liked = myLikes.has(p.id)
                const likeN = likeCount[p.id] ?? (p.likes_count || 0)
                const tagStyle = TAG_COLORS[p.tag] || TAG_COLORS.etc
                const tagLabel = TAGS[TAG_IDS.indexOf(p.tag)]
                const canDelete = isMine || role === 'admin'
                const time = (p.created_at || '').split('T')[1]?.slice(0,5) || ''

                const bubble = (
                  <div className={isNew ? 'bub-in' : ''}
                    onClick={role === 'admin' ? () => togglePin(p) : undefined}
                    title={role === 'admin' ? (p.pinned_at ? '눌러서 홈 공지 해제' : '눌러서 홈 공지로 지정') : undefined}
                    style={isMine
                      ? { background:ACCENT, color:'#fff', fontSize:13.5, fontWeight:600, lineHeight:1.6, padding:'11px 14px', borderRadius:'24px 24px 8px 24px', boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.22)', whiteSpace:'pre-wrap', wordBreak:'break-word', cursor: role === 'admin' ? 'pointer' : 'default' }
                      : { background:'var(--surf)', color:'var(--td)', border:`3px solid rgb(var(--ac-rgb) / 0.35)`, fontSize:13.5, fontWeight:600, lineHeight:1.6, padding:'10px 13px', borderRadius:'24px 24px 24px 8px', boxShadow:'3px 3px 0 rgb(var(--ac-rgb) / 0.12)', whiteSpace:'pre-wrap', wordBreak:'break-word', cursor: role === 'admin' ? 'pointer' : 'default' }}>
                    {p.title && <div style={{ fontWeight:900, fontSize:14, marginBottom:3, lineHeight:1.4 }}>{p.title}</div>}
                    {p.content && <div>{p.content}</div>}
                  </div>
                )

                // 내용 수정 모드 — 말풍선 자리에 입력창
                const isEditing = editPost?.id === p.id
                const editBox = (
                  <div style={{ width:'72vw', maxWidth:290 }}>
                    <textarea value={editPost?.text || ''} autoFocus rows={3}
                      onChange={e => setEditPost(prev => ({ ...prev, text: e.target.value }))}
                      style={{ width:'100%', padding:'10px 12px', borderRadius:16, border:'2.5px solid var(--ac)', background:'var(--acBg)', fontSize:13, fontWeight:600, color:'var(--td)', lineHeight:1.6, resize:'none', outline:'none', fontFamily:'Nunito,sans-serif', boxSizing:'border-box', display:'block' }}/>
                    <div style={{ display:'flex', gap:6, justifyContent: isMine ? 'flex-end' : 'flex-start', marginTop:5 }}>
                      <button onClick={() => setEditPost(null)} disabled={editSaving}
                        style={{ padding:'6px 14px', borderRadius:14, border:'2px solid var(--g2)', background:'#fff', color:'var(--tm)', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>취소</button>
                      <button onClick={saveEdit} disabled={editSaving}
                        style={{ padding:'6px 16px', borderRadius:14, border:'none', background:'var(--ac)', color:'#fff', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif', opacity: editSaving ? 0.6 : 1 }}>{editSaving ? '저장 중…' : '저장'}</button>
                    </div>
                  </div>
                )

                const thumbs = images.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent: isMine ? 'flex-end' : 'flex-start', maxWidth:'100%' }}>
                    {images.slice(0, 6).map((src, i) => {
                      const more = i === 5 && images.length > 6
                      return (
                        <div key={i} className={isNew ? 'thumb-in' : ''} onClick={() => { setViewer({ images, idx: i, postId: p.id }); setViewerText('') }}
                          style={{ position:'relative', width:62, height:62, borderRadius:14, overflow:'hidden', cursor:'pointer', border:'2.5px solid rgb(var(--ac-rgb) / 0.3)', background:ACCENT_BG, flexShrink:0, animationDelay:`${i*60}ms` }}>
                          <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                          {more && (
                            <div style={{ position:'absolute', inset:0, background:'rgba(27,28,70,0.55)', color:'#fff', fontSize:13, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              +{images.length - 6}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )

                const meta = (
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                    <button onClick={() => toggleLike(p.id)} title="공감"
                      style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:16, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:10.5,
                        border:`2px solid ${liked ? '#FF8FB1' : 'rgb(var(--ac-rgb) / 0.25)'}`, background: liked ? '#FF8FB1' : 'var(--surf)', color: liked ? '#fff' : 'var(--tmu)', transition:'all 0.15s' }}>
                      <span key={liked ? 'on' : 'off'} className={liked ? 'heart-pop' : ''} style={{ fontSize:11, lineHeight:1 }}>{liked ? '❤️' : '🤍'}</span>
                      <span style={{ fontVariantNumeric:'tabular-nums' }}>{likeN}</span>
                    </button>
                    <span style={{ fontSize:9, color:'var(--tl)', fontWeight:700 }}>{time}</span>
                    {(isMine || role === 'admin') ? (
                      <button onClick={() => setCatMenu(p)} title="카테고리 변경"
                        style={{ display:'flex', alignItems:'center', gap:2, fontSize:8.5, fontWeight:900, padding:'2px 7px', borderRadius:10, background:tagStyle.bg, color:tagStyle.color, border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                        {tagLabel || '기타'} <span style={{ fontSize:7, opacity:0.7 }}>▾</span>
                      </button>
                    ) : tab === 0 && p.tag && tagLabel && (
                      <span style={{ fontSize:8.5, fontWeight:900, padding:'2px 8px', borderRadius:10, background:tagStyle.bg, color:tagStyle.color }}>{tagLabel}</span>
                    )}
                    {role === 'admin' ? (
                      <button onClick={() => togglePin(p)} title={p.pinned_at ? '홈 공지 해제' : '홈 공지로 지정 (최대 2개)'}
                        style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 9px', borderRadius:16, cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:900, fontSize:9,
                          border:`2px solid ${p.pinned_at ? 'var(--ac)' : 'rgb(var(--ac-rgb) / 0.25)'}`, background: p.pinned_at ? 'var(--ac)' : 'var(--surf)', color: p.pinned_at ? '#fff' : 'var(--tmu)', transition:'all 0.15s' }}>
                        📌{p.pinned_at ? ' 공지 중' : ''}
                      </button>
                    ) : p.pinned_at && (
                      <span style={{ fontSize:8.5, fontWeight:900, padding:'2px 8px', borderRadius:10, background:'var(--ac)', color:'#fff' }}>📌 공지</span>
                    )}
                    {canDelete && (
                      <button onClick={() => setEditPost({ id: p.id, text: p.content || '' })} title="내용 수정"
                        style={{ width:18, height:18, borderRadius:'50%', border:'2px solid var(--line)', background:'#fff', fontSize:8.5, lineHeight:1, cursor:'pointer', padding:0 }}>✏️</button>
                    )}
                    {canDelete && (
                      <button onClick={() => deletePost(p.id)} title="삭제"
                        style={{ width:18, height:18, borderRadius:'50%', border:'2px solid var(--line)', background:'#fff', color:'var(--tl)', fontSize:9, lineHeight:1, cursor:'pointer', padding:0 }}>✕</button>
                    )}
                  </div>
                )

                return (
                  <div key={p.id} style={{ marginBottom:14 }}>
                    {isMine ? (
                      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, alignItems:'flex-end' }}>
                        <div style={{ maxWidth:'78%', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                          {isEditing ? editBox : (p.title || p.content) && bubble}
                          {thumbs}
                          {meta}
                        </div>
                        <CatAvatar catKey={profileMap[p.author_id]} size={38} />
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                        <CatAvatar catKey={profileMap[p.author_id]} size={38} />
                        <div style={{ maxWidth:'78%', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:5 }}>
                          <span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)', marginLeft:4 }}>{p.author_name}</span>
                          {isEditing ? editBox : (p.title || p.content) && bubble}
                          {thumbs}
                          {meta}
                        </div>
                      </div>
                    )}

                    {/* 지난 댓글(레거시) — 메시지 아래 작은 말풍선 */}
                    {p.comments?.length > 0 && (
                      <div style={{ marginTop:7, marginLeft: isMine ? 0 : 46, display:'flex', flexDirection:'column', gap:6, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                        {p.comments.map(c => (
                          <div key={c.id} style={{ display:'flex', gap:6, alignItems:'flex-end', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                            <CatAvatar catKey={profileMap[c.user_id]} size={24} />
                            <div style={{ background:ACCENT_BG, border:'2px solid rgb(var(--ac-rgb) / 0.3)', borderRadius:14, padding:'6px 10px', maxWidth:240 }}>
                              <span style={{ fontSize:9, fontWeight:900, color:ACCENT_TEXT, marginRight:5 }}>{c.author_name}</span>
                              <span style={{ fontSize:11, color:'var(--td)', fontWeight:600, lineHeight:1.4 }}>{c.content}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* 카톡식 입력바 — 현재 카테고리로 바로 전송 (비로그인은 로그인 안내) */}
      {!user ? (
        <div style={{ position:'fixed', bottom:66, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:390, background:'#fff', borderTop:'2px solid rgb(var(--ac-rgb) / 0.15)', zIndex:90, boxSizing:'border-box', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ flex:1, fontSize:12, fontWeight:700, color:'var(--tm)', minWidth:0 }}>로그인하면 글·공감·댓글을 남길 수 있어요 🐾</span>
          <button onClick={()=>router.push('/login')}
            style={{ flexShrink:0, padding:'9px 16px', background:'var(--ac)', color:'#fff', border:'none', borderRadius:18, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'2px 2px 0 rgb(var(--ac-rgb) / 0.3)' }}>
            로그인 / 가입
          </button>
        </div>
      ) : (
      <div style={{ position:'fixed', bottom:66, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:390, background:'#fff', borderTop:'2px solid rgb(var(--ac-rgb) / 0.15)', zIndex:90, boxSizing:'border-box' }}>
        {composePreviews.length > 0 && (
          <div className="no-scrollbar" style={{ display:'flex', gap:7, padding:'10px 12px 0', overflowX:'auto' }}>
            {composePreviews.map((url, i) => (
              <div key={url} className="thumb-in" style={{ position:'relative', width:56, height:56, flexShrink:0, borderRadius:14, overflow:'hidden', border:'2.5px solid rgb(var(--ac-rgb) / 0.4)' }}>
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
            placeholder={tab === 0 ? '라운지에 글 남기기…' : `${TAGS[tab]}에 글 남기기…`}
            style={{ flex:1, height:42, background:ACCENT_BG, border:`3px solid ${ACCENT}`, borderRadius:24, padding:'0 16px', fontSize:13, color:'var(--td)', fontWeight:600, fontFamily:'Nunito,sans-serif', outline:'none', boxSizing:'border-box', minWidth:0 }}/>
          <button className="press" onClick={handleSend} disabled={sending || (!composeText.trim() && composeFiles.length === 0)}
            style={{ width:42, height:42, flexShrink:0, borderRadius:'50%', border:`3px solid ${ACCENT}`, color:'#fff', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0,
              background: (composeText.trim() || composeFiles.length) ? ACCENT : 'rgb(var(--ac-rgb) / 0.35)',
              boxShadow:'2px 2px 0 rgb(var(--ac-rgb) / 0.3)' }}>
            {sending ? '…' : '➤'}
          </button>
        </div>
      </div>
      )}

      {/* 카테고리 변경 바텀시트 — 글 클릭(카테고리 칩) 시 */}
      {catMenu && (
        <div onClick={() => !catBusy && setCatMenu(null)}
          style={{ position:'fixed', inset:0, background:'rgba(27,28,70,0.45)', zIndex:1100, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'24px 24px 0 0', maxWidth:390, width:'100%', margin:'0 auto', padding:'18px 16px calc(20px + env(safe-area-inset-bottom))', boxSizing:'border-box' }}>
            <div style={{ fontSize:14.5, fontWeight:900, color:'var(--td)' }}>카테고리 선택</div>
            <div style={{ fontSize:11, color:'var(--tmu)', fontWeight:600, margin:'3px 0 14px' }}>이 글을 어느 카테고리로 옮길까요?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {['notice','event','class','etc'].map(tid => {
                const label = TAGS[TAG_IDS.indexOf(tid)]
                const on = catMenu.tag === tid
                const disabled = tid === 'notice' && role !== 'admin'
                const st = TAG_COLORS[tid] || TAG_COLORS.etc
                return (
                  <button key={tid} disabled={disabled || catBusy} onClick={() => changeCategory(catMenu, tid)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:14, cursor: disabled ? 'default' : 'pointer', fontFamily:'Nunito,sans-serif',
                      border: on ? '2.5px solid var(--ac)' : '1.5px solid var(--g2)', background: on ? 'var(--acBg)' : '#fff', opacity: disabled ? 0.45 : 1 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <span style={{ fontSize:11, fontWeight:900, padding:'3px 11px', borderRadius:10, background:st.bg, color:st.color }}>{label}</span>
                      {disabled && <span style={{ fontSize:10, color:'var(--tmu)', fontWeight:700 }}>관리자 전용</span>}
                    </span>
                    {on && <span style={{ color:'var(--ac)', fontWeight:900, fontSize:14 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 이미지 크게 보기 — 라이트박스 */}
      {viewer && (
        <div onClick={() => setViewer(null)}
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={viewerSwipe}
          style={{ position:'fixed', inset:0, background:'rgba(10,11,35,0.93)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:'46px 12px 150px' }}>
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
            </>
          )}

          {/* 사진 보면서 댓글 — 하단 패널 (닫히지 않게 클릭 전파 차단) */}
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
            {(() => {
              const cs = posts.find(x => x.id === viewer.postId)?.comments || []
              return cs.length > 0 && (
                <div className="no-scrollbar" style={{ maxHeight:110, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
                  {cs.map(c => (
                    <div key={c.id} style={{ fontSize:11.5, color:'#fff', lineHeight:1.5, wordBreak:'break-word' }}>
                      <span style={{ fontWeight:900, color:'rgba(255,255,255,0.72)', marginRight:6 }}>{c.author_name}</span>
                      <span style={{ fontWeight:600 }}>{c.content}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ display:'flex', gap:7, alignItems:'center' }}>
              <input className="viewer-input" value={viewerText} onChange={e => setViewerText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendViewerComment() }}
                placeholder={user ? '사진 보면서 댓글 남기기…' : '로그인하고 댓글 남기기…'}
                style={{ flex:1, minWidth:0, height:38, borderRadius:20, border:'2px solid rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.14)', color:'#fff', padding:'0 14px', fontSize:12, fontWeight:600, outline:'none', fontFamily:'Nunito,sans-serif', boxSizing:'border-box' }}/>
              <button onClick={sendViewerComment} disabled={viewerSending || !viewerText.trim()}
                style={{ width:38, height:38, flexShrink:0, borderRadius:'50%', border:'none', color:'#fff', fontSize:13, cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', background: viewerText.trim() ? 'var(--ac)' : 'rgba(255,255,255,0.22)' }}>
                {viewerSending ? '…' : '➤'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(role === 'admin' || role === 'artist') ? (
        <nav className="bottom-nav">
          {[
            { href: role==='admin'?'/admin':role==='artist'?'/artist':'/student', label:'홈', icon:'home' },
            ...(role === 'artist' ? [] : [{ href: role==='admin'?'/admin/notification':'/student/notification', label:'알림', icon:'bell' }]),
            { href:'/lounge', label:'라운지', icon:'chat', active:true },
            ...(role === 'artist' ? [] : [{ href:'/student/farm', label:'냥밭', icon:'plant' }]),
          ].map(t => (
            <a key={t.label} href={t.href} className={`nav-item ${t.active?'active':''}`}>
              <NavIcon name={t.icon} active={t.active} />
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
