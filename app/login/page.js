'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    if (role === 'admin') router.push('/admin')
    else router.push('/student')
  }

  return (
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
          <div style={{ fontSize:18, fontWeight:800, color:'var(--td)', marginBottom:6 }}>로그인</div>
          <div style={{ fontSize:12, color:'var(--tmu)' }}>2호선 스튜디오에 오신 걸 환영해요</div>
        </div>
        <div className="field">
          <label>이메일</label>
          <input type="email" placeholder="example@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input type="password" placeholder="비밀번호 입력" value={pw} onChange={e=>setPw(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        </div>
        {error && <div style={{ color:'#c0392b', fontSize:12, marginBottom:12, fontWeight:600 }}>{error}</div>}
        <button className="btn-primary" onClick={handleLogin} disabled={loading||!email||!pw}>
          {loading?'로그인 중...':'로그인'}
        </button>
        <button className="btn-secondary" onClick={()=>router.push('/signup')}>
          계정이 없어요 → 가입하기
        </button>
      </div>
    </>
  )
}