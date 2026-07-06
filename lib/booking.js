// 빠른 예약 공유 헬퍼 — 캘린더 페이지의 execBook/sendBookingRequest와 동일한 규칙.
// (홈 날짜 스트립 인라인 예약에서 사용)
import { supabase } from './supabase'
import { sendPushToAdmins } from './pushNotify'
import { sendKakaoToAdmins } from './kakaoNotify'
import { notifyAllAdmins } from './adminNotify'

// 유효한(기간 내·잔여 있는) 수강권 여부
export function hasValidTicket(ticket, todayStr) {
  return !!(ticket && ticket.remain > 0 && ticket.expires_at >= todayStr)
}

// 수강권 차감 일반 예약. 성공 시 생성된 booking 행 반환.
export async function bookClass({ user, ticket, course, schedule, dateStr }) {
  const { data: newBooking } = await supabase.from('bookings').insert({
    user_id: user.id,
    course_id: course.id,
    schedule_id: schedule.id,
    class_name: course.name,
    class_date: dateStr,
    class_time: `${schedule.start_time}~${schedule.end_time}`,
    teacher: course.teacher,
    status: 'booked'
  }).select().single()
  await supabase.from('tickets').update({ remain: ticket.remain - 1 }).eq('id', ticket.id)
  const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
  const pushMsg = `${profile?.name || '학생'}님 ${course.name} ${dateStr} ${schedule.start_time} 예약`
  await notifyAllAdmins({ type: 'booking_created', title: '새 예약', body: pushMsg, related_id: newBooking?.id })
  sendPushToAdmins('🐾 새 예약', pushMsg)
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
  } else if (course?.category !== 'free' && ticket) {
    await supabase.from('tickets').update({ remain: ticket.remain + 1 }).eq('id', ticket.id)
  }

  const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
  await notifyAllAdmins({ type: 'booking_cancelled', title: '예약 취소', body: `${profile?.name || '학생'}님이 ${booking.class_name} ${booking.class_date} ${booking.class_time} 취소` })
}

// 수강권 없음/만료/소진 → 예약을 만들지 않고 관리자에게 요청 알림(연락처 포함)
export async function requestBookingApproval({ user, course, schedule, dateStr }) {
  const { data: profile } = await supabase.from('users').select('name, phone').eq('id', user.id).single()
  const nm = profile?.name || '학생'
  const phone = profile?.phone || '미등록'
  const when = `${dateStr} ${schedule.start_time}~${schedule.end_time}`
  await notifyAllAdmins({ type: 'booking_request', title: '📩 수업 예약 요청 (수강권 확인 필요)', body: `${nm}님이 ${course.name} 예약을 요청했어요.\n일시: ${when}\n연락처: ${phone}\n수강권이 없거나 소진된 상태예요. 확인 후 안내해 주세요.` })
  sendPushToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} · 연락처 ${phone}`)
  sendKakaoToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} / 연락처 ${phone}`)
}
