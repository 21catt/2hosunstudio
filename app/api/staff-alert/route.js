import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { staffIdsForCourse } from '../../../lib/adminNotify'
import { sendMemoToAdmins } from '../../../lib/kakao'

export const dynamic = 'force-dynamic'

// 운영진에게 가는 「들어온 연락」 한 통로 — 인앱 알림 + 웹푸시 + 카톡 (2026-10-19)
//
// 왜 서버인가(실측 2026-10-19):
//   · 미가입자 예약 요청은 로그인 전 화면에서 보낸다. 브라우저는 users 표를 못 읽어(RLS) 받는 사람이
//     0명 → 알림이 한 건도 안 만들어졌다(guest_booking_request 기록 = 0건). 화면엔 「전달됐어요」.
//   · 앱의 카톡 알림(sendKakaoToAdmins)은 /api/kakao/send 를 불렀는데, 그건 Supabase 웹훅 전용이라
//     비밀키가 없으면 401 — 수업 문의·미가입 요청 카톡은 한 번도 나간 적이 없다.
//   · 새 수강생 가입은 운영진에게 아무 알림도 없었다.
// 여기서는 서비스 키로 대상을 찾고 세 채널을 모두 보낸 뒤, 몇 명에게 갔는지 돌려준다.

const KINDS = {
  // 로그인 없이 보낼 수 있는 것은 이것 하나 — 내용·길이를 묶어 둔다
  guest_booking_request: { title: '📩 미가입 예약 요청', anon: true },
  inquiry:               { title: '💬 수업 문의',       anon: false },
  new_member:            { title: '🐾 새 회원 가입',     anon: false },
}

if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(process.env.VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

// 같은 곳에서 연달아 보내는 것만 막는 얕은 제한(서버 인스턴스 메모리 — 장난 방지용)
const recent = new Map()
function tooFast(key) {
  const now = Date.now()
  const last = recent.get(key) || 0
  recent.set(key, now)
  if (recent.size > 2000) recent.clear()
  return now - last < 8000
}

const clip = (v, n) => String(v ?? '').trim().slice(0, n)

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const kind = KINDS[body.kind]
  if (!kind) return NextResponse.json({ error: '알 수 없는 요청' }, { status: 400 })

  // 로그인이 필요한 종류는 토큰으로 보낸 사람을 확인한다
  let sender = null
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token)
    sender = data?.user || null
  }
  if (!kind.anon && !sender) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (tooFast(`${body.kind}:${sender?.id || ip}`)) {
    return NextResponse.json({ error: '조금 뒤에 다시 보내 주세요' }, { status: 429 })
  }

  const text = clip(body.body, 600)
  if (!text) return NextResponse.json({ error: '내용이 비었어요' }, { status: 400 })

  // 수업이 걸린 요청은 그 수업 담당 + 오너, 아니면 오너 전원
  let courseId = body.courseId || null
  if (courseId) {
    const { data: c } = await supabaseAdmin.from('class_courses').select('id').eq('id', courseId).maybeSingle()
    if (!c) courseId = null
  }
  const ids = await staffIdsForCourse(courseId, body.scheduleId || null, supabaseAdmin)

  const title = kind.title
  let notified = 0
  if (ids.length) {
    const { data, error } = await supabaseAdmin.from('notifications')
      .insert(ids.map(id => ({ user_id: id, type: body.kind, title, body: text })))
      .select('id')
    if (error) console.error('staff-alert notification', error)
    notified = data?.length || 0
  }

  // 웹푸시 — 구독한 운영진에게만
  let pushed = 0
  if (ids.length && process.env.VAPID_PRIVATE_KEY) {
    const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('subscription').in('user_id', ids)
    const payload = JSON.stringify({ title, body: text.slice(0, 120) })
    for (const s of subs || []) {
      try { await webpush.sendNotification(s.subscription, payload); pushed++ } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('subscription', s.subscription)
        }
      }
    }
  }

  // 카톡 — 연결해 둔 관리자 카카오(나에게 보내기)
  let kakao = { sent: 0, total: 0 }
  try {
    kakao = await sendMemoToAdmins(`[${title}]\n${text}`.slice(0, 190), 'https://2hosunstudio.vercel.app/admin/notification')
  } catch (e) { console.error('staff-alert kakao', e) }

  const delivered = notified + pushed + kakao.sent
  if (!delivered) return NextResponse.json({ error: '운영진에게 전달하지 못했어요' }, { status: 502 })
  return NextResponse.json({ ok: true, notified, pushed, kakao: kakao.sent })
}
