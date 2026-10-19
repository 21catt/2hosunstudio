import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 새 3D 홈(/castle) 미리보기 학생 지정 — 오너(승인된 관리자)만 (2026-10-19)
//
// 표는 auth 의 user_metadata.castle_beta(true/false/없음 — true 만 미리보기) — DB 표·마이그레이션 없이 바로 쓴다.
// 학생 화면은 supabase.auth.getUser()(서버에서 새로 읽음)로 이 값을 보므로, 켜고 나서
// 학생이 페이지를 새로 열면 바로 입구가 보인다(다시 로그인할 필요 없음).

async function requireOwner(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data: me } = await supabaseAdmin.from('users').select('role, approved').eq('id', user.id).maybeSingle()
  return me?.role === 'admin' && me?.approved !== false ? user : null
}

// 목록 — 학생·작가 전부와 지금 미리보기 여부
export async function GET(req) {
  if (!(await requireOwner(req))) return NextResponse.json({ error: '관리자만 볼 수 있어요' }, { status: 403 })
  const { data: rows } = await supabaseAdmin.from('users').select('id, name, role').in('role', ['student', 'artist']).order('name')
  const ids = new Set((rows || []).map(r => r.id))
  const beta = new Set()
  for (let page = 1; page < 20; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    const list = data?.users || []
    list.forEach(u => { if (ids.has(u.id) && u.user_metadata?.castle_beta === true) beta.add(u.id) })
    if (list.length < 200) break
  }
  return NextResponse.json({ ok: true, members: (rows || []).map(r => ({ ...r, beta: beta.has(r.id) })) })
}

// 켜기·끄기 — { userId, on }
export async function POST(req) {
  if (!(await requireOwner(req))) return NextResponse.json({ error: '관리자만 바꿀 수 있어요' }, { status: 403 })
  const { userId, on } = await req.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: '대상이 없어요' }, { status: 400 })
  const { data: target, error: gErr } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (gErr || !target?.user) return NextResponse.json({ error: '대상을 찾을 수 없어요' }, { status: 404 })
  const meta = { ...(target.user.user_metadata || {}) }
  meta.castle_beta = !!on // 끌 때도 false 로 적는다 — 메타 갱신이 키 단위 병합이면 지운 키가 남는다
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: meta })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, beta: !!on })
}
