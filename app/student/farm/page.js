'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { FARM_CATS, getSavedFarmCat, isValidFarmCat } from '../../../lib/farmCats'
import LoadingCat from '../../../components/LoadingCat'

// 테마별 픽셀 냥밭 환경 — ground는 이미지 하단 지면 픽셀 색과 동일(이음매 방지)
const FARM_ENV = {
  ultra: { img: '/farm/ultra.png', ground: '#7CE8A4' },
  line2: { img: '/farm/line2.png', ground: '#D3EF6B' },
  ink:   { img: '/farm/ink.png',   ground: '#FF6A2B' },
  lilac: { img: '/farm/lilac.png', ground: '#FF9AC9' },
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

function getStage(pt) {
  if (pt <= 0) return 0
  if (pt <= 3) return 1
  if (pt <= 7) return 2
  if (pt <= 11) return 3
  return 4
}


export default function FarmPage() {
  const router = useRouter()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const [user, setUser] = useState(null)
  const [carrots, setCarrots] = useState(Array(8).fill(0))
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

  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme')
    if (FARM_ENV[t]) setFarmTheme(t)
    setFarmCat(getSavedFarmCat())
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    const { data: b } = await supabase
      .from('bookings').select('*').eq('user_id', userId)
      .neq('status', 'cancelled')
      .order('class_date', { ascending: false })
    const h = b || []
    setHistory(h)
    const attended = h.filter(x => x.attended === true).length
    const newCarrots = Array(8).fill(0).map((_, i) => {
      const share = Math.floor(attended / 8)
      const extra = i < (attended % 8) ? 1 : 0
      return Math.min(share + extra, 12)
    })
    setCarrots(newCarrots)
    const { data: pref } = await supabase.from('user_prefs').select('*').eq('user_id', userId).single()
    if (isValidFarmCat(pref?.farm_cat)) setFarmCat(pref.farm_cat)
    setLoading(false)
  }


  const attended = history.filter(h => h.attended === true).length
  const absent = history.filter(h => h.class_date < todayStr && !h.attended).length
  const readyCount = carrots.filter(p => getStage(p) === 4).length

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
      `}</style>

      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🌱</span>
          <span className="p-title">냥밭</span>
        </div>
        <span style={{ color:'var(--acTx)', fontSize:11, fontWeight:700, background:'var(--acBg)', border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', padding:'4px 10px', borderRadius:20 }}>
          {readyCount > 0 ? `🥕 ${readyCount}개 수확 가능!` : `총 ${attended}pt`}
        </span>
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
          </div>

          {/* 설정에서 고른 농부냥 1마리만 등장 */}
          {(() => {
            const cat = FARM_CATS.find(c => c.key === farmCat) || FARM_CATS[0]
            return <FarmerCat key={cat.key} img={cat.img} bottom={6} size={64} act={cat.act} z={8} onFx={(a,x,b,sz)=>spawnFx(a,{ x, b: b + sz*0.55 })} />
          })()}

        </div>

        {/* 통계 */}
        <div style={{ padding:'16px 18px 0' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {[
              { label:'총 출석', val:`${attended}회`, color:'var(--g4)' },
              { label:'결석', val:`${absent}회`, color:'#c0392b' },
              { label:'수확 가능', val:`${readyCount}개`, color:'#FF6B20' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--bg)', borderRadius:12, padding:'10px', textAlign:'center', border:'1.5px solid var(--g1)' }}>
                <div style={{ fontSize:9, color:'var(--tmu)', fontWeight:700, marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:15, fontWeight:800, color:s.color }}>{s.val}</div>
              </div>
            ))}
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
                {h.attended===true?'+1 pt':'0 pt'}
              </span>
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>아직 수업 이력이 없어요 🐾</div>
          )}
        </div>
      </div>

      <StudentNav active="farm" />
    </>
  )
}