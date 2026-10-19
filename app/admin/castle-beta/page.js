'use client'
// 새 3D 홈 미리보기 학생 — 오너 전용 (2026-10-19)
// 여기서 켠 학생만 학생 홈에서 「새 3D 홈 미리보기」 입구를 보고 /castle 에 들어갈 수 있다.
// 어디에서도 링크하지 않는다 — /castle(관리자 화면) 오른쪽 아래 「미리보기 학생」에서만 들어온다.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'

const BORDER = 'var(--line)'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const t = data?.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function CastleBetaPage() {
  const router = useRouter()
  const [members, setMembers] = useState(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.replace('/student'); return }
      const res = await fetch('/api/admin/castle-beta', { headers: await authHeader() })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error || `불러오지 못했어요 (${res.status})`); setMembers([]); return }
      setMembers(j.members || [])
    })
  }, [])

  async function toggle(m) {
    setBusy(m.id); setError('')
    const res = await fetch('/api/admin/castle-beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ userId: m.id, on: !m.beta }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || !j.ok) { setError(j.error || `바꾸지 못했어요 (${res.status})`); return }
    setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, beta: j.beta } : x)))
  }

  const shown = useMemo(() => (members || []).filter(m => !search.trim() || (m.name || '').includes(search.trim())), [members, search])
  const onCount = (members || []).filter(m => m.beta).length

  return (
    <>
      <div className="header"><span className="header-title">새 3D 홈 미리보기 학생</span></div>
      <div style={{ background: 'var(--page)', borderRadius: '24px 24px 0 0', marginTop: -8, padding: '18px 14px 110px', minHeight: '80vh' }}>
        <div style={{ fontSize: 12, color: 'var(--tmu)', lineHeight: 1.6, marginBottom: 12 }}>
          켠 학생에게만 학생 홈에 「새 3D 홈 미리보기」 입구가 보여요. 학생은 언제든 「예전 홈으로」 돌아갈 수 있어요.
          지금 <b style={{ color: 'var(--td)' }}>{onCount}명</b> 미리보기 중.
        </div>
        <a href="/castle" style={{ display: 'inline-block', marginBottom: 12, fontSize: 12, fontWeight: 700, color: 'var(--acTx)' }}>← 3D 홈으로</a>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름으로 찾기" aria-label="이름으로 찾기"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`, fontSize: 13, marginBottom: 12, background: 'var(--surf)', color: 'var(--td)' }} />
        {error && <div role="alert" style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {members === null ? <div style={{ fontSize: 12, color: 'var(--tmu)' }}>불러오는 중…</div> : shown.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 14, border: `1.5px solid ${m.beta ? 'var(--ac)' : BORDER}`, background: m.beta ? 'var(--acBg)' : 'var(--card)', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--td)' }}>{m.name || '이름 없음'}</div>
              <div style={{ fontSize: 11, color: 'var(--tmu)' }}>{m.role === 'artist' ? '전시 참여 작가' : '수강생'}</div>
            </div>
            <button onClick={() => toggle(m)} disabled={busy === m.id} aria-pressed={m.beta}
              style={{ padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: m.beta ? 'var(--ac)' : 'var(--g1)', color: m.beta ? '#fff' : 'var(--td)' }}>
              {busy === m.id ? '…' : m.beta ? '미리보기 켜짐' : '미리 열기'}
            </button>
          </div>
        ))}
      </div>
      <AdminNav active="home" />
    </>
  )
}
