'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import LoadingCat from '../../../components/LoadingCat'
import { pixelCatImg, DEFAULT_PROFILE_CAT, isValidPixelCat } from '../../../lib/pixelCats'
import { FARM_CATS } from '../../../lib/farmCats'

// 인스타형 개인 프로필 = 그 사람의 기록 사진 갤러리.
// 본인은 공개+비공개 전부, 외부인은 공개(is_public) 사진만 본다(서버 게이트).
// 사진 탭 → 확대 화면에서 본인이 공개/비공개를 토글.
const ACCENT = 'var(--ac)'
const ACCENT_BG = 'var(--acBg)'
const ACCENT_TEXT = 'var(--acTx)'

function catOf(key) { return isValidPixelCat(key) ? key : DEFAULT_PROFILE_CAT }

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const targetId = params?.id

  const [user, setUser] = useState(null)
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [profileCat, setProfileCat] = useState(DEFAULT_PROFILE_CAT)
  const [farmCat, setFarmCat] = useState('')
  const [harvestCount, setHarvestCount] = useState(0)
  const [photos, setPhotos] = useState([])        // [{ id, url, is_public, note }]
  const [isOwner, setIsOwner] = useState(false)
  const [viewerIdx, setViewerIdx] = useState(null) // 확대 뷰: photos 인덱스
  const [toggling, setToggling] = useState(() => new Set())

  const touchX = useRef(null)
  function swipe(e) {
    if (touchX.current == null || viewerIdx == null || photos.length < 2) return
    const delta = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(delta) < 50) return
    setViewerIdx(i => delta < 0 ? (i+1)%photos.length : (i-1+photos.length)%photos.length)
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

    // 이름 + 프로필 고양이 + 냥밭(농부·수확)
    const [{ data: pref }, { data: u }] = await Promise.all([
      supabase.from('user_prefs').select('profile_cat, farm_cat, harvest_count').eq('user_id', targetId).single(),
      supabase.from('users').select('name').eq('id', targetId).single(),
    ])
    setProfileCat(catOf(pref?.profile_cat))
    setFarmCat(pref?.farm_cat || FARM_CATS[0].key)
    setHarvestCount(Number.isFinite(pref?.harvest_count) ? pref.harvest_count : 0)
    setName(u?.name || (targetId === me?.id ? (me?.user_metadata?.name || '') : '') || '냥작가')

    // 기록 사진 — 서버가 뷰어 권한대로 공개/비공개 필터링
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    try {
      const res = await fetch(`/api/profile/photos?userId=${encodeURIComponent(targetId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      setPhotos(Array.isArray(json.photos) ? json.photos : [])
      setIsOwner(!!json.isOwner)
    } catch {
      setPhotos([]); setIsOwner(false)
    }
    setLoading(false)
  }

  // 공개/비공개 토글 (본인) — 낙관적 갱신
  async function setPublic(photoId, next) {
    if (toggling.has(photoId)) return
    setToggling(prev => { const n = new Set(prev); n.add(photoId); return n })
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, is_public: next } : p))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/profile/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ photoId, isPublic: next }),
      })
      if (!res.ok) throw new Error('toggle failed')
    } catch {
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, is_public: !next } : p)) // 롤백
      alert('공개 설정 변경에 실패했어요 🐾')
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(photoId); return n })
    }
  }

  if (loading) return <LoadingCat />

  const total = photos.length
  const publicCount = photos.filter(p => p.is_public).length
  const farmer = FARM_CATS.find(c => c.key === farmCat) || FARM_CATS[0]
  const cur = viewerIdx != null ? photos[viewerIdx] : null

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
              <div><span style={{ fontSize:15, fontWeight:900, color:'var(--td)' }}>{total}</span><span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)', marginLeft:4 }}>사진</span></div>
              {isOwner && <div><span style={{ fontSize:15, fontWeight:900, color:'var(--td)' }}>{publicCount}</span><span style={{ fontSize:10.5, fontWeight:800, color:'var(--tmu)', marginLeft:4 }}>🌐 공개</span></div>}
            </div>
          </div>
        </div>

        {/* 냥밭 상황 */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, margin:'0 16px 10px', background:ACCENT_BG, border:'2px solid rgb(var(--ac-rgb) / 0.22)', borderRadius:16, padding:'5px 12px 5px 6px' }}>
          <img src={farmer.img} alt="" width={30} height={30} style={{ imageRendering:'pixelated', display:'block' }} />
          <span style={{ fontSize:11, fontWeight:800, color:ACCENT_TEXT }}>냥밭 · {farmer.name}</span>
          <span style={{ width:1, height:12, background:'rgb(var(--ac-rgb) / 0.25)' }} />
          <span style={{ fontSize:11.5, fontWeight:900, color:'var(--td)' }}>🌾 수확 {harvestCount}개</span>
        </div>

        <div style={{ padding:'0 16px 12px', fontSize:10.5, fontWeight:700, color:'var(--tmu)', lineHeight:1.5 }}>
          {isOwner ? '기록 사진이 전부 모여요 · 사진을 눌러 🌐공개 / 🔒나만 보기를 정해요' : '🌐 공개된 기록 사진만 볼 수 있어요'}
        </div>

        {/* 섹션 라벨 */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderTop:'2px dashed var(--g1)' }}>
          <span style={{ fontSize:12, fontWeight:900, color:ACCENT_TEXT }}>{isOwner ? '내 기록 사진' : '공개 사진'}</span>
          <span style={{ fontSize:10, fontWeight:800, color:'var(--tmu)' }}>{total}</span>
        </div>

        {/* 사진 3열 그리드 */}
        {total === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--tmu)' }}>
            <img src={pixelCatImg('06-sleepy')} alt="" width={56} height={56} style={{ imageRendering:'pixelated', display:'inline-block', opacity:0.8 }} />
            <div style={{ fontSize:12.5, fontWeight:800, marginTop:10, color:'var(--tm)' }}>{isOwner ? '아직 기록 사진이 없어요' : '아직 공개한 사진이 없어요'}</div>
            <div style={{ fontSize:11, fontWeight:600, marginTop:4 }}>{isOwner ? '기록에 사진을 남기면 여기 모여요 🐾' : '🐾'}</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:3, padding:'0 3px' }}>
            {photos.map((p, i) => (
              <div key={p.id} onClick={() => setViewerIdx(i)}
                style={{ position:'relative', aspectRatio:'1', cursor:'pointer', overflow:'hidden', background:'#eee' }}>
                <img src={p.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                {isOwner && !p.is_public && (
                  <span style={{ position:'absolute', top:5, right:6, fontSize:12, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,0.55)' }}>🔒</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 확대 뷰 — 사진 + (본인) 공개/비공개 토글. 심플. */}
      {cur && (
        <div onClick={() => setViewerIdx(null)}
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={swipe}
          style={{ position:'fixed', inset:0, background:'rgba(10,11,35,0.94)', zIndex:1200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 12px' }}>

          <button onClick={() => setViewerIdx(null)}
            style={{ position:'absolute', top:14, right:14, width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', fontSize:17, cursor:'pointer', lineHeight:1 }}>✕</button>

          <img src={cur.url} alt="" onClick={e => e.stopPropagation()}
            style={{ maxWidth:'100%', maxHeight:'62vh', objectFit:'contain', borderRadius:16, display:'block' }} />

          {photos.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setViewerIdx(i => (i-1+photos.length)%photos.length) }}
                style={{ position:'absolute', left:8, top:'44%', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setViewerIdx(i => (i+1)%photos.length) }}
                style={{ position:'absolute', right:8, top:'44%', background:'rgba(255,255,255,0.16)', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', fontSize:24, lineHeight:1 }}>›</button>
            </>
          )}

          {/* 캡션(기록 메모) */}
          {cur.note && (
            <div onClick={e => e.stopPropagation()} className="no-scrollbar"
              style={{ maxWidth:360, maxHeight:64, overflowY:'auto', marginTop:14, color:'rgba(255,255,255,0.9)', fontSize:12, fontWeight:600, lineHeight:1.55, textAlign:'center', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
              {cur.note}
            </div>
          )}

          {/* 공개/비공개 토글 (본인만) */}
          {isOwner ? (
            <div onClick={e => e.stopPropagation()} style={{ marginTop:18, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', background:'rgba(255,255,255,0.14)', borderRadius:22, padding:4, gap:4 }}>
                <button onClick={() => setPublic(cur.id, false)} disabled={toggling.has(cur.id)}
                  style={{ display:'flex', alignItems:'center', gap:6, border:'none', cursor:'pointer', borderRadius:18, padding:'9px 18px', fontSize:12.5, fontWeight:900, fontFamily:'Nunito,sans-serif',
                    background: !cur.is_public ? '#fff' : 'transparent', color: !cur.is_public ? 'var(--td)' : 'rgba(255,255,255,0.75)' }}>
                  🔒 나만 보기
                </button>
                <button onClick={() => setPublic(cur.id, true)} disabled={toggling.has(cur.id)}
                  style={{ display:'flex', alignItems:'center', gap:6, border:'none', cursor:'pointer', borderRadius:18, padding:'9px 18px', fontSize:12.5, fontWeight:900, fontFamily:'Nunito,sans-serif',
                    background: cur.is_public ? 'var(--ac)' : 'transparent', color: cur.is_public ? '#fff' : 'rgba(255,255,255,0.75)' }}>
                  🌐 전체공개
                </button>
              </div>
              <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>
                {cur.is_public ? '누구나 이 사진을 볼 수 있어요' : '나만 볼 수 있어요 (외부인 안 보임)'}
              </span>
            </div>
          ) : (
            <span style={{ marginTop:16, fontSize:11, fontWeight:800, color:'rgba(255,255,255,0.55)' }}>🌐 공개 사진</span>
          )}
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
