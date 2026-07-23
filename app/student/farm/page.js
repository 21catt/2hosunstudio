'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import ProfileHeaderIcon from '../../../components/ProfileHeaderIcon'
import { FARM_CATS, getSavedFarmCat, isValidFarmCat, CROP_STAGES, cropImg, getSavedHarvest, saveHarvestLocal } from '../../../lib/farmCats'
import { WEED, weedImg, weedStage, tickWeeds } from '../../../lib/weeds'
import LoadingCat from '../../../components/LoadingCat'
import ColorMixGame from '../../../components/ColorMixGame'

// 테마별 픽셀 냥밭 환경 — ground는 이미지 하단 지면 픽셀 색과 동일(이음매 방지)
const FARM_ENV = {
  ultra: { img: '/farm/ultra.png', ground: '#7CE8A4' },
  line2: { img: '/farm/line2.png', ground: '#D3EF6B' },
  ink:   { img: '/farm/ink.png',   ground: '#FF6A2B' },
  lilac: { img: '/farm/lilac.png', ground: '#FF9AC9' },
  burgundy: { img: '/farm/burgundy.png', ground: '#A9CEE0' },
  palu:     { img: '/farm/palu.png',     ground: '#E7A24E' },
  sage:     { img: '/farm/sage.png',     ground: '#E8C64F' },
  midgreen: { img: '/farm/midgreen.png', ground: '#B4DDA6' },
}

// 픽셀 구름 5종 — [x, y, w, h] 사각형 조합 (56x22 그리드)
const CLOUD_SHAPES = [
  [[10,8,26,6],[0,12,44,8],[32,4,14,8]],
  [[0,10,52,9],[8,4,20,8],[34,6,14,6]],
  [[6,12,40,8],[16,6,24,7],[0,14,10,6]],
  [[0,8,30,10],[24,12,28,7],[10,2,16,8]],
  [[4,10,48,8],[28,3,18,9],[0,6,14,7]],
]

// 흘러가는 픽셀 구름 — 방향·속도 랜덤(느리게), 누르면 그 자리에 비
function DriftCloud({ shape, top, dur, dir, scale, delay, onRain }) {
  return (
    <svg width={56 * scale} height={22 * scale} viewBox="0 0 56 22" onClick={onRain}
      className={dir === 1 ? 'drift-r' : 'drift-l'}
      style={{ position:'absolute', top:`${top}%`, left:0, cursor:'pointer', zIndex:2, animationDuration:`${dur}s`, animationDelay:`${delay}s` }}>
      {CLOUD_SHAPES[shape].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="var(--g1)" />
      ))}
    </svg>
  )
}

// 날개짓하는 픽셀 새 — 두 프레임(∧/∨)을 번갈아 깜빡여 퍼덕임, 누르면 짹짹
function FlapBird({ top, dur, dir, delay, onChirp }) {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" onClick={onChirp}
      className={dir === 1 ? 'drift-r' : 'drift-l'}
      style={{ position:'absolute', top:`${top}%`, left:0, cursor:'pointer', zIndex:3, animationDuration:`${dur}s`, animationDelay:`${delay}s` }}>
      <path className="wing-a" d="M1 10 L7 3 L13 10 M13 10 L19 3 L25 10" stroke="var(--g5)" strokeWidth="2.4" fill="none"/>
      <path className="wing-b" d="M1 4 L7 10 L13 4 M13 4 L19 10 L25 4" stroke="var(--g5)" strokeWidth="2.4" fill="none"/>
    </svg>
  )
}

// 돌아다니며 일하는 픽셀 농부냥 — 랜덤 지점으로 걷고, 도착하면 자기 일을 한다.
// act: 'water'(물주기) | 'dig'(밭갈기) | 'seed'(씨뿌리기). 탭하면 그 자리에서 바로 일한다.
function FarmerCat({ img, bottom, size, act, z = 6, onFx }) {
  const [x, setX] = useState(20)
  const [dir, setDir] = useState(1)
  const [working, setWorking] = useState(false)
  const [dur, setDur] = useState(2)
  const xRef = useRef(20)
  const busyRef = useRef(false)

  useEffect(() => {
    let alive = true, timer
    function walk() {
      if (!alive) return
      const target = 4 + Math.random() * 78
      const sec = Math.max(1.2, Math.abs(target - xRef.current) / 14)
      setDir(target >= xRef.current ? 1 : -1)
      setDur(sec)
      setX(target)
      xRef.current = target
      timer = setTimeout(work, sec * 1000)
    }
    function work() {
      if (!alive) return
      busyRef.current = true
      setWorking(true)
      onFx(act, xRef.current, bottom, size)
      timer = setTimeout(() => {
        if (!alive) return
        busyRef.current = false
        setWorking(false)
        timer = setTimeout(walk, 500 + Math.random() * 1500)
      }, 1500)
    }
    timer = setTimeout(walk, Math.random() * 1200)
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  return (
    <div
      onClick={() => {
        if (busyRef.current) return
        busyRef.current = true
        setWorking(true)
        onFx(act, xRef.current, bottom, size)
        setTimeout(() => { busyRef.current = false; setWorking(false) }, 1200)
      }}
      style={{ position:'absolute', left:`${x}%`, bottom, width:size, zIndex:z, cursor:'pointer', transition:`left ${dur}s linear` }}>
      <span style={{ display:'block', transform:`scaleX(${dir})` }}>
        <img src={img} alt="농부냥" width={size} className={working ? 'cat-work' : 'cat-walk'}
          style={{ display:'block', width:'100%', imageRendering:'pixelated' }} />
      </span>
    </div>
  )
}



export default function FarmPage() {
  const router = useRouter()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const [user, setUser] = useState(null)
  const [harvest, setHarvest] = useState(0)
  const [harvestAnim, setHarvestAnim] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  // 하늘 구성: 구름 4개(모양 5종 중)·새 2마리 — 방향/속도/높이 랜덤, 마운트 시 1회 결정
  const [sky] = useState(() => {
    const shapes = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5)
    return {
      clouds: shapes.slice(0, 4).map(shape => ({
        shape,
        top: 2 + Math.random() * 16,
        dur: 55 + Math.random() * 45,
        dir: Math.random() < 0.5 ? 1 : -1,
        scale: 0.8 + Math.random() * 0.8,
        delay: -Math.random() * 60,
      })),
      birds: Array.from({ length: 2 }, () => ({
        top: 4 + Math.random() * 14,
        dur: 14 + Math.random() * 10,
        dir: Math.random() < 0.5 ? 1 : -1,
        delay: -Math.random() * 12,
      })),
    }
  })
  const [farmTheme, setFarmTheme] = useState('ultra')
  const [farmCat, setFarmCat] = useState('watering')
  const [fx, setFx] = useState([])
  // 잡초 시스템 (수강권 있을 때만 활성)
  const [ticketValid, setTicketValid] = useState(false)
  const [weeds, setWeeds] = useState([])
  const [weedRemoved, setWeedRemoved] = useState(0)
  const [weedReward, setWeedReward] = useState(false)
  const [pileBump, setPileBump] = useState(0)
  const [pileImgOk, setPileImgOk] = useState(true) // weed-pile.png 없으면 이모지 폴백
  const [, setTickN] = useState(0) // 성장 재렌더용
  const [gameOpen, setGameOpen] = useState(false) // 조색 게임 오버레이
  const weedRef = useRef(null)
  const ticketValidRef = useRef(false)
  const harvestRef = useRef(0)

  useEffect(() => { harvestRef.current = harvest }, [harvest])

  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme')
    if (FARM_ENV[t]) setFarmTheme(t)
    setFarmCat(getSavedFarmCat())
    setHarvest(getSavedHarvest())
  }, [])

  // 하늘 인터랙션 이펙트 (햇살 버스트·픽셀 비·음표) — 끝나면 자동 제거
  function spawnFx(type, extra = {}) {
    const id = Date.now() + Math.random()
    setFx(f => [...f, { id, type, ...extra }])
    setTimeout(() => setFx(f => f.filter(e => e.id !== id)), 2000)
  }

  // 하늘 요소 클릭 → 클릭한 지점(% 좌표)에 이펙트
  function skyClick(type) {
    return (e) => {
      const sc = e.currentTarget.parentElement.getBoundingClientRect()
      const x = ((e.clientX - sc.left) / sc.width) * 100
      const y = ((e.clientY - sc.top) / sc.height) * 100
      spawnFx(type, type === 'note' ? { x: x - 2, y: y - 3 } : { x, y })
    }
  }

  // 완숙 작물 수확: 흔들리며 커졌다가(화면 1/3 크기) 수확 카운트로 빠르게 쏙 들어간다
  function harvestCrop() {
    if (!cropReady || harvestAnim) return
    setHarvestAnim('grow')
    setTimeout(() => setHarvestAnim('zip'), 950)
    setTimeout(() => {
      setHarvestAnim(null)
      const n = harvest + 1
      setHarvest(n)
      saveHarvestLocal(n)
      spawnFx('plus', { x: 56, y: 1, label: `+1 ${activeCat.cropName}` })
      if (user?.id) supabase.from('user_prefs').upsert({ user_id: user.id, harvest_count: n })
    }, 1350)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  // 앱 열려 있는 동안 1분마다 잡초 성장/스폰 확인
  useEffect(() => {
    if (loading) return
    const iv = setInterval(doTick, 60 * 1000)
    return () => clearInterval(iv)
  }, [loading])

  async function loadData(userId) {
    // 초기 로딩 쿼리 병렬 발사 — 서로 독립이라 순차 대기 제거
    const [{ data: b }, { data: pref }, { data: tk }] = await Promise.all([
      supabase.from('bookings').select('*').eq('user_id', userId)
        .neq('status', 'cancelled')
        .order('class_date', { ascending: false }),
      supabase.from('user_prefs').select('*').eq('user_id', userId).single(),
      supabase.from('tickets').select('*').eq('user_id', userId).limit(1),
    ])
    const h = b || []
    setHistory(h)
    if (isValidFarmCat(pref?.farm_cat)) setFarmCat(pref.farm_cat)
    if (Number.isFinite(pref?.harvest_count) && pref.harvest_count >= 0) { setHarvest(pref.harvest_count); saveHarvestLocal(pref.harvest_count); harvestRef.current = pref.harvest_count }

    // 수강권 유효성 → 잡초 기능 on/off
    const t = tk?.[0]
    const valid = !!(t && t.remain > 0 && (!t.expires_at || t.expires_at >= todayStr))
    setTicketValid(valid); ticketValidRef.current = valid

    // 잡초 상태 로드 + 경과 시간만큼 스폰/성장·페널티 반영
    const { state, cropLoss } = tickWeeds(pref?.weed_state, Date.now(), valid)
    weedRef.current = state
    setWeeds(state.weeds); setWeedRemoved(state.removed)
    if (cropLoss > 0) applyCropLoss(cropLoss, userId)
    persistWeeds(state, userId)

    setLoading(false)
  }

  // 잡초 상태 저장 (weed_state 컬럼 없으면 조용히 무시)
  function persistWeeds(state, uid) {
    const id = uid || user?.id
    if (!id) return
    supabase.from('user_prefs').upsert({ user_id: id, weed_state: state }).then(() => {}, () => {})
  }

  // 완전 성장 잡초 10개↑ → 수확 작물 1개 소멸 (harvest_count -1)
  function applyCropLoss(n, uid) {
    const nh = Math.max(0, harvestRef.current - n)
    harvestRef.current = nh
    setHarvest(nh); saveHarvestLocal(nh)
    const id = uid || user?.id
    if (id) supabase.from('user_prefs').upsert({ user_id: id, harvest_count: nh })
    spawnFx('plus', { x: 42, y: 1, label: '🥀 작물 -1' })
  }

  // 주기적 성장/스폰 확인 (앱 열려 있을 때)
  function doTick() {
    const prev = weedRef.current
    if (!prev) return
    const { state, cropLoss } = tickWeeds(prev, Date.now(), ticketValidRef.current)
    weedRef.current = state
    setWeeds(state.weeds); setWeedRemoved(state.removed)
    setTickN(x => x + 1)
    const changed = state.lastSpawn !== prev.lastSpawn || state.weeds.length !== prev.weeds.length
    if (cropLoss > 0) applyCropLoss(cropLoss)
    if (changed || cropLoss > 0) persistWeeds(state)
  }

  // 잡초 뽑기 (4단계부터) → 제거 수 +1, 500개면 보상
  function removeWeed(w) {
    const s = weedRef.current
    if (!s) return
    if (weedStage(w, Date.now()) < WEED.REMOVABLE_STAGE) return
    const nextWeeds = s.weeds.filter(x => x.id !== w.id)
    const removed = s.removed + 1
    const gotReward = !s.rewarded && removed >= WEED.REWARD_AT
    const state = { ...s, weeds: nextWeeds, removed, rewarded: s.rewarded || removed >= WEED.REWARD_AT }
    weedRef.current = state
    setWeeds(nextWeeds); setWeedRemoved(removed); setPileBump(Date.now())
    if (gotReward) setWeedReward(true)
    persistWeeds(state)
  }


  const attended = history.filter(h => h.attended === true).length
  const absent = history.filter(h => h.class_date < todayStr && !h.attended).length
  const activeCat = FARM_CATS.find(c => c.key === farmCat) || FARM_CATS[0]
  // 참여작가는 모임 출석 1회당 2pt → 출석 2회면 작물 1개(4pt) 수확 가능. 수강생은 1회당 1pt.
  const isArtist = user?.user_metadata?.role === 'artist'
  const ptsPerAttend = isArtist ? 2 : 1
  const cropAttended = attended * ptsPerAttend
  // 남은 포인트(포인트 - 수확×4)가 앞칸부터 4점씩 순서대로 작물을 채운다.
  // 수확하면 4점 소모 → 뒷칸 작물이 한 칸씩 앞으로 당겨진 것처럼 보인다.
  const cropPoints = Math.max(0, cropAttended - harvest * CROP_STAGES)
  const cropReady = cropPoints >= CROP_STAGES

  if (loading) return <LoadingCat />

  return (
    <>
      <style>{`
        @keyframes driftR { from{transform:translateX(-110px)} to{transform:translateX(490px)} }
        @keyframes driftL { from{transform:translateX(490px)} to{transform:translateX(-110px)} }
        .drift-r { animation-name: driftR; animation-timing-function: linear; animation-iteration-count: infinite; }
        .drift-l { animation-name: driftL; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes flapKf { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
        .wing-a { animation: flapKf 0.5s steps(1, end) infinite; }
        .wing-b { animation: flapKf 0.5s steps(1, end) infinite; animation-delay: -0.25s; }
        @keyframes sunPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)} 50%{box-shadow:0 0 22px 9px rgba(255,255,255,0.55)} }
        .sun-glow { animation: sunPulse 3s ease-in-out infinite; border-radius:50%; }
        @keyframes rayOut { 0%{transform:rotate(var(--ang)) translateX(8px); opacity:1} 100%{transform:rotate(var(--ang)) translateX(52px); opacity:0} }
        .ray { position:absolute; width:9px; height:9px; animation: rayOut 0.7s ease-out forwards; }
        @keyframes dropFall { 0%{opacity:1; transform:translateY(0)} 80%{opacity:1} 100%{opacity:0; transform:translateY(330px)} }
        .drop { position:absolute; width:4px; height:11px; animation: dropFall 1.3s linear forwards; }
        @keyframes noteUp { 0%{opacity:0; transform:translateY(5px)} 25%{opacity:1} 100%{opacity:0; transform:translateY(-28px)} }
        .note { position:absolute; font-size:15px; font-weight:800; animation: noteUp 1.3s ease-out forwards; }
        @keyframes catWalk { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .cat-walk { animation: catWalk 0.45s ease-in-out infinite; }
        @keyframes catWork { 0%,100%{transform:rotate(0deg) translateY(0)} 30%{transform:rotate(-7deg) translateY(2px)} 70%{transform:rotate(6deg) translateY(1px)} }
        .cat-work { animation: catWork 0.4s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes wdropFall { 0%{opacity:1; transform:translateY(-14px)} 100%{opacity:0; transform:translateY(10px)} }
        .wdrop { position:absolute; width:4px; height:7px; border-radius:2px; animation: wdropFall 0.7s linear infinite; }
        @keyframes puffUp { 0%{opacity:0.9; transform:translateY(0) scale(0.6)} 100%{opacity:0; transform:translateY(-14px) scale(1.5)} }
        .puff { position:absolute; width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.78); animation: puffUp 0.8s ease-out infinite; }
        @keyframes seedToss { 0%{opacity:1; transform:translate(0,-6px)} 60%{opacity:1; transform:translate(var(--dx),-16px)} 100%{opacity:0; transform:translate(calc(var(--dx)*1.5), 4px)} }
        .seed { position:absolute; width:5px; height:5px; background:#D3EF6B; outline:1.5px solid var(--g5); animation: seedToss 0.9s ease-out infinite; }
        @keyframes cropGrow { 0%{transform:scale(1) rotate(0deg)} 15%{transform:scale(1.12) rotate(-6deg)} 30%{transform:scale(1.24) rotate(6deg)} 45%{transform:scale(1.36) rotate(-5deg)} 60%{transform:scale(1.46) rotate(5deg)} 75%{transform:scale(1.54) rotate(-3deg)} 100%{transform:scale(1.6) rotate(0deg)} }
        .crop-grow { animation: cropGrow 0.95s ease-in-out forwards; transform-origin: bottom center; }
        @keyframes cropZip { 0%{transform:scale(1.6); opacity:1} 100%{transform:translate(130px,-560px) scale(0.04); opacity:0.85} }
        .crop-zip { animation: cropZip 0.38s cubic-bezier(0.5,0,0.9,0.4) forwards; }
        @keyframes plusPop { 0%{opacity:0; transform:translateY(6px) scale(0.8)} 20%{opacity:1; transform:translateY(0) scale(1.15)} 100%{opacity:0; transform:translateY(-30px) scale(1)} }
        .plus-pop { position:absolute; animation: plusPop 1.4s ease-out forwards; }
        @keyframes weedWobble { 0%,100%{transform:translate(-50%,-100%) rotate(-4deg)} 50%{transform:translate(-50%,-100%) rotate(4deg)} }
        .weed-ready { animation: weedWobble 1.1s ease-in-out infinite; transform-origin: 50% 100%; }
        @keyframes pileBump { 0%{transform:scale(1)} 40%{transform:scale(1.45)} 100%{transform:scale(1)} }
        .pile-bump { animation: pileBump 0.4s ease; display:inline-block; }
      `}</style>

      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="plant" color="var(--ac)" size={20} />
          <span className="p-title">냥밭</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'var(--acTx)', fontSize:11, fontWeight:700, background:'var(--acBg)', border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', padding:'4px 10px', borderRadius:20 }}>
            {cropReady ? `${activeCat.cropName} 수확 가능!` : `총 ${cropAttended}pt · 수확 ${harvest}개`}
          </span>
          <ProfileHeaderIcon />
        </div>
      </div>

      <div style={{ background:'#fff', paddingTop:8, paddingBottom:80 }}>

        {/* 농장 메인 씬 — 테마별 픽셀 환경 */}
        <div style={{ position:'relative', overflow:'hidden', background:FARM_ENV[farmTheme].ground }}>

          {/* 하늘·산·들판·밭 (9:16 세로 픽셀 아트, 바닥 끝까지) + 하늘 인터랙션 핫스팟 */}
          <div style={{ position:'relative', width:'100%', aspectRatio:'1080 / 1920', backgroundImage:`url(${FARM_ENV[farmTheme].img})`, backgroundSize:'100% 100%', imageRendering:'pixelated' }}>
            {/* 태양: 클릭 → 햇살 버스트 */}
            <div onClick={()=>spawnFx('burst')} style={{ position:'absolute', left:'68%', top:'3.5%', width:'22%', height:'12%', cursor:'pointer' }} title="햇살">
              <div className="sun-glow" style={{ position:'absolute', inset:'18%' }}/>
            </div>
            {/* 구름: 클릭 → 픽셀 비 */}
            <div onClick={()=>spawnFx('rain', { x: 17 })} style={{ position:'absolute', left:'6%', top:'5%', width:'22%', height:'5%', cursor:'pointer' }} title="비 내리기"/>
            <div onClick={()=>spawnFx('rain', { x: 55 })} style={{ position:'absolute', left:'44%', top:'13%', width:'22%', height:'5%', cursor:'pointer' }} title="비 내리기"/>

            {/* 흘러가는 구름들: 클릭 → 그 자리에 비 */}
            {sky.clouds.map((c, i) => (
              <DriftCloud key={`c${i}`} {...c} onRain={skyClick('rain')} />
            ))}
            {/* 날개짓하는 새들: 클릭 → 짹짹 */}
            {sky.birds.map((b, i) => (
              <FlapBird key={`b${i}`} {...b} onChirp={skyClick('note')} />
            ))}
          </div>

          {/* 하늘 인터랙션 이펙트 레이어 */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:15 }}>
            {fx.filter(e=>e.type==='burst').map(e => (
              <div key={e.id} style={{ position:'absolute', left:'78%', top:'8.5%' }}>
                {[0,45,90,135,180,225,270,315].map(a => (
                  <span key={a} className="ray" style={{ '--ang':`${a}deg`, background: a%90===0 ? '#fff' : FARM_ENV[farmTheme].ground, outline:'1.5px solid var(--g5)' }}/>
                ))}
              </div>
            ))}
            {fx.filter(e=>e.type==='rain').map(e => (
              <div key={e.id}>
                {Array.from({length:12}).map((_,i)=>(
                  <span key={i} className="drop" style={{ left:`${e.x - 9 + (i%6)*3.6}%`, top:`${(e.y ?? 13) + 2}%`, background:'var(--g3)', animationDelay:`${(i%4)*0.12 + Math.floor(i/6)*0.28}s` }}/>
                ))}
              </div>
            ))}
            {fx.filter(e=>e.type==='note').map(e => (
              <div key={e.id} style={{ position:'absolute', left:`${e.x}%`, top:`${e.y}%` }}>
                <span className="note" style={{ color:'var(--g5)' }}>♪</span>
                <span className="note" style={{ color:'var(--g4)', marginLeft:12, animationDelay:'0.22s' }}>♫</span>
              </div>
            ))}
            {fx.filter(e=>e.type==='water').map(e => (
              <div key={e.id} style={{ position:'absolute', left:`calc(${e.x}% + 12px)`, bottom:e.b }}>
                {Array.from({length:6}).map((_,i)=>(
                  <span key={i} className="wdrop" style={{ left:i*5, background:'var(--g3)', animationDelay:`${i*0.09}s` }}/>
                ))}
              </div>
            ))}
            {fx.filter(e=>e.type==='dig').map(e => (
              <div key={e.id} style={{ position:'absolute', left:`calc(${e.x}% + 8px)`, bottom:e.b }}>
                {Array.from({length:5}).map((_,i)=>(
                  <span key={i} className="puff" style={{ left:i*7-8, animationDelay:`${i*0.1}s` }}/>
                ))}
              </div>
            ))}
            {fx.filter(e=>e.type==='seed').map(e => (
              <div key={e.id} style={{ position:'absolute', left:`calc(${e.x}% + 12px)`, bottom:e.b }}>
                {Array.from({length:7}).map((_,i)=>(
                  <span key={i} className="seed" style={{ '--dx':`${(i-3)*7}px`, animationDelay:`${i*0.06}s` }}/>
                ))}
              </div>
            ))}
            {fx.filter(e=>e.type==='plus').map(e => (
              <span key={e.id} className="plus-pop" style={{ left:`${e.x}%`, top:`${e.y}%`, fontSize:12, fontWeight:800, background:'var(--ac2)', color:'var(--g5)', border:'1.5px solid var(--g5)', borderRadius:12, padding:'3px 9px', whiteSpace:'nowrap' }}>{e.label}</span>
            ))}
          </div>

          {/* 설정에서 고른 농부냥 1마리만 등장 */}
          {(() => {
            const cat = FARM_CATS.find(c => c.key === farmCat) || FARM_CATS[0]
            return <FarmerCat key={cat.key} img={cat.img} bottom={6} size={128} act={cat.act} z={8} onFx={(a,x,b,sz)=>spawnFx(a,{ x, b: b + sz*0.55 })} />
          })()}

          {/* 작물 4칸 열 종대 — 앞칸이 크고 뒤로 갈수록 작아짐(원근). 맨 앞 완숙 작물만 수확 가능 */}
          {[
            { bottom: 60, size: 96, z: 6 },
            { bottom: 178, size: 74, z: 5 },
            { bottom: 272, size: 58, z: 4 },
            { bottom: 348, size: 46, z: 3 },
          ].map((plot, i) => {
            const stage = Math.max(0, Math.min(CROP_STAGES, cropPoints - i * CROP_STAGES))
            const isFront = i === 0
            return (
              <div key={i} onClick={isFront ? harvestCrop : undefined}
                className={isFront && harvestAnim === 'grow' ? 'crop-grow' : isFront && harvestAnim === 'zip' ? 'crop-zip' : ''}
                style={{ position:'absolute', left:'50%', bottom:plot.bottom, width:plot.size, marginLeft:-plot.size / 2, zIndex: isFront && harvestAnim ? 30 : plot.z, cursor: isFront && cropReady ? 'pointer' : 'default' }}>
                <img src={cropImg(activeCat.crop, Math.max(1, stage))} alt="" width={plot.size}
                  style={{ display:'block', width:'100%', imageRendering:'pixelated', opacity: stage === 0 ? 0.3 : 1, filter: stage === 0 ? 'grayscale(0.7)' : 'none' }} />
                {isFront && !harvestAnim && (
                  <div style={{ position:'absolute', top:-24, left:'50%', transform:'translateX(-50%)', whiteSpace:'nowrap', fontSize:10, fontWeight:800, background: cropReady ? 'var(--ac2)' : 'rgba(255,255,255,0.92)', color:'var(--g5)', border:'1.5px solid var(--g5)', borderRadius:12, padding:'2px 8px' }}>
                    {cropReady ? `${activeCat.cropName} 수확!` : stage === 0 ? '출석하면 자라요' : `${stage}/${CROP_STAGES} 성장`}
                  </div>
                )}
              </div>
            )
          })}

          {/* 잡초 — 수강권 있을 때만. 4단계부터 뽑을 수 있음(흔들림 표시) */}
          {ticketValid && weeds.map(w => {
            const stage = weedStage(w, Date.now())
            const removable = stage >= WEED.REMOVABLE_STAGE
            const size = 26 + stage * 7
            return (
              <img key={w.id} src={weedImg(stage)} alt="잡초"
                onClick={removable ? () => removeWeed(w) : undefined}
                title={removable ? '잡초 뽑기 ✂️' : '아직 못 뽑아요'}
                className={removable ? 'weed-ready' : ''}
                style={{ position:'absolute', left:`${w.x}%`, top:`${w.y}%`, width:size, transform:'translate(-50%,-100%)', imageRendering:'pixelated', zIndex:7,
                  cursor: removable ? 'pointer' : 'default', pointerEvents: removable ? 'auto' : 'none',
                  filter: removable ? 'drop-shadow(0 0 4px rgba(226,75,74,0.85))' : 'none' }} />
            )
          })}

          {/* 잡초더미 아이콘 + 제거 개수 (수강권 있을 때) */}
          {ticketValid && (
            <div style={{ position:'absolute', top:8, right:8, zIndex:26, display:'flex', flexDirection:'column', alignItems:'center', gap:1, background:'rgba(255,255,255,0.92)', border:'1.5px solid var(--g5)', borderRadius:12, padding:'6px 9px', boxShadow:'2px 2px 0 rgba(0,0,0,0.1)' }}>
              {pileImgOk
                ? <img key={pileBump} className="pile-bump" src="/farm/weed-pile.png" alt="잡초더미" width={30} height={30} onError={() => setPileImgOk(false)} style={{ imageRendering:'pixelated', display:'block' }}/>
                : <span key={pileBump} className="pile-bump" style={{ fontSize:20, lineHeight:1 }}>🌿</span>}
              <span style={{ fontSize:11, fontWeight:900, color:'var(--g5)', fontFamily:'Nunito,sans-serif', fontVariantNumeric:'tabular-nums' }}>{weedRemoved}/{WEED.REWARD_AT}</span>
            </div>
          )}

        </div>

        {/* 통계 */}
        <div style={{ padding:'16px 18px 0' }}>

          {/* 잡초 관리 안내 */}
          {ticketValid ? (
            <div style={{ background:'var(--bg)', border:'1.5px solid var(--g1)', borderRadius:12, padding:'11px 13px', display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ fontSize:20 }}>🌿</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--td)' }}>잡초 뽑기 {weedRemoved}/{WEED.REWARD_AT}</div>
                <div style={{ fontSize:10, color:'var(--tmu)', marginTop:1, lineHeight:1.5 }}>다 자란 잡초는 밭에서 눌러 뽑아요. 500개 뽑으면 드로잉노트+연필! (완전 성장 10개↑ 방치 시 작물 소멸)</div>
              </div>
            </div>
          ) : (
            <div style={{ background:'var(--bg)', border:'1.5px dashed var(--g2)', borderRadius:12, padding:'11px 13px', display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ fontSize:18 }}>🔒</span>
              <div style={{ fontSize:11, color:'var(--tmu)', fontWeight:600, lineHeight:1.5 }}>수강권이 있으면 잡초 관리로 드로잉노트+연필 보상을 받을 수 있어요 🐾</div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {[
              { label:'총 출석', val:`${attended}회`, color:'var(--g4)' },
              { label:'결석', val:`${absent}회`, color:'#c0392b' },
              { label:'수확한 작물', val:`${harvest}개`, color:'#FF6B20' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--bg)', borderRadius:12, padding:'10px', textAlign:'center', border:'1.5px solid var(--g1)' }}>
                <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:15, fontWeight:800, color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* 미니게임 — 색감 훈련 */}
          <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:10 }}>미니게임</div>
          <div onClick={() => setGameOpen(true)}
            style={{ display:'flex', alignItems:'center', gap:12, background:'var(--acBg)', border:'2px solid rgb(var(--ac-rgb) / 0.3)', borderRadius:16, padding:'13px 14px', marginBottom:18, cursor:'pointer' }}>
            <div style={{ width:44, height:44, borderRadius:13, background:'#fff', border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22 }}>🎨</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:900, color:'var(--td)' }}>조색 게임</div>
              <div style={{ fontSize:10.5, color:'var(--tm)', fontWeight:600, marginTop:2 }}>목표색을 3원색으로 맞춰봐요 · 색감 훈련</div>
            </div>
            <span style={{ flexShrink:0, fontSize:11, fontWeight:800, color:'#fff', background:'var(--ac)', borderRadius:20, padding:'6px 13px' }}>플레이 →</span>
          </div>

          {/* 최근 이력 */}
          <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:10 }}>최근 이력</div>
          {history.slice(0,6).map(h => (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--g1)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                background:h.attended===true?'var(--g4)':h.class_date<todayStr&&!h.attended?'#d4a0a0':'var(--tmu)' }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'var(--td)', fontWeight:600 }}>{h.class_name}</div>
                <div style={{ fontSize:10, color:'var(--tmu)' }}>{h.class_date}</div>
              </div>
              <span style={{ fontSize:11, fontWeight:800, color:h.attended===true?'var(--g4)':'var(--tmu)' }}>
                {h.attended===true?`+${ptsPerAttend} pt`:'0 pt'}
              </span>
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>아직 수업 이력이 없어요 🐾</div>
          )}
        </div>
      </div>

      {/* 잡초 500개 제거 보상 */}
      {weedReward && (
        <div onClick={() => setWeedReward(false)}
          style={{ position:'fixed', inset:0, background:'rgba(27,28,70,0.55)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:22, padding:'26px 22px', maxWidth:320, width:'100%', textAlign:'center', border:'3px solid var(--ac)', boxShadow:'0 14px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize:46 }}>🎁</div>
            <div style={{ fontSize:16, fontWeight:900, color:'var(--td)', margin:'10px 0 6px' }}>잡초 500개 제거 완료!</div>
            <div style={{ fontSize:12.5, color:'var(--tm)', fontWeight:600, lineHeight:1.7, marginBottom:16 }}>
              2호선 스튜디오 고양이 <b style={{ color:'var(--acTx)' }}>드로잉노트 + 연필</b>을 받았어요! 🐾<br/>스튜디오에서 수령해 주세요.
            </div>
            <button onClick={() => setWeedReward(false)}
              style={{ padding:'11px 26px', background:'var(--ac)', color:'#fff', border:'none', borderRadius:16, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>야호! 🎉</button>
          </div>
        </div>
      )}

      <ColorMixGame open={gameOpen} onClose={() => setGameOpen(false)} />

      <StudentNav active="farm" role={user?.user_metadata?.role || undefined} />
    </>
  )
}