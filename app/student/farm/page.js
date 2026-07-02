'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import LoadingCat from '../../../components/LoadingCat'

// 테마별 픽셀 냥밭 환경 — ground는 이미지 하단 지면 픽셀 색과 동일(이음매 방지)
const FARM_ENV = {
  ultra: { img: '/farm/ultra.png', ground: '#7CE8A4' },
  line2: { img: '/farm/line2.png', ground: '#D3EF6B' },
  ink:   { img: '/farm/ink.png',   ground: '#FF6A2B' },
  lilac: { img: '/farm/lilac.png', ground: '#FF9AC9' },
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

function Carrot({ pt, index, onHarvest }) {
  const stage = getStage(pt)
  const [pop, setPop] = useState(false)
  const colors = [
    { body:'#FF8A50', leaf:'#2E7D32', leaf2:'#4CAF50', leaf3:'#66BB6A', stripe:'#FFC107' },
    { body:'#FF7043', leaf:'#1B5E20', leaf2:'#388E3C', leaf3:'#4CAF50', stripe:'#FFB300' },
    { body:'#FFA040', leaf:'#33691E', leaf2:'#558B2F', leaf3:'#7CB342', stripe:'#FFD54F' },
    { body:'#FF6D35', leaf:'#2E7D32', leaf2:'#43A047', leaf3:'#66BB6A', stripe:'#FFCA28' },
  ]
  const c = colors[index % 4]

  function handleClick() {
    if (stage < 4) return
    setPop(true)
    setTimeout(() => setPop(false), 400)
    onHarvest(index)
  }

  return (
    <div onClick={handleClick} style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end',
      width:52, height:72, cursor:stage===4?'pointer':'default',
      transform:pop?'scale(1.25) rotate(5deg)':'scale(1)',
      transition:'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      position:'relative'
    }}>
      {stage === 0 && (
        <div style={{ width:14, height:14, borderRadius:'50%', background:'rgba(139,105,20,0.3)', border:'1.5px dashed #8a6a40', marginBottom:6 }}/>
      )}
      {stage >= 1 && (
        <svg width="48" height="68" viewBox="0 0 48 68" fill="none">
          {/* 잎 */}
          <path d={`M24 ${42-stage*5} C22 ${36-stage*5} 19 ${30-stage*5} 21 ${23-stage*5} C23 ${28-stage*5} 24 ${34-stage*5} 24 ${42-stage*5}Z`} fill={c.leaf}/>
          <path d={`M24 ${42-stage*5} C26 ${35-stage*5} 29 ${30-stage*5} 27 ${23-stage*5} C24 ${28-stage*5} 23 ${34-stage*5} 24 ${42-stage*5}Z`} fill={c.leaf2}/>
          {stage >= 2 && <>
            <path d={`M24 ${42-stage*5} C19 ${38-stage*5} 15 ${34-stage*5} 17 ${27-stage*5} C20 ${32-stage*5} 23 ${37-stage*5} 24 ${42-stage*5}Z`} fill={c.leaf2}/>
            <path d={`M24 ${42-stage*5} C29 ${37-stage*5} 33 ${33-stage*5} 31 ${26-stage*5} C28 ${31-stage*5} 25 ${36-stage*5} 24 ${42-stage*5}Z`} fill={c.leaf3}/>
          </>}
          {stage >= 3 && <>
            <path d={`M24 ${42-stage*5} C17 ${37-stage*5} 13 ${32-stage*5} 15 ${25-stage*5} C18 ${30-stage*5} 22 ${36-stage*5} 24 ${42-stage*5}Z`} fill={c.leaf}/>
            <path d={`M24 ${42-stage*5} C31 ${36-stage*5} 35 ${31-stage*5} 33 ${24-stage*5} C30 ${29-stage*5} 26 ${35-stage*5} 24 ${42-stage*5}Z`} fill={c.leaf3}/>
          </>}
          {/* 몸통 */}
          {stage >= 2 && (
            <>
              <path d={`M${18+stage} ${43-stage*5} Q${16+stage} ${44-stage*5} 23 ${58+stage*2} Q24 ${60+stage*2} 25 ${58+stage*2} Q${32-stage} ${44-stage*5} ${30-stage} ${43-stage*5}Z`} fill={c.body}/>
              <path d={`M${17+stage} ${44-stage*5} Q${15+stage} ${45-stage*5} ${16+stage} ${48-stage*5}`} stroke="#E8784A" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              {Array(Math.min(stage,4)).fill(0).map((_,i) => {
                const sy = 47-stage*5 + i*5
                const sw = 5+stage-i
                return <path key={i} d={`M${24-sw} ${sy} Q24 ${sy-1} ${24+sw} ${sy}`} stroke={c.stripe} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
              })}
            </>
          )}
          {/* 완성 이펙트 */}
          {stage === 4 && <>
            <text x="24" y="10" textAnchor="middle" fontSize="12">✨</text>
            <text x="6" y="26" fontSize="9">⭐</text>
            <text x="38" y="22" fontSize="9">⭐</text>
          </>}
        </svg>
      )}
      <div style={{
        fontSize:8, fontWeight:800, marginTop:2, padding:'2px 5px', borderRadius:6,
        background:stage===4?'#FFF3E0':'rgba(255,255,255,0.85)',
        color:stage===4?'#FF6B20':'var(--g5)'
      }}>
        {stage===4?'🥕수확!':stage===0?'씨앗':`${pt}pt`}
      </div>
    </div>
  )
}

export default function FarmPage() {
  const router = useRouter()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const [user, setUser] = useState(null)
  const [carrots, setCarrots] = useState(Array(8).fill(0))
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [coins, setCoins] = useState([])
  const [catMood, setCatMood] = useState('idle')
  const [farmTheme, setFarmTheme] = useState('ultra')
  const [fx, setFx] = useState([])

  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme')
    if (FARM_ENV[t]) setFarmTheme(t)
  }, [])

  // 하늘 인터랙션 이펙트 (햇살 버스트·픽셀 비·음표) — 끝나면 자동 제거
  function spawnFx(type, extra = {}) {
    const id = Date.now() + Math.random()
    setFx(f => [...f, { id, type, ...extra }])
    setTimeout(() => setFx(f => f.filter(e => e.id !== id)), 1700)
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
    setLoading(false)
  }

  function handleHarvest(index) {
    setCatMood('happy')
    setTimeout(() => setCatMood('idle'), 2000)
    const id = Date.now()
    setCoins(prev => [...prev, { id, x: 30 + index * 20 }])
    setTimeout(() => setCoins(prev => prev.filter(c => c.id !== id)), 1000)
    const newCarrots = [...carrots]
    newCarrots[index] = 0
    setCarrots(newCarrots)
  }

  const attended = history.filter(h => h.attended === true).length
  const absent = history.filter(h => h.class_date < todayStr && !h.attended).length
  const readyCount = carrots.filter(p => getStage(p) === 4).length

  if (loading) return <LoadingCat />

  return (
    <>
      <style>{`
        @keyframes coinUp { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-70px) scale(0.3);opacity:0} }
        @keyframes catBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .coin { animation: coinUp 0.9s ease-out forwards; }
        .cat-idle { animation: catBounce 2.5s ease-in-out infinite; }
        @keyframes birdFly { 0%{transform:translate(-30px,0)} 20%{transform:translate(75px,-8px)} 40%{transform:translate(175px,5px)} 60%{transform:translate(265px,-11px)} 80%{transform:translate(355px,3px)} 100%{transform:translate(440px,-7px)} }
        .pix-bird { animation: birdFly 15s linear infinite; }
        @keyframes sunPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)} 50%{box-shadow:0 0 22px 9px rgba(255,255,255,0.55)} }
        .sun-glow { animation: sunPulse 3s ease-in-out infinite; border-radius:50%; }
        @keyframes rayOut { 0%{transform:rotate(var(--ang)) translateX(8px); opacity:1} 100%{transform:rotate(var(--ang)) translateX(52px); opacity:0} }
        .ray { position:absolute; width:9px; height:9px; animation: rayOut 0.7s ease-out forwards; }
        @keyframes dropFall { 0%{opacity:1; transform:translateY(0)} 80%{opacity:1} 100%{opacity:0; transform:translateY(225px)} }
        .drop { position:absolute; width:4px; height:11px; animation: dropFall 1.15s linear forwards; }
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
        <div style={{ position:'relative', overflow:'hidden', background:FARM_ENV[farmTheme].ground, minHeight:380 }}>

          {/* 하늘·산·들판 (16:9 픽셀 아트) + 하늘 인터랙션 핫스팟 */}
          <div style={{ position:'relative', width:'100%', aspectRatio:'16 / 9', backgroundImage:`url(${FARM_ENV[farmTheme].img})`, backgroundSize:'100% 100%', imageRendering:'pixelated' }}>
            {/* 태양: 클릭 → 햇살 버스트 */}
            <div onClick={()=>spawnFx('burst')} style={{ position:'absolute', left:'76%', top:'3%', width:'15%', height:'26%', cursor:'pointer' }} title="햇살">
              <div className="sun-glow" style={{ position:'absolute', inset:'12%' }}/>
            </div>
            {/* 구름: 클릭 → 픽셀 비 */}
            <div onClick={()=>spawnFx('rain', { x: 44 })} style={{ position:'absolute', left:'38%', top:'7%', width:'20%', height:'12%', cursor:'pointer' }} title="비 내리기"/>
            <div onClick={()=>spawnFx('rain', { x: 68 })} style={{ position:'absolute', left:'63%', top:'3%', width:'14%', height:'10%', cursor:'pointer' }} title="비 내리기"/>
            {/* 새: 클릭 → 짹짹 */}
            <div onClick={()=>spawnFx('note', { x: 52, y: 10 })} style={{ position:'absolute', left:'50%', top:'8%', width:'12%', height:'12%', cursor:'pointer' }} title="짹짹"/>

            {/* 상시 날아다니는 픽셀 새 */}
            <svg className="pix-bird" width="26" height="14" viewBox="0 0 26 14" style={{ position:'absolute', top:'15%', left:0, pointerEvents:'none' }} aria-hidden="true">
              <path d="M1 10 L7 3 L13 10 M13 10 L19 3 L25 10" stroke="var(--g5)" strokeWidth="2.4" fill="none"/>
            </svg>
          </div>

          {/* 하늘 인터랙션 이펙트 레이어 */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:15 }}>
            {fx.filter(e=>e.type==='burst').map(e => (
              <div key={e.id} style={{ position:'absolute', left:'83%', top:'9%' }}>
                {[0,45,90,135,180,225,270,315].map(a => (
                  <span key={a} className="ray" style={{ '--ang':`${a}deg`, background: a%90===0 ? '#fff' : FARM_ENV[farmTheme].ground, outline:'1.5px solid var(--g5)' }}/>
                ))}
              </div>
            ))}
            {fx.filter(e=>e.type==='rain').map(e => (
              <div key={e.id}>
                {Array.from({length:12}).map((_,i)=>(
                  <span key={i} className="drop" style={{ left:`${e.x - 9 + (i%6)*3.6}%`, top:'15%', background:'var(--g3)', animationDelay:`${(i%4)*0.12 + Math.floor(i/6)*0.28}s` }}/>
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

          {/* 농부냥 3마리 — 앞줄 물주기 · 밭 사이 씨뿌리기 · 울타리 앞 밭갈기 */}
          <FarmerCat img="/farm/cat-watering.png" bottom={4} size={48} act="water" z={8} onFx={(a,x,b,sz)=>spawnFx(a,{ x, b: b + sz*0.55 })} />
          <FarmerCat img="/farm/cat-overalls.png" bottom={106} size={40} act="seed" z={7} onFx={(a,x,b,sz)=>spawnFx(a,{ x, b: b + sz*0.5 })} />
          <FarmerCat img="/farm/cat-apron.png" bottom={168} size={30} act="dig" z={0} onFx={(a,x,b,sz)=>spawnFx(a,{ x, b: b + sz*0.4 })} />

          {/* 코인 애니메이션 */}
          {coins.map(coin => (
            <div key={coin.id} className="coin" style={{ position:'absolute', bottom:180, left:`${coin.x}%`, fontSize:20, zIndex:20 }}>🪙</div>
          ))}

          {/* 밭 블록 1 (위) */}
          <div style={{ position:'absolute', bottom:155, left:'50%', transform:'translateX(-50%)', width:300 }}>
            <svg width="300" height="50" viewBox="0 0 300 50" style={{ position:'absolute', top:0, left:0 }}>
              <path d="M150 4 L292 36 L150 46 L8 36 Z" fill="#A07820"/>
              <path d="M8 36 L150 46 L150 72 L8 62 Z" fill="#8B6914"/>
              <path d="M292 36 L150 46 L150 72 L292 62 Z" fill="#6B5010"/>
              <path d="M150 4 L292 36 L150 46 L8 36 Z" fill="#8B6914" fillOpacity="0.3"/>
              {[60,110,160,210].map((x,i)=>(
                <ellipse key={i} cx={x} cy={28+i%2*4} rx="18" ry="6" fill="#7a5a10" fillOpacity="0.35"/>
              ))}
            </svg>
            <div style={{ position:'relative', zIndex:1, display:'flex', justifyContent:'space-around', padding:'0 16px', paddingTop:2 }}>
              {carrots.slice(0,4).map((pt,i) => (
                <Carrot key={i} pt={pt} index={i} onHarvest={handleHarvest}/>
              ))}
            </div>
          </div>

          {/* 밭 블록 2 (아래) */}
          <div style={{ position:'absolute', bottom:52, left:'50%', transform:'translateX(-50%)', width:300 }}>
            <svg width="300" height="50" viewBox="0 0 300 50" style={{ position:'absolute', top:0, left:0 }}>
              <path d="M150 4 L292 36 L150 46 L8 36 Z" fill="#A07820"/>
              <path d="M8 36 L150 46 L150 72 L8 62 Z" fill="#8B6914"/>
              <path d="M292 36 L150 46 L150 72 L292 62 Z" fill="#6B5010"/>
              <path d="M150 4 L292 36 L150 46 L8 36 Z" fill="#8B6914" fillOpacity="0.3"/>
              {[60,110,160,210].map((x,i)=>(
                <ellipse key={i} cx={x} cy={28+i%2*4} rx="18" ry="6" fill="#7a5a10" fillOpacity="0.35"/>
              ))}
            </svg>
            <div style={{ position:'relative', zIndex:1, display:'flex', justifyContent:'space-around', padding:'0 16px', paddingTop:2 }}>
              {carrots.slice(4,8).map((pt,i) => (
                <Carrot key={i+4} pt={pt} index={i+4} onHarvest={handleHarvest}/>
              ))}
            </div>
          </div>
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