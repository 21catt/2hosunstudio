import { supabase } from './supabase'

// 특정 사용자 1명에게 웹푸시 — /api/push/send의 adminId 파라미터가 user_id 필터로 동작한다
export async function sendPushToUser(userId, title, body) {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, adminId: userId })
    })
  } catch (e) {
    console.error('push error', e)
  }
}

// 수업 관련 웹푸시 — 담당 강사 + 오너에게만(인앱 알림 라우팅과 같은 규칙)
export async function sendPushToStaff(courseId, title, body, scheduleId = null) {
  try {
    const { staffIdsForCourse } = await import('./adminNotify')
    const ids = await staffIdsForCourse(courseId, scheduleId)
    await Promise.all(ids.map(id => sendPushToUser(id, title, body)))
  } catch (e) {
    console.error('push error', e)
  }
}

export async function sendPushToAdmins(title, body) {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    })
  } catch (e) {
    console.error('push error', e)
  }
}

export async function registerPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  const reg = await navigator.serviceWorker.register('/sw.js')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  })

  // 토큰을 함께 보낸다 — 서버가 "이 사람이 맞는지" 확인하고 그 id 로만 등록한다
  const { data: { session } } = await supabase.auth.getSession()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ subscription: sub, userId })
  })
  return true
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
