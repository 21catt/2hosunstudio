// 서버 전용 — 운영진에게 인앱 알림 + 웹푸시 + 카톡을 한 번에 보낸다(서비스 키).
// /api/staff-alert(문의·미가입 요청·가입)와 /api/rental(자리 대관 신청)이 같이 쓴다.
// 몇 명에게 실제로 갔는지 돌려준다: { notified, pushed, kakao }
import webpush from 'web-push'
import { supabaseAdmin } from './supabaseAdmin'
import { staffIdsForCourse } from './adminNotify'
import { sendMemoToAdmins } from './kakao'

let vapidReady = false
function ensureVapid() {
  if (vapidReady) return true
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return false
  webpush.setVapidDetails(process.env.VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  vapidReady = true
  return true
}

export async function deliverToStaff({
  type, title, text, courseId = null, scheduleId = null,
  link = 'https://2hosunstudio.vercel.app/admin/notification',
}) {
  // 수업이 걸린 요청은 그 수업 담당 + 오너, 아니면 오너 전원
  const ids = await staffIdsForCourse(courseId, scheduleId, supabaseAdmin)

  let notified = 0
  if (ids.length) {
    const { data, error } = await supabaseAdmin.from('notifications')
      .insert(ids.map(id => ({ user_id: id, type, title, body: text })))
      .select('id')
    if (error) console.error('deliverToStaff notification', error)
    notified = data?.length || 0
  }

  // 웹푸시 — 구독한 운영진에게만
  let pushed = 0
  if (ids.length && ensureVapid()) {
    const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('subscription').in('user_id', ids)
    const payload = JSON.stringify({ title, body: text.slice(0, 120) })
    for (const s of subs || []) {
      try { await webpush.sendNotification(s.subscription, payload); pushed++ } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('subscription', s.subscription)
        }
      }
    }
  }

  // 카톡 — 연결해 둔 관리자 카카오(나에게 보내기)
  let kakao = 0
  try {
    const r = await sendMemoToAdmins(`[${title}]\n${text}`.slice(0, 190), link)
    kakao = r.sent
  } catch (e) { console.error('deliverToStaff kakao', e) }

  return { notified, pushed, kakao }
}
