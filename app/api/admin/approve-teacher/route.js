import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 강사 가입 승인/해제 — 오너(admin)만 가능.
// 로그인 차단 판정은 auth 의 user_metadata.approved 를 보므로 여기서 함께 갱신해야 한다
// (users 테이블만 바꾸면 승인해도 로그인이 계속 막힌다).
export async function POST(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { userId, approved } = await req.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'no userId' }, { status: 400 })

  const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (getErr || !target?.user) return NextResponse.json({ error: '대상을 찾을 수 없어요' }, { status: 404 })

  const meta = { ...(target.user.user_metadata || {}), approved: approved !== false }
  const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: meta })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // users 테이블도 맞춰 둔다(컬럼이 없으면 조용히 무시)
  await supabaseAdmin.from('users').update({ approved: approved !== false }).eq('id', userId)

  return NextResponse.json({ ok: true })
}
