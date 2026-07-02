'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'

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

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes coinUp { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-70px) scale(0.3);opacity:0} }
        @keyframes treeSway { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
        @keyframes catBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes cloudDrift { 0%{transform:translateX(0)} 100%{transform:translateX(20px)} }
        .coin { animation: coinUp 0.9s ease-out forwards; }
        .tree { animation: treeSway 3s ease-in-out infinite; transform-origin: bottom center; }
        .cat-idle { animation: catBounce 2.5s ease-in-out infinite; }
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

        {/* 농장 메인 씬 */}
        <div style={{ position:'relative', overflow:'hidden', background:'linear-gradient(180deg,#87CEEB 0%,#b8eaa0 55%,#5a9e40 55%,#4a8a30 100%)', minHeight:380 }}>

          {/* 태양 */}
          <div style={{ position:'absolute', top:14, right:24 }}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="14" fill="#FFD54F"/>
              {[0,45,90,135,180,225,270,315].map((a,i)=>(
                <line key={i} x1="22" y1="22" x2={22+Math.cos(a*Math.PI/180)*20} y2={22+Math.sin(a*Math.PI/180)*20} stroke="#FFCA28" strokeWidth="2.5" strokeLinecap="round"/>
              ))}
            </svg>
          </div>

          {/* 구름 */}
          <div style={{ position:'absolute', top:12, left:16, animation:'cloudDrift 8s ease-in-out infinite alternate' }}>
            <svg width="90" height="32" viewBox="0 0 90 32">
              <ellipse cx="45" cy="22" rx="40" ry="16" fill="#fff" fillOpacity="0.92"/>
              <ellipse cx="62" cy="14" rx="26" ry="16" fill="#fff" fillOpacity="0.92"/>
              <ellipse cx="28" cy="16" rx="22" ry="14" fill="#fff" fillOpacity="0.92"/>
            </svg>
          </div>

          {/* 나무 왼쪽 */}
          <div className="tree" style={{ position:'absolute', left:6, bottom:150 }}>
            <svg width="50" height="90" viewBox="0 0 50 90">
              <rect x="21" y="58" width="8" height="32" rx="3" fill="#8B6914"/>
              <ellipse cx="25" cy="46" rx="20" ry="26" fill="#2E7D32"/>
              <ellipse cx="25" cy="36" rx="15" ry="19" fill="#388E3C"/>
              <ellipse cx="25" cy="26" rx="10" ry="13" fill="#4CAF50"/>
              <ellipse cx="25" cy="18" rx="6" ry="8" fill="#66BB6A"/>
            </svg>
          </div>

          {/* 나무 오른쪽 */}
          <div className="tree" style={{ position:'absolute', right:4, bottom:160, animationDelay:'0.5s' }}>
            <svg width="44" height="80" viewBox="0 0 44 80">
              <rect x="18" y="52" width="8" height="28" rx="3" fill="#7a5c10"/>
              <ellipse cx="22" cy="40" rx="18" ry="23" fill="#1B5E20"/>
              <ellipse cx="22" cy="30" rx="13" ry="17" fill="#2E7D32"/>
              <ellipse cx="22" cy="21" rx="9" ry="12" fill="#388E3C"/>
              <ellipse cx="22" cy="13" rx="6" ry="8" fill="#4CAF50"/>
            </svg>
          </div>

          {/* 작은 꽃 장식 */}
          <div style={{ position:'absolute', left:52, bottom:155 }}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" fill="#FFD54F"/>
              {[0,60,120,180,240,300].map((a,i)=>(
                <ellipse key={i} cx={12+Math.cos(a*Math.PI/180)*7} cy={12+Math.sin(a*Math.PI/180)*7} rx="4" ry="3" fill="#FFF9C4" transform={`rotate(${a},${12+Math.cos(a*Math.PI/180)*7},${12+Math.sin(a*Math.PI/180)*7})`}/>
              ))}
            </svg>
          </div>
          <div style={{ position:'absolute', right:50, bottom:165 }}>
            <svg width="20" height="20" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="3.5" fill="#F48FB1"/>
              {[0,72,144,216,288].map((a,i)=>(
                <ellipse key={i} cx={10+Math.cos(a*Math.PI/180)*6} cy={10+Math.sin(a*Math.PI/180)*6} rx="3.5" ry="2.5" fill="#FCE4EC" transform={`rotate(${a},${10+Math.cos(a*Math.PI/180)*6},${10+Math.sin(a*Math.PI/180)*6})`}/>
              ))}
            </svg>
          </div>

          {/* 고양이 농부 */}
          <div className="cat-idle" style={{ position:'absolute', right:18, bottom:148, zIndex:5 }}>
            <svg width="52" height="64" viewBox="0 0 52 64" fill="none">
              {/* 귀 */}
              <path d="M14 22 Q12 12 17 9 Q20 18 21 22" fill="#c8e6c0" stroke="#3d8b50" strokeWidth="1.8"/>
              <path d="M38 22 Q40 12 35 9 Q32 18 31 22" fill="#c8e6c0" stroke="#3d8b50" strokeWidth="1.8"/>
              {/* 얼굴 */}
              <path d="M8 30 Q8 18 26 18 Q44 18 44 30 Q44 42 26 44 Q8 42 8 30Z" fill="#c8e6c0" stroke="#3d8b50" strokeWidth="2"/>
              {/* 꼬리 */}
              <path d="M40 42 Q50 46 48 54" stroke="#3d8b50" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              {/* 눈 */}
              <circle cx="20" cy="28" r="2.5" fill="#3d8b50"/>
              <circle cx="32" cy="28" r="2.5" fill="#3d8b50"/>
              {/* 표정 */}
              {catMood==='happy'
                ? <path d="M21 36 Q26 42 31 36" stroke="#3d8b50" strokeWidth="2" fill="none" strokeLinecap="round"/>
                : <path d="M22 36 Q26 39 30 36" stroke="#3d8b50" strokeWidth="1.8" fill="none" strokeLinecap="round"/>}
              {/* 수염 */}
              <line x1="4" y1="27" x2="14" y2="29" stroke="#3d8b50" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="4" y1="32" x2="14" y2="31" stroke="#3d8b50" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="48" y1="27" x2="38" y2="29" stroke="#3d8b50" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="48" y1="32" x2="38" y2="31" stroke="#3d8b50" strokeWidth="1.5" strokeLinecap="round"/>
              {/* 몸 + 앞치마 */}
              <ellipse cx="26" cy="52" rx="16" ry="8" fill="#c8e6c0" stroke="#3d8b50" strokeWidth="1.5"/>
              <rect x="14" y="44" width="24" height="14" rx="6" fill="#FF8A65"/>
              <text x="26" y="55" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff" fontFamily="Nunito,sans-serif">농부냥</text>
            </svg>
          </div>

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