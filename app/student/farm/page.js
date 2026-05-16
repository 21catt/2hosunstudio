'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

function getStage(pt) {
  if (pt <= 0) return 0
  if (pt <= 3) return 1
  if (pt <= 7) return 2
  if (pt <= 11) return 3
  return 4
}

function CarrotSVG({ stage, size = 60 }) {
  const leafColors = [
    ['#4CAF50','#66BB6A'],
    ['#2E7D32','#388E3C','#4CAF50','#66BB6A'],
    ['#1B5E20','#2E7D32','#388E3C','#4CAF50','#66BB6A'],
    ['#1B5E20','#2E7D32','#388E3C','#4CAF50','#66BB6A','#81C784'],
  ]
  if (stage === 0) return <div style={{ width:size, height:size, borderRadius:'50%', background:'#e8ddd4', border:'2px dashed #c4a880', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#a09080', fontWeight:700 }}>비어있음</div>

  const lc = leafColors[stage-1] || leafColors[0]
  const heights = [0,14,22,32,44]
  const widths = [0,8,11,15,20]
  const h = heights[stage], w = widths[stage]

  return (
    <svg width={size} height={size+20} viewBox={`0 0 ${size} ${size+20}`} fill="none">
      {/* 잎 */}
      {stage >= 1 && <>
        <path d={`M${size/2} ${size/2} C${size/2-3} ${size/2-10} ${size/2-6} ${size/2-16} ${size/2-3} ${size/2-20} C${size/2} ${size/2-16} ${size/2+2} ${size/2-10} ${size/2} ${size/2}Z`} fill={lc[0]}/>
        <path d={`M${size/2} ${size/2} C${size/2+3} ${size/2-10} ${size/2+7} ${size/2-15} ${size/2+5} ${size/2-19} C${size/2+1} ${size/2-15} ${size/2-1} ${size/2-10} ${size/2} ${size/2}Z`} fill={lc[1]||lc[0]}/>
      </>}
      {stage >= 2 && <>
        <path d={`M${size/2} ${size/2} C${size/2-5} ${size/2-8} ${size/2-9} ${size/2-12} ${size/2-7} ${size/2-16} C${size/2-3} ${size/2-12} ${size/2-1} ${size/2-8} ${size/2} ${size/2}Z`} fill={lc[2]||lc[1]}/>
        <path d={`M${size/2} ${size/2} C${size/2+5} ${size/2-7} ${size/2+10} ${size/2-11} ${size/2+8} ${size/2-15} C${size/2+3} ${size/2-11} ${size/2+1} ${size/2-7} ${size/2} ${size/2}Z`} fill={lc[3]||lc[2]}/>
      </>}
      {stage >= 3 && <path d={`M${size/2} ${size/2} C${size/2-7} ${size/2-6} ${size/2-11} ${size/2-9} ${size/2-9} ${size/2-13} C${size/2-5} ${size/2-9} ${size/2-2} ${size/2-5} ${size/2} ${size/2}Z`} fill={lc[4]||lc[3]}/>}
      {stage >= 4 && <path d={`M${size/2} ${size/2} C${size/2+7} ${size/2-5} ${size/2+12} ${size/2-8} ${size/2+10} ${size/2-12} C${size/2+5} ${size/2-8} ${size/2+2} ${size/2-4} ${size/2} ${size/2}Z`} fill={lc[5]||lc[4]}/>}
      {/* 몸통 */}
      {stage >= 2 && <path d={`M${size/2-w} ${size/2} Q${size/2-w-2} ${size/2+2} ${size/2-1} ${size/2+h+4} Q${size/2} ${size/2+h+6} ${size/2+1} ${size/2+h+4} Q${size/2+w+2} ${size/2+2} ${size/2+w} ${size/2}Z`} fill="#FF8A50"/>}
      {/* 줄무늬 */}
      {stage >= 2 && Array(Math.min(stage,4)).fill(0).map((_,i) => {
        const sy = size/2 + 4 + (i * ((h*0.85) / Math.min(stage,4)))
        const sw = w * (1 - i*0.1)
        return <path key={i} d={`M${size/2-sw+2} ${sy} Q${size/2} ${sy-1} ${size/2+sw-2} ${sy}`} stroke="#FFC107" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      })}
      {stage === 4 && <ellipse cx={size/2} cy={size/2-2} rx={w+3} ry={4} fill="#FF8A50" fillOpacity="0.15"/>}
    </svg>
  )
}

export default function FarmPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [points, setPoints] = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    const { data: b } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('class_date', { ascending: false })
    const attended = (b || []).filter(x => x.status === 'attended')
    setPoints(attended.length)
    setHistory(b || [])
    setLoading(false)
  }

  async function harvest() {
    if (getStage(points) < 4) return
    alert('🥕 수확 완료! 다시 씨앗을 심어요')
  }

  const stage = getStage(points)
  const stageNames = ['씨앗','싹','새싹','무럭무럭','완성 🥕']
  const nextGoal = [1,4,8,12,12]
  const attended = history.filter(h => h.status === 'attended').length
  const absent = history.filter(h => h.status === 'absent').length

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <div className="header" style={{ justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🌱</span>
          <span className="header-title">냥밭</span>
        </div>
        <span style={{ color:'#fff', fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.2)', padding:'4px 10px', borderRadius:20 }}>
          총 {points}포인트
        </span>
      </div>

      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', marginTop:-8, padding:'20px 18px 80px' }}>

        {/* 당근 메인 */}
        <div style={{ background:'linear-gradient(135deg,#e8f5e0,#c8e6c0)', borderRadius:20, padding:'24px 20px', marginBottom:16, textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:10, right:14, fontSize:10, fontWeight:700, color:'var(--g5)', background:'rgba(255,255,255,0.5)', padding:'3px 8px', borderRadius:10 }}>
            {stageNames[stage]}
          </div>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
            <CarrotSVG stage={stage} size={80}/>
          </div>
          {stage === 4 && (
            <button onClick={harvest}
              style={{ background:'#FF8A50', color:'#fff', border:'none', borderRadius:20, padding:'8px 20px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif', marginBottom:8 }}>
              🥕 수확하기
            </button>
          )}
          <div style={{ fontSize:12, color:'var(--g5)', fontWeight:600, marginBottom:8 }}>
            {stage < 4 ? `다음 단계까지 ${nextGoal[stage]-points}회 더 출석하면 돼요` : '당근이 다 자랐어요! 수확해봐요 🥕'}
          </div>
          {/* 프로그레스 바 */}
          <div style={{ height:10, background:'rgba(255,255,255,0.5)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ width:`${Math.min((points/12)*100,100)}%`, height:'100%', background:'linear-gradient(90deg,#FF8A50,#FF6B20)', borderRadius:10, transition:'width 0.5s' }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--g5)', marginTop:4, fontWeight:600 }}>
            <span>{points}pt</span><span>12pt</span>
          </div>
        </div>

        {/* 성장 단계 */}
        <div style={{ background:'var(--g1)', borderRadius:14, padding:'12px 14px', marginBottom:14, border:'1.5px solid var(--g2)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--tm)', marginBottom:10 }}>당근 성장 단계</div>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-around' }}>
            {[1,2,3,4].map(s => (
              <div key={s} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, opacity:stage>=s?1:0.4 }}>
                <CarrotSVG stage={s} size={32}/>
                <div style={{ fontSize:8, fontWeight:700, color:stage===s?'var(--g4)':'var(--tmu)' }}>{stageNames[s]}</div>
                <div style={{ fontSize:8, color:'var(--tmu)' }}>{[,'1~3','4~7','8~11','12~'][s]}회</div>
              </div>
            ))}
          </div>
        </div>

        {/* 통계 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          <div style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', border:'1.5px solid var(--g2)' }}>
            <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700, marginBottom:2 }}>총 출석</div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--td)' }}>{attended}<span style={{ fontSize:11, color:'var(--tmu)' }}> 회</span></div>
          </div>
          <div style={{ background:'var(--g1)', borderRadius:14, padding:'10px 14px', border:'1.5px solid var(--g2)' }}>
            <div style={{ fontSize:10, color:'var(--tm)', fontWeight:700, marginBottom:2 }}>결석</div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--td)' }}>{absent}<span style={{ fontSize:11, color:'var(--tmu)' }}> 회</span></div>
          </div>
        </div>

        {/* 최근 이력 */}
        <div style={{ fontSize:13, fontWeight:800, color:'var(--td)', marginBottom:10 }}>최근 이력</div>
        {history.slice(0,8).map(h => (
          <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--g1)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
              background:h.status==='attended'?'var(--g4)':h.status==='absent'?'#d4a0a0':'var(--tmu)' }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--td)', fontWeight:600 }}>{h.class_name}</div>
              <div style={{ fontSize:10, color:'var(--tmu)' }}>{h.class_date}</div>
            </div>
            <span style={{ fontSize:11, fontWeight:800, color:h.status==='attended'?'var(--g4)':'var(--tmu)' }}>
              {h.status==='attended'?'+1 pt':'0 pt'}
            </span>
          </div>
        ))}
        {history.length === 0 && (
          <div style={{ textAlign:'center', padding:20, color:'var(--tmu)', fontSize:12 }}>아직 수업 이력이 없어요 🐾</div>
        )}
      </div>

      <nav className="bottom-nav">
        {[
          { href:'/student', label:'일정', icon:'📅' },
          { href:'/student/notification', label:'알림', icon:'🔔' },
          { href:'/student/farm', label:'냥밭', icon:'🌱', active:true },
          { href:'/lounge', label:'라운지', icon:'💬' },
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