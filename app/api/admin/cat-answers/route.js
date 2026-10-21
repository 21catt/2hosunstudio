import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 냥이 질문에 고른 답 모아 보기 — 오너·강사(승인된) (2026-10-21)
//
// 답은 학생 auth user_metadata.cat_answers 에 있다(lib/catTalk — 표·마이그레이션 없이).
// 여기서 서비스 키로 전원을 읽어 최신순으로 돌려준다. 읽기만 한다.

async function requireStaff(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data: me } = await supabaseAdmin.from('users').select('role, approved').eq('id', user.id).maybeSingle()
  return (me?.role === 'admin' || me?.role === 'teacher') && me?.approved !== false ? user : null
}

export async function GET(req) {
  if (!(await requireStaff(req))) return NextResponse.json({ error: '선생님만 볼 수 있어요' }, { status: 403 })
  const { data: rows } = await supabaseAdmin.from('users').select('id, name, role')
  const who = new Map((rows || []).map(r => [r.id, r]))
  const answers = []
  for (let page = 1; page < 20; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    const list = data?.users || []
    for (const u of list) {
      const arr = u.user_metadata?.cat_answers
      if (!Array.isArray(arr) || !arr.length) continue
      const r = who.get(u.id)
      for (const a of arr) {
        if (!a?.q || !a?.a || !a?.at) continue
        answers.push({ userId: u.id, name: r?.name || u.user_metadata?.name || '이름 없음', role: r?.role || u.user_metadata?.role || '',
          q: String(a.q), a: String(a.a), place: a.place || '', at: a.at })
      }
    }
    if (list.length < 200) break
  }
  answers.sort((x, y) => (y.at || '').localeCompare(x.at || ''))
  return NextResponse.json({ ok: true, answers })
}
