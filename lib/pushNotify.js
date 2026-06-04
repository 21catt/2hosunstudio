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

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
