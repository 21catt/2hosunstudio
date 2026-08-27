import webpush from 'web-push'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// ⚠️ 구독 조회·정리는 service-role 로. anon key 로는 push_subscriptions 에 RLS 를 켜는 순간
//    0건이 돌아와 푸시가 조용히 멎는다(에러도 안 난다).
const supabase = supabaseAdmin

export async function POST(req) {
  const { title, body, adminId } = await req.json()

  // ⚠️ 대상이 없으면 보내지 않는다. 예전엔 필터 없이 전체 조회라 push_subscriptions
  //    전부(=학생 포함)에게 나갔다. 부르는 쪽에서 대상을 명시하게 한다.
  if (!adminId) return NextResponse.json({ ok: true, sent: 0, skipped: 'no target' })

  const { data } = await supabase.from('push_subscriptions')
    .select('subscription').eq('user_id', adminId)
  if (!data || data.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title, body })
  let sent = 0

  for (const row of data) {
    try {
      await webpush.sendNotification(row.subscription, payload)
      sent++
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('subscription', row.subscription)
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
