import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 관리자 전용 회원 삭제 — 관련 데이터 정리 후 users + auth 계정 삭제. (되돌릴 수 없음)
export async function POST(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { userId } = await req.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'no userId' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: '본인 계정은 삭제할 수 없어요' }, { status: 400 })

  // 참조 데이터 먼저 정리(FK 제약 회피). 없는 테이블 오류는 무시.
  const byUser = ['bookings', 'tickets', 'meeting_tickets', 'user_prefs', 'notifications', 'class_records', 'record_comments', 'likes', 'comments']
  for (const t of byUser) { try { await supabaseAdmin.from(t).delete().eq('user_id', userId) } catch {} }
  try { await supabaseAdmin.from('posts').delete().eq('author_id', userId) } catch {}
  const { error: uErr } = await supabaseAdmin.from('users').delete().eq('id', userId)
  if (uErr) return NextResponse.json({ error: '남은 데이터 때문에 삭제 실패: ' + uErr.message }, { status: 500 })
  try { await supabaseAdmin.auth.admin.deleteUser(userId) } catch {}

  return NextResponse.json({ ok: true })
}
