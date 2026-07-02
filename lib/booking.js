// 빠른 예약 공유 헬퍼 — 캘린더 페이지의 execBook/sendBookingRequest와 동일한 규칙.
// (홈 날짜 스트립 인라인 예약에서 사용)
import { supabase } from './supabase'
import { sendPushToAdmins } from './pushNotify'
import { sendKakaoToAdmins } from './kakaoNotify'

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
  if (course.teacher_id) {
    await supabase.from('notifications').insert({
      user_id: course.teacher_id,
      type: 'booking_created',
      title: '새 예약',
      body: pushMsg,
      related_id: newBooking?.id
    })
  }
  sendPushToAdmins('🐾 새 예약', pushMsg)
  sendKakaoToAdmins('🐾 새 예약', pushMsg)
  return newBooking
}

// 수강권 없음/만료/소진 → 예약을 만들지 않고 관리자에게 요청 알림(연락처 포함)
export async function requestBookingApproval({ user, course, schedule, dateStr }) {
  const { data: profile } = await supabase.from('users').select('name, phone').eq('id', user.id).single()
  const nm = profile?.name || '학생'
  const phone = profile?.phone || '미등록'
  const when = `${dateStr} ${schedule.start_time}~${schedule.end_time}`
  if (course.teacher_id) {
    await supabase.from('notifications').insert({
      user_id: course.teacher_id,
      type: 'booking_request',
      title: '📩 수업 예약 요청 (수강권 확인 필요)',
      body: `${nm}님이 ${course.name} 예약을 요청했어요.\n일시: ${when}\n연락처: ${phone}\n수강권이 없거나 소진된 상태예요. 확인 후 안내해 주세요.`
    })
  }
  sendPushToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} · 연락처 ${phone}`)
  sendKakaoToAdmins('📩 예약 요청', `${nm}님 ${course.name} ${when} / 연락처 ${phone}`)
}
