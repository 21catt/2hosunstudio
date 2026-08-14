// 빠른 예약 공유 헬퍼 — 캘린더 페이지의 execBook/sendBookingRequest와 동일한 규칙.
// (홈 날짜 스트립 인라인 예약에서 사용)
import { supabase } from './supabase'
import { sendPushToAdmins, sendPushToStaff } from './pushNotify'
import { sendKakaoToAdmins } from './kakaoNotify'
import { notifyStaff } from './adminNotify'

// 유효한(기간 내·잔여 있는) 수강권 여부
export function hasValidTicket(ticket, todayStr) {
  return !!(ticket && ticket.remain > 0 && ticket.expires_at >= todayStr)
}

// ── 수강권 차감·복구는 반드시 이 두 함수를 경유할 것 ─────────────────────────
// `update({ remain: ticket.remain - 1 })` 처럼 화면에 들고 있던 값으로 쓰면,
// 연달아 예약할 때 두 번째가 첫 번째 차감 전 값을 덮어써 차감이 유실된다
// (실제 발생: 4회권에 4건 예약인데 잔여 1). DB 안에서 증감하는 RPC 를 쓴다.
// migration-ticket-atomic.sql 미실행 환경에서는 기존 방식으로 폴백한다(동작 유지).

const RPC_MISSING = e => {
  const m = `${e?.message || ''} ${e?.code || ''}`
  return /does not exist|PGRST202|not find the function|schema cache/i.test(m)
}

// 1회 차감. 성공 시 갱신된 수강권 행, 쓸 수강권이 없으면 null.
export async function consumeClassTicket({ userId, fallbackTicket = null } = {}) {
  const { data, error } = await supabase.rpc('consume_class_ticket', { p_user_id: userId || null })
  if (!error) return data || null
  if (!RPC_MISSING(error)) throw error
  // 폴백(마이그레이션 전) — 최신 값을 다시 읽어 유실 가능성을 조금이라도 줄인다
  const t = await freshTicket(userId, fallbackTicket)
  if (!t || t.remain <= 0) return null
  await supabase.from('tickets').update({ remain: t.remain - 1 }).eq('id', t.id)
  return { ...t, remain: t.remain - 1 }
}

// 1회 복구(취소 시). total 을 넘지 않는다.
export async function restoreClassTicket({ userId, fallbackTicket = null } = {}) {
  const { data, error } = await supabase.rpc('restore_class_ticket', { p_user_id: userId || null })
  if (!error) return data || null
  if (!RPC_MISSING(error)) throw error
  const t = await freshTicket(userId, fallbackTicket)
  if (!t) return null
  const next = Math.min(t.remain + 1, t.total ?? t.remain + 1)
  await supabase.from('tickets').update({ remain: next }).eq('id', t.id)
  return { ...t, remain: next }
}

// 폴백 전용 — 기간 남은 수강권을 만료 임박 순으로 하나(.single() 은 행이 여러 개면 에러라 쓰지 않는다)
async function freshTicket(userId, fallbackTicket) {
  if (!userId) return fallbackTicket
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase.from('tickets').select('*').eq('user_id', userId)
    .gte('expires_at', today).order('expires_at', { ascending: true }).limit(1)
  return (data && data[0]) || fallbackTicket
}

// 취소 시 일반 수강권을 되돌려줄 카테고리인가.
// free(자율창작)·meeting(모임)·oneday(원데이)는 예약할 때 수강권을 쓰지 않으므로 복구 대상이 아니다.
// ⚠️ oneday 를 빼먹으면 "쓴 적 없는 회차가 생기는" 과잉 복구가 된다.
export function refundsClassTicket(category) {
  return category !== 'free' && category !== 'meeting' && category !== 'oneday'
}

// 수강권 차감 일반 예약. 성공 시 생성된 booking 행 반환.
export async function bookClass({ user, ticket, course, schedule, dateStr }) {
  // 차감을 먼저 — 잔여가 없으면 예약을 만들지 않는다(예약만 생기고 차감이 없는 상태 방지)
  const consumed = await consumeClassTicket({ userId: user.id, fallbackTicket: ticket })
  if (!consumed) { alert('수강권 잔여가 없어요 🐾'); return null }
  const { data: newBooking, error } = await supabase.from('bookings').insert({
    user_id: user.id,
    course_id: course.id,
    schedule_id: schedule.id,
    class_name: course.name,
    class_date: dateStr,
    class_time: `${schedule.start_time}~${schedule.end_time}`,
    teacher: course.teacher,
    status: 'booked'
  }).select().single()
  if (error) { // 예약 실패 → 차감 되돌리기
    await restoreClassTicket({ userId: user.id, fallbackTicket: consumed })
    alert('예약에 실패했어요. 다시 시도해 주세요 🐾')
    return null
  }
  const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
  const pushMsg = `${profile?.name || '학생'}님 ${course.name} ${dateStr} ${schedule.start_time} 예약`
  await notifyStaff({ courseId: course.id, scheduleId: schedule.id, type: 'booking_created', title: '새 예약', body: pushMsg, related_id: newBooking?.id })
  sendPushToStaff(course.id, '🐾 새 예약', pushMsg, schedule.id)
  sendKakaoToAdmins('🐾 새 예약', pushMsg)
  return newBooking
}

// 예약 취소 — 캘린더 handleCancel의 수업·모임 취소 규칙과 동일.
// 예약 행 삭제 후 카테고리별로 수강권(일반)·모임권을 1회 복구하고 강사에게 알림.
// (시간 제한·출석 여부 등 취소 가능 판단은 호출부에서 먼저 거른다.)
export async function cancelBooking({ user, ticket, booking }) {
  const { data: course } = await supabase.from('class_courses').select('teacher_id, category').eq('id', booking.course_id).single()

  await supabase.from('bookings').delete().eq('id', booking.id)

  if (course?.category === 'meeting') {
    const today = new Date().toISOString().split('T')[0]
    const { data: mt } = await supabase.from('meeting_tickets').select('*').eq('user_id', user.id).eq('status', 'confirmed').gte('expires_at', today).order('expires_at', { ascending: true }).limit(1)
    if (mt && mt.length > 0) {
      await supabase.from('meeting_tickets').update({ remain: mt[0].remain + 1 }).eq('id', mt[0].id)
    }
  } else if (refundsClassTicket(course?.category)) {
    await restoreClassTicket({ userId: user.id, fallbackTicket: ticket })
  }

  const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
  const cancelMsg = `${profile?.name || '학생'}님이 ${booking.class_name} ${booking.class_date} ${booking.class_time} 취소`
  await notifyStaff({ courseId: booking.course_id, scheduleId: booking.schedule_id, type: 'booking_cancelled', title: '예약 취소', body: cancelMsg })
  sendPushToStaff(booking.course_id, '🐾 예약 취소', cancelMsg, booking.schedule_id)
  sendKakaoToAdmins('🐾 예약 취소', cancelMsg)
}

// 수강권 없음/만료/소진 → 예약을 만들지 않고 관리자에게 요청 알림(연락처 포함)
export async function requestBookingApproval({ user, course, schedule, dateStr }) {
  const { data: profile } = await supabase.from('users').select('name, phone').eq('id', user.id).single()
  const nm = profile?.name || '학생'
  const phone = profile?.phone || '미등록'
  const when = `${dateStr} ${schedule.start_time}~${schedule.end_time}`
  await notifyStaff({ courseId: course.id, type: 'booking_request', title: '📩 수업 예약 요청 (수강권 확인 필요)', body: `${nm}님이 ${course.name} 예약을 요청했어요.\n일시: ${when}\n연락처: ${phone}\n수강권이 없거나 소진된 상태예요. 확인 후 안내해 주세요.` })
  sendPushToStaff(course.id, '📩 예약 요청', `${nm}님 ${course.name} ${when} · 연락처 ${phone}`)
  sendKakaoToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} / 연락처 ${phone}`)
}
