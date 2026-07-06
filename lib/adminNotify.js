// 관리자 전원에게 인앱 알림(🔔) — 담당 강사 1명이 아니라 role=admin 모두에게 넣는다.
// (푸시/카톡 sendPushToAdmins·sendKakaoToAdmins은 이미 전체 관리자 대상)
import { supabase } from './supabase'

export async function notifyAllAdmins({ type, title, body, related_id }) {
  const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
  if (!admins?.length) return
  const base = related_id ? { type, title, body, related_id } : { type, title, body }
  await supabase.from('notifications').insert(admins.map(a => ({ user_id: a.id, ...base })))
}
