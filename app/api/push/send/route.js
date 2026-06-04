import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(req) {
  const { title, body, adminId } = await req.json()

  // 관리자 구독 정보 가져오기
  let query = supabase.from('push_subscriptions').select('subscription')
  if (adminId) query = query.eq('user_id', adminId)

  const { data } = await query
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
