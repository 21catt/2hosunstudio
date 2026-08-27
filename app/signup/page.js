'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { notifyAllAdmins } from '../../lib/adminNotify'
import { pixelCatImg } from '../../lib/pixelCats'

const CATS = [
  { id:'drawing', emoji:'✏️', name:'드로잉', desc:'선과 형태 관찰' },
  { id:'painting', emoji:'🎨', name:'페인팅', desc:'색채와 표현' },
  { id:'sculpture', emoji:'🗿', name:'조소', desc:'입체와 재료' },
  { id:'free', emoji:'🖼️', name:'자율창작', desc:'자유로운 작업' },
]

// 메인 역할(큰 카드) — 강사는 하단 링크로 별도 처리. cat: 프로필/로딩과 같은 픽셀 고양이 얼굴
const ROLES = [
  { id:'student', cat:'01-happy', name:'수강생', desc:'수업 예약, 냥밭, 출석 현황을 확인할 수 있어요' },
  { id:'artist', cat:'10-playful', name:'전시 참여 작가', desc:'회의 일정 참여, 냥밭에서 당근 포인트를 모을 수 있어요' },
]

function SignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // /signup?role=teacher — 로그인 화면의 "강사로 가입하기"가 역할 고르는 단계를 건너뛴다
  const qr = searchParams.get('role')
  const qRole = (qr === 'teacher' || qr === 'admin') ? qr : ''
  const [step, setStep] = useState(qRole ? 1 : 0)
  const [role, setRole] = useState(qRole)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [cats, setCats] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 승인이 필요한 역할 — 가입만으로 권한이 열리면 안 되는 쪽
  const isStaffRole = r => r === 'teacher' || r === 'admin'

  // 가입 실패 사유는 영어 원문으로 온다 — 가장 흔한 것만 한국어로 바꾼다.
  // 모르는 사유는 원문 그대로 둔다(감추면 무슨 일인지 알 수 없다).
  function signupError(msg) {
    const m = String(msg || '')
    if (/already registered|already exists/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.'
    if (/Password should be at least/i.test(m)) return '비밀번호는 8자 이상으로 해주세요.'
    if (/invalid format|Unable to validate email/i.test(m)) return '이메일 형식을 확인해 주세요.'
    if (/only request this after|rate limit/i.test(m)) return '잠시 후 다시 시도해 주세요.'
    return m
  }

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
        // 강사(teacher)는 오너 승인 전까지 approved:false — 로그인 시 차단된다
        // 강사·관리자는 오너 승인 전까지 approved:false — 로그인·관리자 홈에서 막힌다
        data: { name, phone, role, categories:[...cats], approved: !isStaffRole(role) }
      }
    })
    if (error) { setError(signupError(error.message)); setLoading(false); return }
    // approved 컬럼이 없는 환경(마이그레이션 전)에서도 가입은 되게 폴백
    const base = { id: data.user.id, name, phone, role, categories:[...cats] }
    const { error: insErr } = await supabase.from('users').insert({ ...base, approved: !isStaffRole(role) })
    if (insErr) await supabase.from('users').insert(base)
    if (role==='student') router.push('/student')
    else if (role==='artist') router.push('/artist')
    else {
      // 승인해야 로그인이 열리므로 오너가 모르면 계정이 잠긴 채로 남는다.
      // 알림이 실패해도 가입은 끝난 것이라 막지 않는다(회원 관리에 승인 대기로 남아 있다).
      const admin = role === 'admin'
      try {
        await notifyAllAdmins({
          // 종류는 하나로 둔다 — 알림 화면의 "회원 관리에서 승인하기" 버튼을 그대로 쓴다
          type: 'teacher_signup',
          title: admin ? '🔑 관리자 가입 신청' : '🧑‍🏫 강사 가입 신청',
          body: `${name}님이 ${admin ? '관리자' : '강사'}로 가입 신청했어요. 회원 관리에서 승인해야 로그인할 수 있어요.`,
        })
      } catch {}
      alert(`${admin ? '관리자' : '강사'} 가입이 접수됐어요 🐾\n오너 승인 후 로그인할 수 있어요.`)
      router.push('/login')
    }
  }

  // step 1에서 다음 누르면 — 작가·관리자는 바로 가입(담당 수업 범위가 없다), 학생·강사는 step 2
  function handleStep1Next() {
    if (role === 'artist' || role === 'admin') handleSignup()
    else setStep(2)
  }

  if (step===0) return (
    <>
      <div className="header"><span className="header-title">2호선 스튜디오</span></div>
      <div className="page-body" style={{ paddingTop:32 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <img src={pixelCatImg('09-cat')} alt="" width={64} height={64}
            style={{ imageRendering:'pixelated', display:'block', margin:'0 auto 12px' }} />
          <div style={{ fontSize:16, fontWeight:800, color:'var(--td)', marginBottom:6 }}>어떤 역할로 시작할까요?</div>
        </div>
        {ROLES.map(r => {
          const on = role===r.id
          return (
            <div key={r.id} onClick={()=>setRole(r.id)}
              style={{ border: on?'2px solid var(--ac)':'1.5px solid var(--g2)', background: on?'var(--acBg)':'var(--surf)',
                borderRadius:16, padding:'15px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', transition:'border-color 0.15s, background 0.15s' }}>
              <div style={{ width:48, height:48, borderRadius:14, background: on?'#fff':'var(--acBg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                <img src={pixelCatImg(r.cat)} alt="" width={38} height={38} style={{ imageRendering:'pixelated', display:'block' }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:3 }}>{r.name}</div>
                <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.5 }}>{r.desc}</div>
              </div>
              <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, border:`2px solid ${on?'var(--ac)':'var(--g2)'}`,
                background: on?'var(--ac)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {on && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 3.5,7 9,1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
              </div>
            </div>
          )
        })}
        <div style={{ height:16 }}/>
        <button className="btn-primary" disabled={!role} onClick={()=>setStep(1)}>다음</button>
        <button className="btn-secondary" onClick={()=>router.push('/login')}>이미 계정이 있어요 → 로그인</button>
        <div onClick={()=>{ setRole('teacher'); setStep(1) }}
          style={{ marginTop:18, border:'1.5px solid var(--g2)', background:'var(--g1)', borderRadius:14,
            padding:'13px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'var(--surf)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20 }}>✏️</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--td)' }}>강사로 가입하기</div>
            <div style={{ fontSize:11, color:'var(--tmu)', marginTop:2, lineHeight:1.5 }}>담당 수업의 예약·출석·기록 피드백. 관리자 승인 후 이용할 수 있어요</div>
          </div>
          <span style={{ fontSize:18, color:'var(--tmu)', flexShrink:0 }}>›</span>
        </div>
      </div>
    </>
  )

  if (step===1) return (
    <>
      <div className="header">
        <button onClick={()=>{ if (qRole) router.push('/login'); else setStep(0) }} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'#fff', fontSize:18 }}>‹</button>
        <span className="header-title">{role==='teacher' ? '강사 가입 · 기본 정보' : role==='admin' ? '관리자 가입 · 기본 정보' : '기본 정보 입력'}</span>
        {role !== 'artist' ? (
          <div style={{ display:'flex', gap:4 }}>
            {[0,1,2].map(i=><div key={i} style={{ width:i===0?18:6, height:6, borderRadius:4, background:i===0?'#fff':'rgba(255,255,255,0.4)' }}/>)}
          </div>
        ) : <div style={{ width:32 }}/>}
      </div>
      <div className="page-body">
        <div className="field"><label>이름</label><input placeholder="실명을 입력해 주세요" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field">
          <label>휴대폰 번호{isStaffRole(role) && <span style={{ color:'var(--acTx)', fontSize:11, fontWeight:800, marginLeft:6 }}>승인 연락용 · 필수</span>}</label>
          <input placeholder="010-0000-0000" value={phone} onChange={e=>setPhone(e.target.value)}/>
        </div>
        <div className="field"><label>이메일</label><input type="email" placeholder="example@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="field"><label>비밀번호</label><input type="password" placeholder="8자 이상" value={pw} onChange={e=>setPw(e.target.value)}/></div>
          <div className="field"><label>비밀번호 확인</label><input type="password" placeholder="재입력" value={pw2} onChange={e=>setPw2(e.target.value)}
            style={{ borderColor:pw2&&pw!==pw2?'#e07070':'' }}/></div>
        </div>
        {role==='admin' && (
          <div style={{ fontSize:11.5, color:'var(--acTx)', background:'var(--acBg)', border:'1.5px solid rgb(var(--ac-rgb) / 0.3)', borderRadius:12, padding:'10px 12px', marginBottom:12, lineHeight:1.65 }}>
            관리자는 <b>수강권 부여 · 회원 삭제 · 전체 기록 열람</b>까지 되는 계정이에요.
            신청하면 오너에게 알림이 가고, <b>승인된 뒤부터</b> 로그인할 수 있어요.
          </div>
        )}
        {error && <div style={{ color:'#c0392b', fontSize:12, marginBottom:12, fontWeight:600 }}>{error}</div>}
        <button className="btn-primary"
          disabled={loading||!name||!email||!pw||pw!==pw2||pw.length<8||(isStaffRole(role)&&!phone.trim())}
          onClick={handleStep1Next}>
          {loading?'가입 중...':role==='artist'?'작가 가입 완료':role==='admin'?'관리자 가입 신청':'다음'}
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
        <button className="btn-primary" disabled={loading||(role==='teacher'&&cats.size===0)} onClick={handleSignup}>
          {loading?'가입 중...':role==='teacher'?'강사 가입 신청':'가입 완료'}
        </button>
        {role==='teacher' && (
          <div style={{ fontSize:11, color:'var(--tmu)', textAlign:'center', marginTop:10, lineHeight:1.6 }}>
            신청하면 관리자에게 알림이 갑니다. <b style={{ color:'var(--acTx)' }}>승인된 뒤부터</b> 로그인할 수 있어요.
          </div>
        )}
      </div>
    </>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  )
}
