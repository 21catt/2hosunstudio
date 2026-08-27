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

  const { userId, approved, reject } = await req.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'no userId' }, { status: 400 })

  const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (getErr || !target?.user) return NextResponse.json({ error: '대상을 찾을 수 없어요' }, { status: 404 })

  // 반려 = 계정을 지우지 않고 수강생으로 되돌린다.
  // ⚠️ 삭제는 되돌릴 수 없고, 그 사람이 이미 수강생으로 쓰던 계정일 수도 있다.
  //    직원 권한만 걷어내면 목록에서 빠지고 앱은 그대로 쓸 수 있다.
  if (reject === true) {
    const rmeta = { ...(target.user.user_metadata || {}), role: 'student', approved: true }
    const { error: rErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: rmeta })
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
    await supabaseAdmin.from('users').update({ role: 'student', approved: true }).eq('id', userId)
    // 알림은 보내지 않는다 — 반려 사유는 사람이 직접 전하는 편이 맞다(연락처를 필수로 받는 이유).
    return NextResponse.json({ ok: true, rejected: true })
  }

  const meta = { ...(target.user.user_metadata || {}), approved: approved !== false }
  const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: meta })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // users 테이블도 맞춰 둔다(컬럼이 없으면 조용히 무시)
  await supabaseAdmin.from('users').update({ approved: approved !== false }).eq('id', userId)

  // 승인되면 그 강사에게 알림을 남긴다.
  // ⚠️ 승인 전에는 로그인이 막혀 있어 알림을 볼 수 없다 — 그래서 "승인된 순간"에 만들어 두면
  //    강사가 처음 로그인했을 때 이 알림이 기다리고 있다. (해제는 알리지 않는다)
  if (approved !== false) {
    const isAdmin = (target.user.user_metadata || {}).role === 'admin'
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'teacher_approved',
      title: isAdmin ? '🎉 관리자 가입이 승인됐어요' : '🎉 강사 가입이 승인됐어요',
      body: isAdmin
        ? '이제 관리자 로그인으로 들어오실 수 있어요. 회원·수강권·일정 관리를 확인해 보세요 🐾'
        : '이제 강사 로그인으로 들어오실 수 있어요. 담당 수업의 예약·출석·기록 피드백을 확인해 보세요 🐾',
    })
  }

  return NextResponse.json({ ok: true })
}
