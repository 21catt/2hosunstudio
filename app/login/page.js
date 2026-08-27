'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { isTeacher, isPendingStaff } from '../../lib/roles'
import { NavIcon } from '../../components/NavIcons'
import { LogoMark } from '../../components/Deco'

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
    // '강사 로그인'은 강사(teacher) + 오너(admin) 모두 허용 — 오너 겸 강사가 강사 화면으로 바로 들어갈 수 있게
    if (selectedRole === 'teacher' && !isTeacher(role)) {
      setError('강사 계정이 아니에요.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    // '관리자 로그인'은 오너만
    if (selectedRole === 'admin' && role !== 'admin') {
      setError('관리자 계정이 아니에요.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    // 승인 전 직원(강사·관리자)은 차단 — 가입만으로 권한이 생기면 안 된다
    if (isPendingStaff(data.user)) {
      setError('아직 오너 승인 전이에요. 승인 후 로그인할 수 있어요 🐾')
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

    // 고른 입구대로 이동 — 오너가 '강사 로그인'을 골랐으면 강사 화면으로 보낸다
    if (selectedRole === 'teacher') router.push('/teacher')
    else if (selectedRole === 'admin') router.push('/admin')
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
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <LogoMark />
          <span className="p-title">2호선 스튜디오</span>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:36 }}>
        <div style={{ textAlign:'center', marginBottom:26 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>🐱</div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--td)', marginBottom:6 }}>어떤 계정으로 로그인할까요?</div>
          <div style={{ fontSize:12, color:'var(--tmu)' }}>역할을 선택하면 로그인 화면으로 이동해요</div>
        </div>

        {[
          { id:'student', icon:'users', name:'수강생', desc:'수업 예약 · 출석 · 냥밭' },
          { id:'artist', icon:'palette', name:'전시 참여작가', desc:'회의 일정 참여 · 냥밭 활동' },
        ].map(r => (
          <div key={r.id} onClick={() => { setSelectedRole(r.id); setStep(1) }}
            style={{ border:'1.5px solid var(--g2)', background:'#fff', borderRadius:16, padding:'16px 16px', marginBottom:10,
              display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'var(--acBg)', border:'1.5px solid var(--ac)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <NavIcon name={r.icon} color="var(--ac)" size={24} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--td)', marginBottom:3 }}>{r.name}</div>
              <div style={{ fontSize:11, color:'var(--tmu)' }}>{r.desc}</div>
            </div>
            <span style={{ fontSize:18, color:'var(--tmu)' }}>›</span>
          </div>
        ))}

        <button className="btn-secondary" style={{ marginTop:6 }} onClick={() => router.push('/signup')}>
          계정이 없어요 → 가입하기
        </button>

        {/* 강사와 관리자는 권한이 달라 입구를 분리한다(강사는 오너 승인 후 이용) */}
        <div style={{ display:'flex', gap:8, marginTop:22 }}>
          {[
            { id:'teacher', label:'강사 로그인', icon:'clipboard' },
            { id:'admin', label:'관리자 로그인', icon:'card' },
          ].map(r => (
            <div key={r.id} onClick={() => { setSelectedRole(r.id); setStep(1) }}
              style={{ flex:1, border:'1.5px solid var(--g2)', background:'var(--g1)', borderRadius:14, padding:'12px 10px',
                display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer' }}>
              <NavIcon name={r.icon} color="var(--tm)" size={20} />
              <span style={{ fontSize:11.5, fontWeight:800, color:'var(--tm)' }}>{r.label}</span>
            </div>
          ))}
        </div>

      </div>
    </>
  )

  // 비밀번호 찾기
  if (step === 2) return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => { setStep(1); setError(''); setResetSent(false) }}
            style={{ background:'var(--surf)', border:'1.5px solid var(--g2)', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'var(--td)', fontSize:18 }}>‹</button>
          <span className="p-title">비밀번호 찾기</span>
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
  const ROLE_UI = {
    teacher: { emoji:'✏️', title:'강사 로그인', hint:'담당 수업·출석·기록 피드백' },
    admin:   { emoji:'🔑', title:'관리자 로그인', hint:'전체 운영·수강권·정산' },
    artist:  { emoji:'🖼️', title:'작가 로그인', hint:'' },
    student: { emoji:'🐱', title:'수강생 로그인', hint:'' },
  }
  const roleUI = ROLE_UI[selectedRole] || ROLE_UI.student
  const roleEmoji = roleUI.emoji
  const roleTitle = roleUI.title

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => { setStep(0); setError('') }}
            style={{ background:'var(--surf)', border:'1.5px solid var(--g2)', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'var(--td)', fontSize:18 }}>‹</button>
          <span className="p-title">{roleTitle}</span>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:40 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>{roleEmoji}</div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--td)', marginBottom:6 }}>{roleTitle}</div>
          <div style={{ fontSize:12, color:'var(--tmu)' }}>{roleUI.hint || '2호선 스튜디오에 오신 걸 환영해요'}</div>
        </div>

        <div className="field">
          <label>이메일</label>
          <input type="email" placeholder="example@email.com"
  autoComplete="username"
  value={email} onChange={e => setEmail(e.target.value)}/>
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input type="password" placeholder="비밀번호 입력"
  autoComplete="current-password"
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
        <button className="btn-secondary"
          onClick={() => router.push(
            selectedRole === 'teacher' ? '/signup?role=teacher'
            : selectedRole === 'admin' ? '/signup?role=admin'
            : '/signup')}>
          {selectedRole === 'teacher' ? '강사 계정이 없어요 → 강사로 가입하기'
           : selectedRole === 'admin' ? '관리자 계정이 없어요 → 관리자로 가입하기'
           : '계정이 없어요 → 가입하기'}
        </button>
        {(selectedRole === 'teacher' || selectedRole === 'admin') && (
          <div style={{ fontSize:11, color:'var(--tmu)', textAlign:'center', marginTop:10, lineHeight:1.6 }}>
            {selectedRole === 'admin'
              ? '관리자 가입은 오너 승인 후 로그인할 수 있어요. 운영 전권이 열리는 계정이에요.'
              : '강사 가입은 관리자 승인 후 로그인할 수 있어요.'}
          </div>
        )}
      </div>
    </>
  )
}