import { supabase } from './supabase'

// 운영진에게 「들어온 연락」을 보낸다 — 서버(/api/staff-alert)가 대상 찾기·인앱 알림·푸시·카톡을 한 번에.
// 비로그인(미가입자 예약 요청)에서도 된다. 실제로 전달됐는지를 돌려준다: { ok, error }
export async function sendStaffAlert({ kind, body, courseId = null, scheduleId = null }) {
  try {
    const { data } = await supabase.auth.getSession()
    const t = data?.session?.access_token
    const res = await fetch('/api/staff-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ kind, body, courseId, scheduleId }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j.ok) return { ok: false, error: j.error || `전달 실패 (${res.status})` }
    return { ok: true }
  } catch {
    return { ok: false, error: '인터넷 연결을 확인해 주세요' }
  }
}
