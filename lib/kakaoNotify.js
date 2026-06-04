export async function sendKakaoToAdmins(title, body) {
  try {
    await fetch('/api/kakao/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    })
  } catch (e) {
    console.error('kakao send error', e)
  }
}
