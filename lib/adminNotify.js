// 운영진 알림(🔔) 라우팅 — 수업 관련 알림은 "그 수업 담당 강사 + 오너"에게만 간다.
//
// 예전엔 role='admin' 전원에게 뿌렸다. 강사가 전부 admin 이던 시절엔 그게 곧 전 강사였고,
// 남의 수업 예약·취소 알림까지 모두에게 갔다. 이제 역할이 분리됐으므로:
//   · courseId 를 주면  → 그 수업 담당 강사(class_courses.teacher_id) + 오너 전원
//   · courseId 가 없으면 → 오너 전원(수업과 무관한 문의·요청 등)
// ⚠️ 오너는 항상 포함한다(운영 파악). 담당 강사가 없는 수업이면 오너만 받는다.
import { supabase } from './supabase'

// 알림 수신 대상 id 목록
export async function staffIdsForCourse(courseId) {
  const { data: owners } = await supabase.from('users').select('id').eq('role', 'admin')
  const ids = new Set((owners || []).map(o => o.id))
  if (courseId) {
    const { data: c } = await supabase.from('class_courses').select('teacher_id').eq('id', courseId).maybeSingle()
    if (c?.teacher_id) ids.add(c.teacher_id)
  }
  return [...ids]
}

export async function notifyStaff({ courseId = null, type, title, body, related_id }) {
  const ids = await staffIdsForCourse(courseId)
  if (!ids.length) return
  const base = related_id ? { type, title, body, related_id } : { type, title, body }
  await supabase.from('notifications').insert(ids.map(id => ({ user_id: id, ...base })))
}

// 이전 이름 유지 — courseId 없이 부르면 오너 전원(기존 동작과 동일)
export const notifyAllAdmins = notifyStaff
