'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const CATS = [
  { id:'drawing', emoji:'✏️', name:'드로잉', desc:'선과 형태 관찰' },
  { id:'painting', emoji:'🎨', name:'페인팅', desc:'색채와 표현' },
  { id:'sculpture', emoji:'🗿', name:'조소', desc:'입체와 재료' },
  { id:'free', emoji:'🖼️', name:'자율창작', desc:'자유로운 작업' },
]

const ROLES = [
  { id:'student', emoji:'🎨', name:'수강생', desc:'수업 예약, 냥밭, 출석 현황을 확인할 수 있어요' },
  { id:'admin', emoji:'✏️', name:'강사', desc:'수강생 관리, 수업 등록, 예약 현황을 관리할 수 있어요' },
  { id:'artist', emoji:'🖼️', name:'전시 참여 작가', desc:'회의 일정 참여, 냥밭에서 당근 포인트를 모을 수 있어요' },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [cats, setCats] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleCat(id) {
    setCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSignup() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: {
        data: { name, phone, role, categories:[...cats], approved: role==='student' || role==='artist' }
      }
    })
    if (error) { setError(error.message); setLoading(false); return }
    await supabase.from('users').insert({
      id: data.user.id, name, phone, role, categories:[...cats]
    })
    if (role==='student') router.push('/student')
    else if (role==='artist') router.push('/artist')
    else router.push('/login')
  }

  // step 1에서 다음 누르면, 작가는 바로 가입, 학생/강사는 step 2
  function handleStep1Next() {
    if (role === 'artist') handleSignup()
    else setStep(2)
  }

  if (step===0) return (
    <>
      <div className="header"><span className="header-title">2호선 스튜디오</span></div>
      <div className="page-body" style={{ paddingTop:32 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🐱</div>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--td)', marginBottom:6 }}>어떤 역할로 시작할까요?</div>
        </div>
        {ROLES.map(r => (
          <div key={r.id} onClick={()=>setRole(r.id)}
            style={{ border:`1.5px solid ${role===r.id?'var(--g4)':'var(--g1)'}`, background:role===r.id?'#e8f5e0':'var(--surf)',
              borderRadius:16, padding:'16px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'var(--g1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{r.emoji}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:3 }}>{r.name}</div>
              <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.5 }}>{r.desc}</div>
            </div>
            <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${role===r.id?'var(--g4)':'var(--g2)'}`,
              background:role===r.id?'var(--g4)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {role===r.id && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 3.5,7 9,1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
            </div>
          </div>
        ))}
        <div style={{ height:16 }}/>
        <button className="btn-primary" disabled={!role} onClick={()=>setStep(1)}>다음</button>
        <button className="btn-secondary" onClick={()=>router.push('/login')}>이미 계정이 있어요 → 로그인</button>
      </div>
    </>
  )

  if (step===1) return (
    <>
      <div className="header">
        <button onClick={()=>setStep(0)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'#fff', fontSize:18 }}>‹</button>
        <span className="header-title">기본 정보 입력</span>
        {role !== 'artist' ? (
          <div style={{ display:'flex', gap:4 }}>
            {[0,1,2].map(i=><div key={i} style={{ width:i===0?18:6, height:6, borderRadius:4, background:i===0?'#fff':'rgba(255,255,255,0.4)' }}/>)}
          </div>
        ) : <div style={{ width:32 }}/>}
      </div>
      <div className="page-body">
        <div className="field"><label>이름</label><input placeholder="실명을 입력해 주세요" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><label>휴대폰 번호</label><input placeholder="010-0000-0000" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
        <div className="field"><label>이메일</label><input type="email" placeholder="example@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="field"><label>비밀번호</label><input type="password" placeholder="8자 이상" value={pw} onChange={e=>setPw(e.target.value)}/></div>
          <div className="field"><label>비밀번호 확인</label><input type="password" placeholder="재입력" value={pw2} onChange={e=>setPw2(e.target.value)}
            style={{ borderColor:pw2&&pw!==pw2?'#e07070':'' }}/></div>
        </div>
        {error && <div style={{ color:'#c0392b', fontSize:12, marginBottom:12, fontWeight:600 }}>{error}</div>}
        <button className="btn-primary" disabled={loading||!name||!email||!pw||pw!==pw2||pw.length<8} onClick={handleStep1Next}>
          {loading?'가입 중...':role==='artist'?'작가 가입 완료':'다음'}
        </button>
      </div>
    </>
  )

  return (
    <>
      <div className="header">
        <button onClick={()=>setStep(1)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'#fff', fontSize:18 }}>‹</button>
        <span className="header-title">{role==='student'?'관심 수업 선택':'담당 수업 선택'}</span>
        <div style={{ display:'flex', gap:4 }}>
          {[0,1,2].map(i=><div key={i} style={{ width:i===1?18:6, height:6, borderRadius:4, background:i===1?'#fff':'rgba(255,255,255,0.4)' }}/>)}
        </div>
      </div>
      <div className="page-body">
        <div style={{ fontSize:12, color:'var(--tmu)', marginBottom:14, lineHeight:1.6 }}>
          {role==='student'?'관심 있는 수업을 선택해 주세요.':'담당하는 수업을 선택해 주세요. 선택한 수업의 예약·학생 현황만 확인됩니다.'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          {CATS.map(c=>(
            <div key={c.id} onClick={()=>toggleCat(c.id)}
              style={{ border:`1.5px solid ${cats.has(c.id)?'var(--g4)':'var(--g1)'}`, background:cats.has(c.id)?'#e8f5e0':'var(--surf)',
                borderRadius:12, padding:'12px 10px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{ fontSize:22 }}>{c.emoji}</div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--td)' }}>{c.name}</div>
              <div style={{ fontSize:9, color:'var(--tmu)', textAlign:'center' }}>{c.desc}</div>
            </div>
          ))}
        </div>
        {error && <div style={{ color:'#c0392b', fontSize:12, marginBottom:12, fontWeight:600 }}>{error}</div>}
        <button className="btn-primary" disabled={loading||(role==='admin'&&cats.size===0)} onClick={handleSignup}>
          {loading?'가입 중...':role==='admin'?'강사 등록 완료':'가입 완료'}
        </button>
      </div>
    </>
  )
}