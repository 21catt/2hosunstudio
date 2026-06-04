let badgeCount = 0

self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  const title = data.title || '2호선 스튜디오'
  const body = data.body || '새 알림이 있어요'
  badgeCount++

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/admin' },
      vibrate: [200, 100, 200],
    }).then(() => {
      try { return self.navigator.setAppBadge(badgeCount) } catch(err) {}
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  badgeCount = 0
  try { self.navigator.clearAppBadge() } catch(err) {}
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      const url = e.notification.data?.url || '/admin'
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})

self.addEventListener('activate', e => {
  try { self.navigator.clearAppBadge() } catch(err) {}
})
