'use client'
// 냥이 질문 답 — 학생이 젤리성·3D 냥밭 냥이의 질문에 고른 답을 선생님이 본다 (2026-10-21)
// 오너·강사(승인된) — 관리자 홈 「냥이 답」 타일 · 강사 홈 링크에서 들어온다. 읽기만 한다.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { isOwner, isTeacher, isPendingStaff } from '../../../lib/roles'
import { CAT_QUESTIONS, questionTitle } from '../../../lib/catTalk'
import AdminNav from '../../../components/AdminNav'
import TeacherNav from '../../../components/TeacherNav'

const BORDER = 'var(--line)'
const fmt = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const t = data?.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function CatAnswersPage() {
  const router = useRouter()
  const [owner, setOwner] = useState(false)
  const [answers, setAnswers] = useState(null)
  const [qPick, setQPick] = useState('all')
  const [latestOnly, setLatestOnly] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      if (!u) { router.replace('/login'); return }
      if (!isTeacher(u) || isPendingStaff(u)) { router.replace('/student'); return }
      setOwner(isOwner(u))
      const res = await fetch('/api/admin/cat-answers', { headers: await authHeader() })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error || `불러오지 못했어요 (${res.status})`); setAnswers([]); return }
      setAnswers(j.answers || [])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 질문별 · (학생마다 가장 최근 답만 | 전부)
  const shown = useMemo(() => {
    let list = (answers || []).filter(a => qPick === 'all' || a.q === qPick)
    if (latestOnly) {
      const seen = new Set()
      list = list.filter(a => { const k = `${a.userId}|${a.q}`; if (seen.has(k)) return false; seen.add(k); return true })
    }
    return list
  }, [answers, qPick, latestOnly])

  // 질문 하나를 골랐을 때 — 답별 사람 수(학생마다 가장 최근 답 기준)
  const tally = useMemo(() => {
    if (qPick === 'all' || !answers) return null
    const q = CAT_QUESTIONS.find(x => x.id === qPick)
    const seen = new Set(), count = {}
    for (const a of answers) {
      if (a.q !== qPick || seen.has(a.userId)) continue
      seen.add(a.userId); count[a.a] = (count[a.a] || 0) + 1
    }
    const opts = [...(q?.options || []), ...Object.keys(count).filter(k => !q?.options.includes(k))]
    return { opts, count, total: seen.size }
  }, [answers, qPick])

  const pill = on => ({ padding: '7px 12px', borderRadius: 20, border: `1.5px solid ${on ? 'var(--ac)' : BORDER}`, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    background: on ? 'var(--acBg)' : 'var(--card)', color: 'var(--td)' })

  return (
    <>
      <div className="header"><span className="header-title">냥이 질문 답</span></div>
      <div style={{ background: 'var(--page)', borderRadius: '24px 24px 0 0', marginTop: -8, padding: '18px 14px 110px', minHeight: '80vh' }}>
        <div style={{ fontSize: 12, color: 'var(--tmu)', lineHeight: 1.6, marginBottom: 12 }}>
          젤리성 홈·3D 냥밭의 냥이가 하루 한 번 묻는 질문에 학생이 고른 답이에요. 수업 준비에 참고해 주세요.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <button style={pill(qPick === 'all')} onClick={() => setQPick('all')}>전체</button>
          {CAT_QUESTIONS.map(q => <button key={q.id} style={pill(qPick === q.id)} onClick={() => setQPick(q.id)}>{q.title}</button>)}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--td)', marginBottom: 12 }}>
          <input type="checkbox" checked={latestOnly} onChange={e => setLatestOnly(e.target.checked)} /> 학생마다 가장 최근 답만
        </label>

        {tally && tally.total > 0 && (
          <div style={{ border: `1.5px solid ${BORDER}`, background: 'var(--card)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--td)', marginBottom: 8 }}>{questionTitle(qPick)} · {tally.total}명</div>
            {tally.opts.map(o => {
              const n = tally.count[o] || 0
              return (
                <div key={o} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 28px', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 5, color: 'var(--td)' }}>
                  <span>{o}</span>
                  <span style={{ height: 8, borderRadius: 4, background: 'var(--g1)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${(n / tally.total) * 100}%`, background: 'var(--ac)' }} />
                  </span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                </div>
              )
            })}
          </div>
        )}

        {error && <div role="alert" style={{ color: '#c0392b', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {answers === null ? <div style={{ fontSize: 12, color: 'var(--tmu)' }}>불러오는 중…</div>
          : shown.length === 0 ? <div style={{ fontSize: 12, color: 'var(--tmu)', textAlign: 'center', padding: 24 }}>아직 고른 답이 없어요 🐾</div>
          : shown.map((a, i) => (
            <div key={`${a.userId}-${a.at}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'var(--card)', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--td)' }}>{a.name}<span style={{ fontWeight: 400, fontSize: 11, color: 'var(--tmu)', marginLeft: 6 }}>{a.role === 'artist' ? '작가' : '수강생'}</span></div>
                <div style={{ fontSize: 11, color: 'var(--tmu)' }}>{questionTitle(a.q)} · {fmt(a.at)}</div>
              </div>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--acBg)', color: 'var(--acTx)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{a.a}</span>
            </div>
          ))}
      </div>
      {owner ? <AdminNav active="home" /> : <TeacherNav active="home" />}
    </>
  )
}
