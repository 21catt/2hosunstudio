// 운영진 카톡(나에게 보내기) — 예약 행이 생기지 않는 알림용(취소·예약 요청 등).
// ⚠️ 예전엔 /api/kakao/send 를 불렀는데, 그건 Supabase 예약 INSERT 웹훅 전용(비밀키 필수)이라
//    앱에서 부르면 늘 401 — 이 함수로 보낸 카톡은 한 번도 나간 적이 없었다(2026-10-19 확인).
//    새 예약 카톡은 웹훅이 보내므로 새 예약에서는 부르지 말 것(두 번 간다).
export async function sendKakaoToAdmins(title, body) {
  try {
    await fetch('/api/kakao/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[${title}]\n${body}` }),
    })
  } catch (e) {
    console.error('kakao send error', e)
  }
}
