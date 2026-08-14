// 운영진 알림(🔔) 라우팅 — 수업 관련 알림은 "그 수업 담당 강사 + 오너"에게만 간다.
//
// 예전엔 role='admin' 전원에게 뿌렸다. 강사가 전부 admin 이던 시절엔 그게 곧 전 강사였고,
// 남의 수업 예약·취소 알림까지 모두에게 갔다. 이제 역할이 분리됐으므로:
//   · courseId 를 주면  → 그 수업 담당 강사(class_courses.teacher_id) + 오너 전원
//   · courseId 가 없으면 → 오너 전원(수업과 무관한 문의·요청 등)
// ⚠️ 오너는 항상 포함한다(운영 파악). 담당 강사가 없는 수업이면 오너만 받는다.
import { supabase } from './supabase'

// 알림 수신 대상 id 목록.
// scheduleId 의 타임 담당이 있으면 그 강사, 없으면 수업 담당 강사(상속) + 오너 전원.
export async function staffIdsForCourse(courseId, scheduleId = null) {
  const { data: owners } = await supabase.from('users').select('id').eq('role', 'admin')
  const ids = new Set((owners || []).map(o => o.id))
  if (!courseId && !scheduleId) return [...ids]

  let teacherId = null
  if (scheduleId) {
    // 컬럼이 없는 환경(마이그레이션 전)이면 조용히 수업 담당으로 폴백
    const { data: s } = await supabase.from('class_schedules').select('teacher_id').eq('id', scheduleId).maybeSingle()
    teacherId = s?.teacher_id || null
  }
  if (!teacherId && courseId) {
    const { data: c } = await supabase.from('class_courses').select('teacher_id').eq('id', courseId).maybeSingle()
    teacherId = c?.teacher_id || null
  }
  if (teacherId) ids.add(teacherId)
  return [...ids]
}

export async function notifyStaff({ courseId = null, scheduleId = null, type, title, body, related_id }) {
  const ids = await staffIdsForCourse(courseId, scheduleId)
  if (!ids.length) return
  const base = related_id ? { type, title, body, related_id } : { type, title, body }
  await supabase.from('notifications').insert(ids.map(id => ({ user_id: id, ...base })))
}

// 이전 이름 유지 — courseId 없이 부르면 오너 전원(기존 동작과 동일)
export const notifyAllAdmins = notifyStaff
