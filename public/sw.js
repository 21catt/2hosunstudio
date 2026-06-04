self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  const title = data.title || '2호선 스튜디오'
  const body = data.body || '새 알림이 있어요'
  const badge = data.badge || 1

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url || '/',
      vibrate: [200, 100, 200],
    }).then(() => {
      if (navigator.setAppBadge) navigator.setAppBadge(badge)
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (navigator.clearAppBadge) navigator.clearAppBadge()
  e.waitUntil(clients.openWindow(e.notification.data || '/'))
})
