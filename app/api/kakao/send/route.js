import { NextResponse } from 'next/server'
import { sendMemoToAdmins } from '../../../../lib/kakao'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  // 1) 시크릿 검증 — 공개 엔드포인트 보호
  if (req.headers.get('x-webhook-secret') !== process.env.KAKAO_NOTIFY_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2) Supabase 웹훅 페이로드: INSERT된 예약 행이 record에 들어온다
  let payload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const r = payload?.record
  if (!r) return NextResponse.json({ error: 'no record' }, { status: 400 })

  // 3) 신청자 이름 조회 (record엔 user_id만 있음)
  let name = '학생'
  if (r.user_id) {
    const { data: u } = await supabaseAdmin
      .from('users').select('name').eq('id', r.user_id).single()
    if (u?.name) name = u.name
  }

  // 4) 알림 문구 — 신청자/일자/시간/수업/강사
  const text =
    `[새 예약]\n` +
    `신청자: ${name}\n` +
    `일자: ${r.class_date ?? ''}\n` +
    `시간: ${r.class_time ?? ''}\n` +
    `수업: ${r.class_name ?? ''}` +
    (r.teacher ? `\n강사: ${r.teacher}` : '')

  const linkUrl = 'https://2hosunstudio.vercel.app/admin' // 등록된 도메인 하위
  const result = await sendMemoToAdmins(text.slice(0, 190), linkUrl)

  return NextResponse.json({ ok: true, ...result })
}