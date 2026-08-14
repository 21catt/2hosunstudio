// "무엇이 내 수업인가" 판정 — 강사 화면·출석·기록 필터가 공유하는 단일 규칙.
//
// 담당은 두 층이다:
//   · class_schedules.teacher_id 가 있으면 → 그 타임의 담당(우선)
//   · 비어 있으면 → class_courses.teacher_id 를 따름(상속)
// 그래서 "내 수업 중이지만 그 타임은 다른 강사"인 경우를 정확히 걸러낸다.
//
// ⚠️ class_schedules.teacher_id 는 migration-schedule-teacher.sql 이후 생긴다.
//    컬럼이 없으면 조회가 실패하므로 조용히 수업 단위 담당으로만 동작한다(기존과 동일).
import { supabase } from './supabase'

export async function loadTeachingScope(uid) {
  const { data: courses } = await supabase.from('class_courses').select('id').eq('teacher_id', uid)
  const courseIds = (courses || []).map(c => c.id)

  // 내가 타임 담당으로 지정된 스케줄
  const { data: mineSch } = await supabase.from('class_schedules').select('id, course_id').eq('teacher_id', uid)
  const ownedScheduleIds = new Set((mineSch || []).map(s => s.id))

  // 내 수업이지만 다른 강사가 타임 담당인 스케줄 → 내 것에서 제외
  const excludedScheduleIds = new Set()
  if (courseIds.length) {
    const { data: sch } = await supabase.from('class_schedules').select('id, teacher_id').in('course_id', courseIds)
    ;(sch || []).forEach(s => {
      if (s.teacher_id && s.teacher_id !== uid) excludedScheduleIds.add(s.id)
    })
  }

  // 내가 타임 담당인 스케줄이 속한 수업도 조회 범위에 넣어야 예약을 가져올 수 있다
  const scopeCourseIds = [...new Set([...courseIds, ...(mineSch || []).map(s => s.course_id).filter(Boolean)])]

  const isMine = b => {
    if (!b) return false
    if (b.schedule_id && ownedScheduleIds.has(b.schedule_id)) return true
    if (b.schedule_id && excludedScheduleIds.has(b.schedule_id)) return false
    return courseIds.includes(b.course_id)
  }

  return { courseIds, scopeCourseIds, ownedScheduleIds, excludedScheduleIds, isMine, hasAny: scopeCourseIds.length > 0 }
}
