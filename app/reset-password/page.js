'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleReset() {
    if (pw !== pw2) { setError('비밀번호가 일치하지 않아요'); return }
    if (pw.length < 8) { setError('8자 이상 입력해 주세요'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { setError('오류가 발생했어요. 다시 시도해 주세요.'); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (done) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48 }}>✅</div>
      <div style={{ fontSize:16, fontWeight:800, color:'var(--td)' }}>비밀번호가 변경됐어요</div>
      <div style={{ fontSize:12, color:'var(--tmu)' }}>로그인 화면으로 이동합니다...</div>
    </div>
  )

  return (
    <>
      <div className="header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🐱</span>
          <span className="header-title">비밀번호 재설정</span>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:40 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>🔑</div>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--td)', marginBottom:6 }}>새 비밀번호 설정</div>
          <div style={{ fontSize:12, color:'var(--tmu)' }}>새로운 비밀번호를 입력해 주세요</div>
        </div>
        <div className="field">
          <label>새 비밀번호</label>
          <input type="password" placeholder="8자 이상"
            value={pw} onChange={e=>setPw(e.target.value)}/>
        </div>
        <div className="field">
          <label>비밀번호 확인</label>
          <input type="password" placeholder="재입력"
            value={pw2} onChange={e=>setPw2(e.target.value)}
            style={{ borderColor:pw2&&pw!==pw2?'#e07070':'' }}/>
        </div>
        {error && <div style={{ color:'#c0392b', fontSize:12, marginBottom:12, fontWeight:600 }}>{error}</div>}
        <button className="btn-primary" onClick={handleReset}
          disabled={loading||!pw||!pw2||pw!==pw2}>
          {loading?'변경 중...':'비밀번호 변경'}
        </button>
      </div>
    </>
  )
}