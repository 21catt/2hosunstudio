'use client'
// /castle/farm — 3D 냥밭 **숨긴 미리보기** (2026-10-20)
//
// 사용자 지시: "냥밭 3D 미리보기 방향 좋아. /castle 처럼 숨긴 미리보기 페이지로 실제 냥밭 데이터(수확·잡초·농부냥)와 연결해서".
//   · 열리는 사람 = /castle 과 같다(관리자 · user_metadata.castle_beta). 그 밖은 기존 냥밭으로 돌려보낸다.
//   · 데이터 = 기존 냥밭(/student/farm)과 **같은 기록**: 출석 → 작물 포인트, user_prefs.harvest_count · weed_state · farm_cat.
//     규칙은 lib/farmProgress(작물 단계·수강권·잡초 뽑기) + lib/weeds(잡초 성장) — 두 화면이 한 규칙이라 어느 쪽에서 해도 같다.
//   · 비·밤은 꾸밈이다(작물은 출석으로만 자란다). 기존 냥밭은 무변경.
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { FARM_CATS, getSavedFarmCat, isValidFarmCat, CROP_STAGES, getSavedHarvest, saveHarvestLocal } from '../../../lib/farmCats'
import { WEED, weedStage, tickWeeds } from '../../../lib/weeds'
import { cropProgress, farmTicketValid, pullWeed, CROP_PLOTS } from '../../../lib/farmProgress'
import { notifyStaff } from '../../../lib/adminNotify'
import { useTodayWeather } from '../../../components/WeatherBar'
import ColorMixGame from '../../../components/ColorMixGame'
import ColorTetrisGame from '../../../components/ColorTetrisGame'
import LoadingCat from '../../../components/LoadingCat'
import CatTalk from '../../../components/CatTalk'
import s from './farm3d.module.css'

const FarmScene = dynamic(() => import('../../../components/farm3d/FarmScene'), { ssr: false })

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const isPrecip = c => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95 || (c >= 71 && c <= 77) || c === 85 || c === 86

export default function Farm3DPage() {
  const router = useRouter()
  const todayStr = ymd(new Date())
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [isArtist, setIsArtist] = useState(false)
  const [attended, setAttended] = useState(0)
  const [harvest, setHarvest] = useState(0)
  const [farmCat, setFarmCat] = useState('watering')
  const [ticketValid, setTicketValid] = useState(false)
  const [weeds, setWeeds] = useState([])
  const [weedRemoved, setWeedRemoved] = useState(0)
  const [weedReward, setWeedReward] = useState(false)
  const [, setTickN] = useState(0)
  const [night, setNight] = useState(() => { const h = new Date().getHours(); return h >= 19 || h < 6 })
  const [rainKey, setRainKey] = useState(0)
  const [walkKey, setWalkKey] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [tag, setTag] = useState(null)       // { text, x, y }
  const [floats, setFloats] = useState([])   // [{ id, text, x, y }]
  const [shedOpen, setShedOpen] = useState(false)
  const [mixOpen, setMixOpen] = useState(false)
  const [tetrisOpen, setTetrisOpen] = useState(false)
  const weedRef = useRef(null)
  const harvestRef = useRef(0)
  const ticketValidRef = useRef(false)
  const userRef = useRef(null)
  const devRef = useRef(false)
  const busyRef = useRef(false)
  const tagTimer = useRef(0)
  const weather = useTodayWeather()

  useEffect(() => {
    setFarmCat(getSavedFarmCat())
    const h = getSavedHarvest(); setHarvest(h); harvestRef.current = h
    setReducedMotion(!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  }, [])

  // 들어올 수 있는 사람 = /castle 과 같다
  useEffect(() => {
    // 로컬 개발에서만: ?dev=1 이면 로그인 없이 예시 밭(배포 빌드에선 이 분기가 없다 — 저장도 안 한다)
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('dev') === '1') {
      devRef.current = true
      const now = Date.now()
      const demo = { weeds: [
        { id: 'd1', born: now - 22 * 3600e3, x: 14, y: 70 }, { id: 'd2', born: now - 20 * 3600e3, x: 80, y: 84 },
        { id: 'd3', born: now - 8 * 3600e3, x: 30, y: 88 }, { id: 'd4', born: now - 1 * 3600e3, x: 70, y: 64 },
      ], removed: 41, lastSpawn: now, penaltyCharged: false, rewarded: false }
      weedRef.current = demo; setWeeds(demo.weeds); setWeedRemoved(41)
      setAttended(11); setHarvest(1); harvestRef.current = 1
      setTicketValid(true); ticketValidRef.current = true
      setAllowed(true); setLoading(false)
      return
    }
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user
      if (!u) { window.location.replace('/student/farm'); return } // 비가입자 = 냥밭 안내(가입 후 수업 신청)
      setUser(u); userRef.current = u
      setIsArtist(u.user_metadata?.role === 'artist')
      setAllowed(true)
      loadData(u.id).catch(e => { console.error('farm3d load failed', e); setLoading(false) })
    })
  }, []) // eslint-disable-line

  async function loadData(userId) {
    const [{ data: b }, { data: pref }, { data: tk }] = await Promise.all([
      supabase.from('bookings').select('attended, class_date').eq('user_id', userId).neq('status', 'cancelled'),
      supabase.from('user_prefs').select('*').eq('user_id', userId).single(),
      supabase.from('tickets').select('*').eq('user_id', userId).limit(1),
    ])
    setAttended((b || []).filter(h => h.attended === true).length)
    if (isValidFarmCat(pref?.farm_cat)) setFarmCat(pref.farm_cat)
    if (Number.isFinite(pref?.harvest_count) && pref.harvest_count >= 0) {
      setHarvest(pref.harvest_count); saveHarvestLocal(pref.harvest_count); harvestRef.current = pref.harvest_count
    }
    const valid = farmTicketValid(tk?.[0], todayStr)
    setTicketValid(valid); ticketValidRef.current = valid
    const { state, cropLoss } = tickWeeds(pref?.weed_state, Date.now(), valid)
    weedRef.current = state
    setWeeds(state.weeds); setWeedRemoved(state.removed)
    if (cropLoss > 0) applyCropLoss(cropLoss)
    persistWeeds(state)
    setLoading(false)
  }

  // 저장 — 기존 냥밭과 같은 칸(weed_state 컬럼이 없으면 조용히 무시)
  function persistWeeds(state) {
    const id = userRef.current?.id
    if (!id || devRef.current) return
    supabase.from('user_prefs').upsert({ user_id: id, weed_state: state }).then(() => {}, () => {})
  }
  function saveHarvest(n) {
    harvestRef.current = n
    setHarvest(n); saveHarvestLocal(n)
    const id = userRef.current?.id
    if (id && !devRef.current) supabase.from('user_prefs').upsert({ user_id: id, harvest_count: n })
  }
  // 완전 성장 잡초 10개↑ → 수확 작물 1개 소멸
  function applyCropLoss(n) {
    saveHarvest(Math.max(0, harvestRef.current - n))
    floatText('🥀 작물 -1', window.innerWidth / 2, 120)
  }

  // 열려 있는 동안 1분마다 잡초 성장·돋아나기
  useEffect(() => {
    if (loading) return
    const iv = setInterval(() => {
      const prev = weedRef.current
      if (!prev) return
      const { state, cropLoss } = tickWeeds(prev, Date.now(), ticketValidRef.current)
      weedRef.current = state
      setWeeds(state.weeds); setWeedRemoved(state.removed); setTickN(x => x + 1)
      if (cropLoss > 0) applyCropLoss(cropLoss)
      if (cropLoss > 0 || state.lastSpawn !== prev.lastSpawn || state.weeds.length !== prev.weeds.length) persistWeeds(state)
    }, 60 * 1000)
    return () => clearInterval(iv)
  }, [loading]) // eslint-disable-line

  // 오늘 실제로 비·눈이 오면 밭에도 가끔 내린다
  useEffect(() => {
    if (!weather || !isPrecip(weather.code)) return
    setRainKey(k => k + 1)
    const iv = setInterval(() => setRainKey(k => k + 1), 14000)
    return () => clearInterval(iv)
  }, [weather])

  function showTag(text, x, y) {
    setTag({ text, x, y })
    clearTimeout(tagTimer.current)
    tagTimer.current = setTimeout(() => setTag(null), 1800)
  }
  function floatText(text, x, y) {
    const id = Date.now() + Math.random()
    setFloats(f => [...f, { id, text, x, y }])
    setTimeout(() => setFloats(f => f.filter(e => e.id !== id)), 1200)
  }

  const activeCat = FARM_CATS.find(c => c.key === farmCat) || FARM_CATS[0]
  const { cropPoints, cropReady, plotStage } = cropProgress({ attended, isArtist, harvest })
  const plots = Array.from({ length: CROP_PLOTS }, (_, i) => ({ stage: plotStage(i) }))
  const now = Date.now()
  const weedView = ticketValid ? weeds.map(w => {
    const stage = weedStage(w, now)
    return { id: w.id, x: w.x, y: w.y, stage, removable: stage >= WEED.REMOVABLE_STAGE }
  }) : []
  const frontStage = plotStage(0)
  const cropLine = cropReady ? `${activeCat.cropName} 수확할 수 있어요` : frontStage === 0 ? '출석하면 자라요' : `${activeCat.cropName} ${frontStage}/${CROP_STAGES} 성장`

  function harvestFront(x, y) {
    if (!cropReady || busyRef.current) return
    busyRef.current = true
    saveHarvest(harvestRef.current + 1)
    floatText(`+1 ${activeCat.cropName}`, x, y - 10)
    setWalkKey(k => k + 1)
    setTimeout(() => { busyRef.current = false }, 400)
  }

  function onPick(kind, data, x, y) {
    if (kind === 'plot') {
      const i = data.plot
      const st = plotStage(i)
      if (i === 0 && cropReady) return harvestFront(x, y)
      if (st === 0) return showTag(i === 0 ? '빈 밭 · 출석하면 자라요' : '빈 밭 · 앞 칸이 다 자라면 이어서 자라요', x, y)
      if (st >= CROP_STAGES) return showTag(`${activeCat.cropName} · 다 익었어요 (앞 칸부터 수확)`, x, y)
      return showTag(`${activeCat.cropName} · ${st}/${CROP_STAGES} 성장 — 출석 ${CROP_STAGES - st}번 더`, x, y)
    }
    if (kind === 'weed') {
      const w = weedRef.current?.weeds.find(v => v.id === data.id)
      if (!w) return
      const r = pullWeed(weedRef.current, w, Date.now())
      if (!r) return showTag(`잡초 ${weedStage(w, Date.now())}/${WEED.STAGES} · ${WEED.REMOVABLE_STAGE}단계부터 뽑아요`, x, y)
      weedRef.current = r.state
      setWeeds(r.state.weeds); setWeedRemoved(r.state.removed)
      floatText('뽑았다!', x, y - 10)
      if (r.gotReward) { setWeedReward(true); notifyWeedReward(r.state.removed) }
      persistWeeds(r.state)
      return
    }
    if (kind === 'shed') return setShedOpen(true)
    if (kind === 'cat') { if (talkRef.current) return talkRef.current.next(); return showTag(`${activeCat.name} · 오늘도 밭일 중`, x, y) }
    if (kind === 'bird') return showTag(data.landed ? '새가 작물을 쪼아요 — 냥이가 쫓아가요!' : '새가 날아와요', x, y)
    if (kind === 'bird-shoo') return floatText('훠이!', x, y - 10)
    if (kind === 'mole') return floatText(`두더지 잡았다! ${data.caught}`, x, y - 10)
    if (kind === 'worm') return showTag('지렁이 · 흙을 좋게 해 줘요 (그냥 두어도 돼요)', x, y)
    if (kind === 'cloud') return showTag('비가 와요 (꾸밈 · 작물은 출석으로 자라요)', x, y)
    if (kind === 'sun') return showTag(night ? '달빛이 번져요' : '햇살이 번져요 ☀️', x, y)
  }

  // 잡초 500개 → 운영진 알림(선물을 건네는 쪽이 스튜디오다). 보상 플래그가 처음 켜질 때 한 번만.
  async function notifyWeedReward(count) {
    if (devRef.current) return
    try {
      const u = userRef.current
      let nm = u?.user_metadata?.name
      if (!nm && u?.id) { const { data } = await supabase.from('users').select('name').eq('id', u.id).maybeSingle(); nm = data?.name }
      await notifyStaff({ type: 'weed_reward', title: '🎁 잡초 500개 달성', body: `${nm || '수강생'}님이 냥밭 잡초 ${count}개를 뽑았어요.\n드로잉노트 + 연필을 준비해 주세요.` })
    } catch {}
  }

  // 냥이 말풍선 재료 — 밭 소식(익음·자람·잡초). 값이 같으면 같은 객체(말풍선이 처음으로 안 돌아가게)
  const removableWeeds = weedView.filter(w => w.removable).length
  const catAnchorRef = useRef(null), talkRef = useRef(null) // 장면 속 냥이 머리 위 자리 · 냥이를 눌렀을 때 다음 말
  const talkCat = useMemo(() => ({ name: activeCat.name, img: activeCat.img }), [activeCat.name, activeCat.img])
  const talkFarm = useMemo(() => ({ cropName: activeCat.cropName, ready: cropReady, stage: frontStage, stages: CROP_STAGES, weeds: removableWeeds }),
    [activeCat.cropName, cropReady, frontStage, removableWeeds])

  if (!allowed || loading) return <LoadingCat />

  const pending = weedView.filter(w => w.removable).length
  return (
    <div className={`${s.root} ${night ? s.night : ''}`}>
      {fallback ? (
        <div className={s.fallback}>
          <p>이 기기에서는 3D 냥밭을 그릴 수 없어요.</p>
          <a href="/student/farm" className={s.btn}>기존 냥밭으로</a>
        </div>
      ) : (
        <FarmScene plots={plots} crop={activeCat.crop} catImg={activeCat.img} weeds={weedView}
          night={night} rainKey={rainKey} walkKey={walkKey} reducedMotion={reducedMotion}
          catAnchorRef={catAnchorRef} onPick={onPick} onFail={() => setFallback(true)} />
      )}

      <div className={s.mast}><h1>2HOSUN<br />STUDIO</h1><p>냥밭 · 3D 미리보기</p></div>
      <nav className={s.top}>
        <a href="/castle" className={`${s.topBtn} ${s.glass}`}>← 3D 홈</a>
        <a href="/student/farm" className={`${s.topBtn} ${s.glass}`}>기존 냥밭</a>
      </nav>

      <section className={`${s.panel} ${s.glass}`} aria-label="냥밭 현황">
        <div className={s.stats}>
          <div className={s.stat}><b>{harvest}</b><span>수확한 작물</span></div>
          <div className={s.stat}><b>{weedRemoved}</b><span>뽑은 잡초</span></div>
          <div className={s.stat}><b className={s.small}>{weather ? `${weather.icon} ${weather.temp}°` : '—'}</b><span>오늘 날씨</span></div>
        </div>
        <div className={s.crop}>
          <img src={activeCat.img} alt="" />
          <div>
            <b>{activeCat.name}</b>
            <span>{cropLine}</span>
            <span className={s.muted}>총 {attended * (isArtist ? 2 : 1)}pt · 밭에 남은 {cropPoints}pt</span>
          </div>
        </div>
        {cropReady && (
          <button className={`${s.btn} ${s.primary}`} onClick={e => harvestFront(e.clientX, e.clientY)}>
            {activeCat.cropName} 수확하기
          </button>
        )}
        <div className={s.weedLine}>
          {ticketValid
            ? (pending > 0 ? `뽑을 수 있는 잡초 ${pending}개 — 빨간 고리를 눌러요` : `잡초 ${weedView.length}개 자라는 중`)
            : '수강권이 있을 때 잡초가 자라요'}
        </div>
        {weedReward && <div className={s.reward}>🎁 잡초 {WEED.REWARD_AT}개! 드로잉노트 + 연필을 받으러 오세요</div>}
        <div className={s.row}>
          <button className={s.btn} onClick={() => setRainKey(k => k + 1)}>비 내리기</button>
          <button className={s.btn} onClick={() => setNight(n => !n)}>{night ? '낮으로' : '밤으로'}</button>
        </div>
        <a href="/student/settings" className={s.link}>농부냥 바꾸기 · 설정</a>
      </section>

      <div className={s.how}><b>How to play</b> — 다 익은 앞 칸 작물을 눌러 수확 · 빨간 고리 잡초를 눌러 뽑기 · 튀어나온 두더지를 눌러 잡기 · 새가 오면 냥이가 쫓아요(새를 누르면 바로) · 헛간 = 미니게임 · 빈 곳을 끌어 섬 돌려 보기</div>
      {!fallback && !shedOpen && !mixOpen && !tetrisOpen && (devRef.current || user) &&
        <CatTalk place="farm" user={user} cat={talkCat} farm={talkFarm} anchorRef={catAnchorRef} controlRef={talkRef} />}
      <div className={s.badge}>미리보기 · 기존 냥밭과 같은 기록이에요</div>

      {tag && <div className={s.tag} style={{ left: tag.x, top: tag.y }}>{tag.text}</div>}
      {floats.map(f => <div key={f.id} className={s.float} style={{ left: f.x, top: f.y }}>{f.text}</div>)}

      {shedOpen && (
        <div className={s.sheetWrap} onClick={() => setShedOpen(false)}>
          <div className={`${s.sheet} ${s.glass}`} onClick={e => e.stopPropagation()} role="dialog" aria-label="헛간 · 미니게임">
            <b className={s.sheetTitle}>헛간 · 미니게임</b>
            <button className={s.btn} onClick={() => { setShedOpen(false); setMixOpen(true) }}>조색 게임</button>
            <button className={s.btn} onClick={() => { setShedOpen(false); setTetrisOpen(true) }}>색채 테트리스</button>
            <button className={s.linkBtn} onClick={() => setShedOpen(false)}>닫기</button>
          </div>
        </div>
      )}
      <ColorMixGame open={mixOpen} onClose={() => setMixOpen(false)} />
      <ColorTetrisGame open={tetrisOpen} onClose={() => setTetrisOpen(false)} />
    </div>
  )
}
