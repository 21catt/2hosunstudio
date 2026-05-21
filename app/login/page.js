'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedRole, setSelectedRole] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // 역할 선택 시 그 역할의 마지막 로그인 이메일 자동 채우기
  useEffect(() => {
    if (selectedRole && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`lastEmail_${selectedRole}`)
      if (saved) setEmail(saved)
    }
  }, [selectedRole])

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) {
      setError('이메일 또는 비밀번호를 확인해 주세요.')
      setLoading(false)
      return
    }
    const role = data.user.user_metadata?.role

    // 역할 체크
    if (selectedRole === 'admin' && role !== 'admin') {
      setError('강사 계정이 아니에요.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    if (selectedRole === 'student' && role !== 'student' && role !== 'admin') {
      setError('수강생 계정이 아니에요.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    if (selectedRole === 'artist' && role !== 'artist' && role !== 'admin') {
      setError('작가 계정이 아니에요.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // 마지막 로그인 이메일 저장 (역할별)
    localStorage.setItem(`lastEmail_${selectedRole}`, email)

    if (selectedRole === 'admin') router.push('/admin')
    else if (selectedRole === 'artist') router.push('/artist')
    else router.push('/student')
  }

  async function handleReset() {
    if (!resetEmail) return
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) { setError('이메일을 확인해 주세요.'); return }
    setResetSent(true)
  }

  // 역할 선택 화면
  if (step === 0) return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🐱</span>
          <span className="header-title">2호선 스튜디오</span>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:40 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>🐱</div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--td)', marginBottom:6 }}>어떤 역할로 로그인할까요?</div>
          <div style={{ fontSize:12, color:'var(--tmu)' }}>계정 유형을 선택해 주세요</div>
        </div>

        {[
          { id:'student', emoji:'🎨', name:'수강생', desc:'수업 예약, 냥밭, 출석 현황 확인' },
          { id:'admin', emoji:'✏️', name:'강사', desc:'수강생 관리, 수업 현황 관리' },
          { id:'artist', emoji:'🖼️', name:'전시 참여 작가', desc:'회의 일정 참여, 냥밭 활동' },
        ].map(r => (
          <div key={r.id} onClick={() => setSelectedRole(r.id)}
            style={{ border:`1.5px solid ${selectedRole===r.id?'var(--g4)':'var(--g1)'}`,
              background:selectedRole===r.id?'#e8f5e0':'var(--surf)',
              borderRadius:16, padding:'16px 14px', marginBottom:10,
              display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'var(--g1)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{r.emoji}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--td)', marginBottom:3 }}>{r.name}</div>
              <div style={{ fontSize:11, color:'var(--tmu)', lineHeight:1.5 }}>{r.desc}</div>
            </div>
            <div style={{ width:20, height:20, borderRadius:'50%',
              border:`2px solid ${selectedRole===r.id?'var(--g4)':'var(--g2)'}`,
              background:selectedRole===r.id?'var(--g4)':'transparent',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {selectedRole===r.id && <svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 3.5,7 9,1" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
            </div>
          </div>
        ))}

        <div style={{ height:16 }}/>
        <button className="btn-primary" disabled={!selectedRole} onClick={() => setStep(1)}>
          다음
        </button>
        <button className="btn-secondary" onClick={() => router.push('/signup')}>
          계정이 없어요 → 가입하기
        </button>
      </div>
    </>
  )

  // 비밀번호 찾기
  if (step === 2) return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => { setStep(1); setError(''); setResetSent(false) }}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'#fff', fontSize:18 }}>‹</button>
          <span className="header-title">비밀번호 찾기</span>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:40 }}>
        {resetSent ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📧</div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--td)', marginBottom:8 }}>이메일을 확인해 주세요</div>
            <div style={{ fontSize:12, color:'var(--tmu)', lineHeight:1.7, marginBottom:24 }}>
              {resetEmail} 으로<br/>비밀번호 재설정 링크를 보냈어요
            </div>
            <button className="btn-primary" onClick={() => { setStep(1); setResetSent(false) }}>
              로그인으로 돌아가기
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:48, marginBottom:10 }}>🔑</div>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--td)', marginBottom:6 }}>비밀번호 재설정</div>
              <div style={{ fontSize:12, color:'var(--tmu)', lineHeight:1.6 }}>
                가입한 이메일을 입력하면<br/>재설정 링크를 보내드려요
              </div>
            </div>
            <div className="field">
              <label>이메일</label>
              <input type="email" placeholder="가입한 이메일 입력"
                value={resetEmail} onChange={e => setResetEmail(e.target.value)}/>
            </div>
            {error && <div style={{ color:'#c0392b', fontSize:12, marginBottom:12, fontWeight:600 }}>{error}</div>}
            <button className="btn-primary" onClick={handleReset} disabled={!resetEmail}>
              재설정 링크 보내기
            </button>
          </>
        )}
      </div>
    </>
  )

  // 로그인 화면
  const roleEmoji = selectedRole === 'admin' ? '✏️' : selectedRole === 'artist' ? '🖼️' : '🐱'
  const roleTitle = selectedRole === 'admin' ? '강사 로그인' : selectedRole === 'artist' ? '작가 로그인' : '수강생 로그인'

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => { setStep(0); setError('') }}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'#fff', fontSize:18 }}>‹</button>
          <span className="header-title">{roleTitle}</span>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:40 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>{roleEmoji}</div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--td)', marginBottom:6 }}>{roleTitle}</div>
          <div style={{ fontSize:12, color:'var(--tmu)' }}>2호선 스튜디오에 오신 걸 환영해요</div>
        </div>

        <div className="field">
          <label>이메일</label>
          <input type="email" placeholder="example@email.com"
            value={email} onChange={e => setEmail(e.target.value)}/>
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input type="password" placeholder="비밀번호 입력"
            value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key==='Enter' && handleLogin()}/>
        </div>

        {error && <div style={{ color:'#c0392b', fontSize:12, marginBottom:12, fontWeight:600 }}>{error}</div>}

        <div style={{ textAlign:'right', marginBottom:16 }}>
          <span onClick={() => { setStep(2); setError('') }}
            style={{ fontSize:11, color:'var(--g4)', fontWeight:700, cursor:'pointer' }}>
            비밀번호를 잊으셨나요?
          </span>
        </div>

        <button className="btn-primary" onClick={handleLogin} disabled={loading||!email||!pw}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <button className="btn-secondary" onClick={() => router.push('/signup')}>
          계정이 없어요 → 가입하기
        </button>
      </div>
    </>
  )
}