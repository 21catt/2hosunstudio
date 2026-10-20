'use client'
// /castle — 3D 메인(Castle Jelly) 1단계, **숨긴 미리보기** (2026-10-19)
//
// 사용자 지시: "바로 바꾸지 말고 숨겨서 진행하다가 완벽히 교체되면 그때 웹에서 보이게".
//   · 관리자(오너)와 관리자가 「미리 열어 준」 학생(user_metadata.castle_beta — /admin/castle-beta)만 열린다.
//     그 밖은 원래 홈으로 돌려보낸다. 학생 홈에는 미리보기 대상에게만 입구가 보인다.
//   · 언제든 「예전 홈으로」(오른쪽 위) · 느린 기기 = 가벼운 모드 / 3D 를 못 그리면 대체 화면.
//   · 기존 학생 홈(/student)은 무변경.
// 구성: 가운데 3D 디오라마 · 왼쪽 수업 · 위 이번 주 일정 · 아래 기타 기능 · 오른쪽 유리 패널(오늘 + 장면 조절).
// 모바일: 위 일정 줄 · 「장면」 동그란 버튼(누르면 조절 패널) · 아래 시트(수업) + 기능 막대.

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { sortCoursesByCategory } from '../../lib/courseSort'
import { FARM_CATS, getSavedFarmCat } from '../../lib/farmCats'
import { getSavedTheme } from '../../lib/theme'
import LoadingCat from '../../components/LoadingCat'
import BookingPanel from '../../components/castle/BookingPanel'
import { CATEGORY_STYLE } from '../../lib/categoryStyle'
import { CASTLE_SCENES, getSavedScene, saveSceneLocal, sceneOf, sceneUnlocked, sceneSelectable } from '../../lib/castleScenes'
import s from './castle.module.css'
import { createCozyMusic } from '../../lib/cozyMusic'

// 장면 = 원본 프롬프트 그대로 만든 시연판(CastleStudyScene, WebGPU). 옛 장면(CastleJellyScene)은 되돌릴 때를 위해 남겨 둔다.
const CastleJellyScene = dynamic(() => import('../../components/castle/CastleStudyScene'), { ssr: false })

// 카테고리 색 = 성의 색(lib/categoryStyle — 예약 패널과 한 표)
const CAT = Object.fromEntries(Object.entries(CATEGORY_STYLE).map(([k, v]) => [k, { name: v.name, dot: v.orb, tint: v.tint, ink: v.ink }]))
const OCTO_LIST = [['raspberry', '라즈베리', '#d81e4f'], ['blueberry', '블루베리', '#2f56e8'], ['tangerine', '귤', '#ff7a12']]
const OCTO_ACTS = [['stroll', '산책'], ['curl', '돌돌 말기'], ['wave', '손 흔들기'], ['ink', '먹물'], ['blush', '발그레']]
const CITRUS_LIST = [['orange', '오렌지', '#f58a1f'], ['blood', '블러드 오렌지', '#b8202e'], ['lemon', '레몬', '#f2d53c']]
const FLAVOUR_LIST = [['glacier', '빙하', '#8fd3ea'], ['rose', '로즈', '#f4b6cb'], ['lilac', '라일락', '#cdbcf3']]
const PICK_LINK = {
  tower:   { label: '탑 · 수업 소개 →',  href: '/student/curriculum' },
  gate:    { label: '성문 · 예약하기 →', href: '/student/calendar', booking: true },
  ship:    { label: '배 · 라운지 →',     href: '/lounge' },
  brazier: { label: '화로 · 냥밭 →',     href: '/student/farm' },
  cat:     { label: '냥이 · 3D 냥밭 →',  href: '/castle/farm' },
}
// 내 테마 → 장면 첫 모습(저장된 장면 설정이 없을 때만). 스페이스 = 밤, 노을빛 테마 = 노을.
const THEME_LOOK = {
  lilac: { flavour: 'lilac' }, liquid: { flavour: 'lilac' }, burgundy: { flavour: 'rose' },
  palu: { flavour: 'rose', timeOfDay: 0.5 }, ink: { timeOfDay: 0.45 },
  space: { flavour: 'lilac', timeOfDay: 0.92 }, glass: { flavour: 'glacier' },
}
const LOOK_KEY = '2hs_castle_look'
const DEFAULT_LOOK = { timeOfDay: 0.15, flow: 0.6, firmness: 0.45, damping: 0.5, flavour: 'glacier' }
function initialLook() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null')
    if (saved && typeof saved === 'object') return { ...DEFAULT_LOOK, ...saved }
  } catch {}
  let theme = 'ultra'
  try { theme = getSavedTheme() } catch {}
  return { ...DEFAULT_LOOK, ...(THEME_LOOK[theme] || {}) }
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Icon({ d }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
}
const DOCK = [
  { href: '/student', label: '홈', icon: <path d="M4 11l8-7 8 7v9H4z" /> },
  { href: '/student/records', label: '기록', icon: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6" /></> },
  { href: '/castle/farm', label: '냥밭', icon: <path d="M12 20V10M12 10c0-4 3-6 6-6 0 4-3 6-6 6zM12 13c0-3-2-5-5-5 0 3 2 5 5 5z" /> },
  { href: '/lounge', label: '라운지', icon: <path d="M5 6h14v9H9l-4 3z" /> },
  { href: '/student/notification', label: '알림', icon: <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20h4" /> },
  { href: '/student/settings', label: '설정', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></> },
]

export default function CastlePage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [courses, setCourses] = useState([])
  const [bookings, setBookings] = useState([])
  const [ticket, setTicket] = useState(null)
  // 처음 화면은 권한 확인 전 빈 판이라(서버·클라이언트 같은 마크업) 여기서 바로 저장값을 읽어도 된다
  const [look, setLook] = useState(() => (typeof window === 'undefined' ? DEFAULT_LOOK : initialLook()))
  const [catImg, setCatImg] = useState(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [ready, setReady] = useState(false)
  const [unread, setUnread] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  // 3D 배경 — 설정과 같은 값(lib/castleScenes). 출석 4·8·12·16회마다 하나씩 열린다
  const [bgScene, setBgScene] = useState('jelly')
  const [attended, setAttended] = useState(0)
  // 시트러스 젤리 세부 설정(품종·흐물거림·내부 감쇠) — 이 기기에 기억, 젤리가 뜨면 그대로 보낸다
  const [citrus, setCitrus] = useState(() => {
    const d = { variety: 'orange', firm: 0.5, damp: 0.35 }
    try { return { ...d, ...(JSON.parse(localStorage.getItem('2hs_citrus') || 'null') || {}) } } catch { return d }
  })
  const citrusVariety = citrus.variety
  // 젤리 문어(출석 8회) 세부 설정 — 맛·단단함·출렁임·조명 각도
  const [octo, setOcto] = useState(() => {
    const d = { flavour: 'raspberry', firm: 0.45, damp: 0.3, light: 0.5 }
    try { return { ...d, ...(JSON.parse(localStorage.getItem('2hs_octopus') || 'null') || {}) } } catch { return d }
  })
  // 설산 기차(출석 12회) 세부 설정 — 눈 양·기차 빠르기
  const [peak, setPeak] = useState(() => {
    const d = { snow: 0.6, speed: 0.45 }
    try { return { ...d, ...(JSON.parse(localStorage.getItem('2hs_peak') || 'null') || {}) } } catch { return d }
  })
  function setPeakOpt(patch) {
    setPeak(c => { const n = { ...c, ...patch }; try { localStorage.setItem('2hs_peak', JSON.stringify(n)) } catch {}; return n })
    toFrame(patch)
  }
  function setOctoOpt(patch) {
    setOcto(c => { const n = { ...c, ...patch }; try { localStorage.setItem('2hs_octopus', JSON.stringify(n)) } catch {}; return n })
    toFrame(patch)
  }
  function setCitrusOpt(patch) {
    setCitrus(c => { const n = { ...c, ...patch }; try { localStorage.setItem('2hs_citrus', JSON.stringify(n)) } catch {}; return n })
    toFrame(patch)
  }
  const frameRef = useRef(null)
  useEffect(() => { setBgScene(getSavedScene()) }, [])
  const scene = sceneOf(bgScene)
  function chooseScene(key) {
    if (!sceneSelectable(key, { attended, unlockAll: isAdmin })) return
    if (key === bgScene) return
    setBgScene(key); saveSceneLocal(key); setReady(false); setFallback(null); setPick(null)
    if (user?.id) supabase.from('user_prefs').upsert({ user_id: user.id, castle_scene: key }).then(() => {}, () => {})
  }
  // 젤리(iframe) 안을 누르면 이 화면엔 누른 소식이 안 온다 — 젤리가 알려 주면 장면 패널을 닫는다
  useEffect(() => {
    const onMsg = e => { if (e.origin === window.location.origin && (e.data?.citrus === 'touch' || e.data?.scene === 'touch')) { setSceneOpen(false); setPick(null) } }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  const toFrame = msg => { try { frameRef.current?.contentWindow?.postMessage(msg, window.location.origin) } catch {} }
  const [fallback, setFallback] = useState(null) // 'nowebgl' | 'lost' | 'slow'
  // 반응 소리 — 만지고 움직일 때만 나는 짧은 소리(public/jelly-sfx.js, 성·시트러스·문어 공용). 기본 켬, 끈 사람은 끈 채로 기억(2hs_castle_sfx)
  const [sfxOn, setSfxOn] = useState(() => { try { return typeof window === 'undefined' || localStorage.getItem('2hs_castle_sfx') !== '0' } catch { return true } })
  useEffect(() => {
    if (window.JellySfx || document.querySelector('script[data-jelly-sfx]')) return
    const sc = document.createElement('script'); sc.src = '/jelly-sfx.js'; sc.dataset.jellySfx = '1'; document.head.appendChild(sc)
  }, [])
  function toggleSfx() {
    const v = !sfxOn
    try { localStorage.setItem('2hs_castle_sfx', v ? '1' : '0') } catch {}
    if (window.JellySfx) { window.JellySfx.enabled = v; if (v) window.JellySfx.play('pop') }
    setSfxOn(v)
  }
  // 배경음악 — 시간대마다 바뀌는 잔잔한 곡(lib/cozyMusic). 화면을 처음 누르는 순간부터 작게 흐르고(브라우저 규칙),
  // 「♪ 음악」으로 끈 사람은 끈 채로 기억한다(2hs_castle_music = '0'). 반응 소리와는 따로.
  const musicRef = useRef(null)
  const [musicOn, setMusicOn] = useState(() => { try { return typeof window === 'undefined' || localStorage.getItem('2hs_castle_music') !== '0' } catch { return true } })
  async function toggleMusic() {
    if (!musicRef.current) musicRef.current = createCozyMusic()
    const m = musicRef.current
    if (m.playing || musicOn) { m.stop(); setMusicOn(false); try { localStorage.setItem('2hs_castle_music', '0') } catch {} }
    else { await m.start(); setMusicOn(true); try { localStorage.setItem('2hs_castle_music', '1') } catch {} }
  }
  useEffect(() => {
    const EV = ['pointerdown', 'touchstart', 'keydown']
    const first = e => {
      // 「♪ 음악」 단추를 처음 누른 거면 그 단추가 알아서 한다(여기서 켜면 곧바로 꺼진다)
      if (e?.target?.closest?.('[data-music-btn]')) return
      let wanted = true; try { wanted = localStorage.getItem('2hs_castle_music') !== '0' } catch {}
      if (!wanted || musicRef.current?.playing) return
      if (!musicRef.current) musicRef.current = createCozyMusic()
      musicRef.current.start().then(ok => { if (ok) EV.forEach(n => window.removeEventListener(n, first, true)) })
    }
    EV.forEach(n => window.addEventListener(n, first, true))
    const vis = () => { const m = musicRef.current; if (!m) return; document.hidden ? m.suspend() : m.resume() }
    document.addEventListener('visibilitychange', vis)
    return () => { EV.forEach(n => window.removeEventListener(n, first, true)); document.removeEventListener('visibilitychange', vis); musicRef.current?.close(); musicRef.current = null }
  }, [])
  const [lite, setLite] = useState(() => { try { return typeof window !== 'undefined' && localStorage.getItem('2hs_castle_lite') === '1' } catch { return false } })
  const [sceneKey, setSceneKey] = useState(0) // 가벼운 모드로 다시 그릴 때 장면을 새로 만든다
  const settingsRef = useRef(look)
  settingsRef.current = { ...look, catImg, reducedMotion }
  // 처음 = 저장된 장면 설정(없으면 내 테마), 내 농부냥, 동작 줄이기
  useEffect(() => {
    const fc = FARM_CATS.find(c => c.key === getSavedFarmCat())
    setCatImg(fc?.img || null)
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    setReducedMotion(!!mq?.matches)
  }, [])
  // 장면 설정 기억 — 다음에 열어도 같은 모습
  useEffect(() => { try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)) } catch {} }, [look])
  const commandRef = useRef(null)
  const [pick, setPick] = useState(null)
  const [sceneOpen, setSceneOpen] = useState(false)
  const [bridgeUp, setBridgeUp] = useState(false)
  const [user, setUser] = useState(null)
  const [booking, setBooking] = useState(null) // null | { date } — 예약 패널
  // 수업 패널 — 장면을 가리지 않게 기본은 접힘, 펼친 상태는 기억한다
  const [classesOpen, setClassesOpen] = useState(() => { try { return typeof window !== 'undefined' && localStorage.getItem('2hs_castle_classes') === '1' } catch { return false } })
  function toggleClasses(on) { setClassesOpen(on); try { localStorage.setItem('2hs_castle_classes', on ? '1' : '0') } catch {} }
  function openBooking(date) { setBooking({ date: date || ymd(new Date()) }); setPick(null); setSceneOpen(false); if (window.innerWidth <= 760) setClassesOpen(false) }

  // 관리자만 — 숨긴 미리보기
  useEffect(() => {
    // 로컬 개발에서만: ?dev=1 이면 로그인 없이 장면을 본다(배포 빌드에선 이 분기가 없다)
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('dev') === '1') { setAllowed(true); return }
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data?.user
      if (!u) { router.replace('/login'); return }
      const admin = u.user_metadata?.role === 'admin'
      try { if (localStorage.getItem('2hs_home_mode') !== 'castle') localStorage.setItem('2hs_home_mode', 'castle') } catch {} // 3D 홈에 들어오면 3D 모드
      setIsAdmin(admin)
      setUser(u)
      setAllowed(true)
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', u.id).eq('is_read', false)
        .then(({ count }) => setUnread(count || 0))
      loadMine(u)
    })
  }, [])
  async function loadMine(u) {
      const today = ymd(new Date())
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('attended', true)
        .then(({ count }) => setAttended(count || 0), () => {})
      const [{ data: cs }, { data: bs }, { data: tk }] = await Promise.all([
        supabase.from('class_courses').select('id, name, category').eq('is_active', true),
        supabase.from('bookings').select('class_name, class_date, class_time, course_id, status').eq('user_id', u.id).neq('status', 'cancelled').gte('class_date', today).order('class_date'),
        supabase.from('tickets').select('remain, total, expires_at').eq('user_id', u.id).maybeSingle(),
      ])
      setCourses(sortCoursesByCategory(cs || []))
      setBookings(bs || [])
      setTicket(tk || null)
  }

  // 이번 주(오늘부터 7일)
  const week = useMemo(() => {
    const out = []
    const base = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i)
      const key = ymd(d)
      const b = bookings.find(x => x.class_date === key)
      const cat = b ? courses.find(c => c.id === b.course_id)?.category : null
      out.push({ key, dow: DOW[d.getDay()], num: d.getDate(), today: i === 0, dot: b ? (CAT[cat]?.dot || '#f4a9c0') : 'transparent' })
    }
    return out
  }, [bookings, courses])

  // 수업 — 카테고리별 묶음(이름이 같은 수업은 하나로)
  const groups = useMemo(() => {
    const g = []
    for (const c of courses) {
      const cat = c.category || 'etc'
      let grp = g.find(x => x.cat === cat)
      if (!grp) { grp = { cat, names: [] }; g.push(grp) }
      if (!grp.names.includes(c.name)) grp.names.push(c.name)
    }
    return g
  }, [courses])

  const next = bookings[0]
  const night = !scene.embed && look.timeOfDay > 0.7
  const setL = patch => setLook(prev => ({ ...prev, ...patch }))
  function switchLite(on) {
    setLite(on)
    try { localStorage.setItem('2hs_castle_lite', on ? '1' : '0') } catch {}
    setFallback(null); setReady(false); setSceneKey(k => k + 1)
  }

  if (!allowed) return <div className={s.root} />

  return (
    <div className={`${s.root} ${night ? s.night : ''}`}>
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap" />
      {!ready && !fallback && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <LoadingCat label={scene.key === 'octopus' ? '젤리 문어를 굳히는 중…' : scene.key === 'peak' ? '눈을 쌓는 중…' : scene.embed ? '젤리를 굳히는 중…' : '젤리 성을 굳히는 중…'} />
        </div>
      )}
      {scene.embed ? (
        // 한 파일로 만든 장면(시트러스 젤리 등) — 자기 화면 글자는 숨기고(?embed=1) 장면만 뒤에 깐다. 잡아 늘리기는 그 안에서 그대로
        <iframe ref={frameRef} key={scene.key} src={scene.embed} title={`3D 배경 · ${scene.name}`} className={s.sceneFrame}
          onLoad={() => { setReady(true); toFrame(scene.key === 'octopus' ? octo : scene.key === 'peak' ? peak : citrus) }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0 }} onPointerDownCapture={() => setSceneOpen(false)}>
          <CastleJellyScene key={sceneKey} lite={lite} settingsRef={settingsRef} commandRef={commandRef} onReady={() => setReady(true)}
            onFallback={reason => { setReady(true); setFallback(reason) }}
            onPick={(kind, x, y) => setPick(PICK_LINK[kind] ? { ...PICK_LINK[kind], x, y } : null)} />
        </div>
      )}

      <div className={s.badge}>{'새 3D 홈 · 오른쪽 위 「3D 모드」로 언제든 예전 화면 · 의견을 들려주세요'}</div>

      {/* 언제든 예전 홈으로 · 가벼운 모드 */}
      <div className={s.topActions}>
        <button data-music-btn className={`${s.topBtn} ${s.glass}`} aria-pressed={musicOn} onClick={toggleMusic} aria-label={musicOn ? '배경음악 끄기' : '배경음악 켜기'}>{musicOn ? '♪ 음악' : '♪ 음악 끔'}</button>
        <button className={`${s.topBtn} ${s.glass}`} aria-pressed={sfxOn} onClick={toggleSfx} aria-label={sfxOn ? '반응 소리 끄기' : '반응 소리 켜기'}>{sfxOn ? '🔊 소리' : '🔇 소리 끔'}</button>
        {!scene.embed && <button className={`${s.topBtn} ${s.glass}`} aria-pressed={lite} onClick={() => switchLite(!lite)}>{lite ? '가벼운 모드 켜짐' : '가벼운 모드'}</button>}
        {isAdmin && <a className={`${s.topBtn} ${s.glass}`} href="/admin/castle-beta">미리보기 학생</a>}
        <a className={`${s.topBtn} ${s.glass}`} href="/student" aria-label="3D 모드 끄기" onClick={() => { try { localStorage.setItem('2hs_home_mode', 'classic') } catch {} }}>
          3D 모드 <span aria-hidden="true" style={{ display: 'inline-block', width: 26, height: 15, borderRadius: 999, background: '#7f6bd6', verticalAlign: '-3px', marginLeft: 5, position: 'relative' }}>
            <span style={{ position: 'absolute', top: 2, right: 2, width: 11, height: 11, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
          </span>
        </a>
      </div>

      {fallback && (
        <div className={s.fallback} role="dialog" aria-label="3D 화면 안내">
          <div className={`${s.fallbackCard} ${s.glass}`}>
            <div className={s.todayTitle}>
              {fallback === 'nowebgl' ? '이 기기에서는 3D 화면을 그릴 수 없어요' : fallback === 'lost' ? '3D 화면이 잠시 멈췄어요' : '이 기기에서는 3D 화면이 조금 느려요'}
            </div>
            <div className={s.muted}>예전 홈은 그대로 있어요. 메뉴는 아래에서 그대로 쓸 수 있어요.</div>
            <div className={s.row}>
              {fallback !== 'nowebgl' && <button className={`${s.chip} ${s.glass}`} onClick={() => switchLite(true)}>가벼운 모드로 다시</button>}
              <a className={s.primary} style={{ flex: 1 }} href="/student">예전 홈으로</a>
            </div>
            {fallback === 'slow' && <button className={s.linkBtn} onClick={() => setFallback(null)}>그냥 이대로 볼게요</button>}
          </div>
        </div>
      )}

      <div className={s.mast}>
        <div className={s.mastTitle}>2HOSUN<br />STUDIO</div>
        <div className={s.mastSub}>Castle Jelly · 2호선 스튜디오 화실</div>
      </div>

      {/* 위 — 이번 주 일정 */}
      <section className={`${s.week} ${s.glass}`} aria-label="이번 주 일정">
        <div className={s.weekHead}><span>이번 주 일정</span><a href="/student/calendar">달력 전체 보기 →</a></div>
        <div className={s.days}>
          {week.map(d => (
            <button key={d.key} onClick={() => openBooking(d.key)} aria-label={`${d.num}일 예약하기`} className={`${s.day} ${d.today ? s.today : ''}`}>
              <span className={s.dayDow}>{d.today ? '오늘' : d.dow}</span>
              <span className={s.dayNum}>{d.num}</span>
              <span className={s.dot} style={{ background: d.dot }} />
            </button>
          ))}
        </div>
      </section>

      {/* 왼쪽(모바일 = 아래 시트) — 수업 */}
      {!classesOpen && !booking && (
        <button className={`${s.classesBtn} ${s.glass}`} aria-expanded={false} aria-controls="castle-classes" onClick={() => toggleClasses(true)}>
          <span className={s.classesDots} aria-hidden="true">{groups.slice(0, 6).map(g => <span key={g.cat} style={{ background: CAT[g.cat]?.dot || '#ccc' }} />)}</span>
          <span className={s.classesText}><b>수업 둘러보기</b><span>{groups.length ? `${groups.reduce((n, g) => n + g.names.length, 0)}개 수업 · 눌러서 펼치기` : '눌러서 펼치기'}</span></span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={s.classesChevron}><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}
      <nav id="castle-classes" className={`${s.left} ${s.glass} ${classesOpen ? '' : s.leftClosed}`} aria-label="수업" aria-hidden={!classesOpen}>
        <div className={s.sheetHandle} />
        <div className={s.leftHead}>
          <div className={s.sectionLabel}>수업</div>
          <button className={s.foldBtn} aria-label="수업 접기" aria-expanded={true} aria-controls="castle-classes" onClick={() => toggleClasses(false)}>
            접기
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        </div>
        {groups.length === 0 && <div className={s.muted} style={{ padding: '6px 8px' }}>열린 수업을 불러오는 중…</div>}
        {groups.map(g => (
          <div key={g.cat}>
            <div className={s.cat}><span className={s.catDot} style={{ background: CAT[g.cat]?.dot || '#ccc' }} />{CAT[g.cat]?.name || g.cat}</div>
            {g.names.map(n => <a key={n} className={s.course} href={`/student/curriculum?course=${encodeURIComponent(n)}`}>{n}</a>)}
          </div>
        ))}
      </nav>

      {/* 오른쪽 — 오늘 + 장면 (모바일: 「장면」 버튼으로 펼침) */}
      <button className={`${s.sceneBtn} ${s.glass}`} aria-label={sceneOpen ? '장면 조절 닫기' : '장면 조절 열기'} aria-expanded={sceneOpen} onClick={() => setSceneOpen(v => !v)}>
        <Icon d={<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>} />
      </button>
      <aside className={`${s.right} ${s.glass} ${sceneOpen ? s.rightOpen : ''}`} style={booking ? { visibility: 'hidden' } : undefined} aria-label="오늘과 장면 조절">
        <div className={s.todayBlock}>
          <div className={s.sectionLabel} style={{ padding: 0 }}>다음 수업</div>
          {next ? (<>
            <div className={s.todayTitle}>{next.class_name}</div>
            <div className={s.muted}>{next.class_date} · {next.class_time}</div>
          </>) : <div className={s.muted}>예약한 수업이 없어요</div>}
          {ticket && <div className={s.muted}>수강권 {ticket.remain}/{ticket.total}회 남음</div>}
          <button className={s.primary} onClick={() => openBooking()}>수업 예약하기</button>
          <div className={s.hr} style={{ marginTop: 6 }} />
        </div>
        <div className={s.sectionLabel} style={{ padding: 0 }}>3D 배경</div>
        <div className={s.row} style={{ flexWrap: 'wrap' }}>
          {CASTLE_SCENES.filter(sc => sc.ready).map(sc => {
            const open = sceneUnlocked(sc.key, { attended, unlockAll: isAdmin })
            return (
              <button key={sc.key} className={`${s.chip} ${s.glass} ${bgScene === sc.key ? s.chipOn : ''}`} aria-pressed={bgScene === sc.key}
                disabled={!open} onClick={() => chooseScene(sc.key)} style={open ? undefined : { opacity: 0.55 }}
                aria-label={open ? `${sc.name} 배경` : `${sc.name} · 출석 ${sc.unlock}회에 열려요`}>
                {open ? sc.name : `🔒 출석 ${sc.unlock}회`}
              </button>
            )
          })}
        </div>
        {!isAdmin && <div className={s.muted}>수업에 출석할 때마다 새 배경이 열려요 · 지금 출석 {attended}회</div>}
        <div className={s.hr} style={{ marginTop: 2 }} />
        {scene.key === 'peak' ? (<>
        <div className={s.sectionLabel} style={{ padding: 0 }}>{scene.name}</div>
        <label className={s.slider}>눈 양
          <input type="range" min="0" max="1" step="0.01" value={peak.snow} onChange={e => setPeakOpt({ snow: +e.target.value })} style={{ accentColor: '#9fb8d6' }} />
        </label>
        <label className={s.slider}>기차 빠르기
          <input type="range" min="0" max="1" step="0.01" value={peak.speed} onChange={e => setPeakOpt({ speed: +e.target.value })} style={{ accentColor: '#c8323a' }} />
        </label>
        <div className={s.row} style={{ flexWrap: 'wrap' }}>
          <button className={`${s.chip} ${s.glass}`} onClick={() => toFrame({ cmd: 'whistle' })}>기적 울리기</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => toFrame({ cmd: 'pause' })}>기차 멈춤·출발</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => toFrame({ cmd: 'reset' })}>제자리로</button>
        </div>
        </>) : scene.key === 'octopus' ? (<>
        <div className={s.sectionLabel} style={{ padding: 0 }}>{scene.name}</div>
        <div className={s.row} style={{ flexWrap: 'wrap' }}>
          {OCTO_LIST.map(([id, label, c]) => (
            <button key={id} className={`${s.chip} ${s.glass} ${octo.flavour === id ? s.chipOn : ''}`} aria-pressed={octo.flavour === id}
              onClick={() => setOctoOpt({ flavour: id })}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
        <div className={s.row} style={{ flexWrap: 'wrap' }}>
          {OCTO_ACTS.map(([cmd, label]) => (
            <button key={cmd} className={`${s.chip} ${s.glass}`} onClick={() => toFrame({ cmd })}>{label}</button>
          ))}
        </div>
        <label className={s.slider}>말랑 ↔ 단단
          <input type="range" min="0" max="1" step="0.01" value={octo.firm} onChange={e => setOctoOpt({ firm: +e.target.value })} style={{ accentColor: '#d81e4f' }} />
        </label>
        <label className={s.slider}>출렁임 잦아듦
          <input type="range" min="0" max="1" step="0.01" value={octo.damp} onChange={e => setOctoOpt({ damp: +e.target.value })} style={{ accentColor: '#9be3c4' }} />
        </label>
        <label className={s.slider}>조명 각도
          <input type="range" min="0" max="1" step="0.01" value={octo.light} onChange={e => setOctoOpt({ light: +e.target.value })} style={{ accentColor: '#f5c04a' }} />
        </label>
        <div className={s.row}>
          <button className={`${s.chip} ${s.glass}`} onClick={() => toFrame({ cmd: 'reset' })}>제자리로</button>
        </div>
        </>) : scene.embed ? (<>
        <div className={s.sectionLabel} style={{ padding: 0 }}>{scene.name}</div>
        <div className={s.row} style={{ flexWrap: 'wrap' }}>
          {CITRUS_LIST.map(([id, label, c]) => (
            <button key={id} className={`${s.chip} ${s.glass} ${citrusVariety === id ? s.chipOn : ''}`} aria-pressed={citrusVariety === id}
              onClick={() => setCitrusOpt({ variety: id })}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
        <label className={s.slider}>흐물거림 ↔ 단단함
          <input type="range" min="0" max="1" step="0.01" value={citrus.firm} onChange={e => setCitrusOpt({ firm: +e.target.value })} style={{ accentColor: '#f5a04a' }} />
        </label>
        <label className={s.slider}>출렁임 잦아듦(내부 감쇠)
          <input type="range" min="0" max="1" step="0.01" value={citrus.damp} onChange={e => setCitrusOpt({ damp: +e.target.value })} style={{ accentColor: '#9be3c4' }} />
        </label>
        <div className={s.row}>
          <button className={`${s.chip} ${s.glass}`} onClick={() => toFrame({ cmd: 'nudge' })}>살짝 튕기기</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => toFrame({ cmd: 'reset' })}>제자리로</button>
        </div>
        </>) : (<>
        <div className={s.sectionLabel} style={{ padding: 0 }}>장면</div>
        <label className={s.slider}>낮 · 노을 · 밤
          <input type="range" min="0" max="1" step="0.01" value={look.timeOfDay} onChange={e => setL({ timeOfDay: +e.target.value })} style={{ accentColor: '#b49ae8' }} />
        </label>
        <label className={s.slider}>폭포 세기
          <input type="range" min="0" max="1" step="0.01" value={look.flow} onChange={e => setL({ flow: +e.target.value })} style={{ accentColor: '#8fb8f0' }} />
        </label>
        <label className={s.slider}>젤리 단단함
          <input type="range" min="0" max="1" step="0.01" value={look.firmness} onChange={e => setL({ firmness: +e.target.value })} style={{ accentColor: '#f08fb3' }} />
        </label>
        <label className={s.slider}>물결 잦아듦
          <input type="range" min="0" max="1" step="0.01" value={look.damping} onChange={e => setL({ damping: +e.target.value })} style={{ accentColor: '#9be3c4' }} />
        </label>
        <div className={s.row}>
          {FLAVOUR_LIST.map(([id, label, c]) => (
            <button key={id} className={`${s.chip} ${s.glass} ${look.flavour === id ? s.chipOn : ''}`} aria-pressed={look.flavour === id}
              onClick={() => setL({ flavour: id })}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
        <div className={s.row}>
          <button className={`${s.chip} ${s.glass}`} onClick={() => commandRef.current?.fireworks()}>불꽃놀이</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => setBridgeUp(commandRef.current?.toggleBridge() ?? false)}>{bridgeUp ? '다리 내리기' : '다리 올리기'}</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => commandRef.current?.tip()}>흔들기</button>
        </div>
        <div className={s.row}>
          <button className={`${s.chip} ${s.glass}`} onClick={() => commandRef.current?.salute()}>왕실 예포</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => commandRef.current?.coin()}>소원 동전</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => commandRef.current?.ball()}>공 던지기</button>
        </div>
        </>)}
      </aside>

      {/* 누른 곳 → 들어가기 */}
      {pick && (
        <a className={s.pick} href={pick.href} style={{ left: pick.x, top: pick.y }}
          onClick={e => { if (pick.booking) { e.preventDefault(); openBooking() } else setPick(null) }}>{pick.label}</a>
      )}

      {booking && (
        <BookingPanel key={booking.date} user={user} initialDate={booking.date} onClose={() => setBooking(null)}
          onBooked={() => { if (user) loadMine(user) }} />
      )}

      {/* 아래 — 기타 기능 */}
      <nav className={`${s.dock} ${s.glass}`} aria-label="기타 기능">
        {DOCK.map(d => (
          <a key={d.href} href={d.href} className={`${s.dockItem} ${s.glass}`} aria-label={d.label === '알림' && unread ? `알림 ${unread}개` : d.label}>
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon d={d.icon} />
              {d.label === '알림' && unread > 0 && <span className={s.badgeDot}>{unread > 99 ? '99+' : unread}</span>}
            </span>
            {d.label}
          </a>
        ))}
      </nav>

      <div className={s.howto}><b>How to play</b> — {scene.key === 'peak'
        ? '기차를 누르면 기적 · 집을 누르면 불 켜고 끄기 · 소나무를 누르면 눈이 털려요 · 끌어서 섬 돌리기 · 꼬집어 확대'
        : scene.key === 'octopus'
        ? '문어를 톡 치면 움찔 · 머리를 꾹 누르면 납작 · 머리를 끌어 들어 올리기 · 다리를 끌어 늘리기 · 접시를 꾹 누르고 있으면 다리가 손가락을 감아요'
        : scene.embed
        ? '젤리를 잡아 늘렸다가 놓아 보기 · 오른쪽 장면 패널에서 오렌지 · 블러드 오렌지 · 레몬'
        : '탑·성문·배·화로·냥이를 눌러 들어가기 · 물을 끌어 물결 · 블록 옆면을 끌어 기울이기 · 소나무를 끌어 휘기 · 빈 곳을 끌어 돌려 보기'}</div>
    </div>
  )
}
