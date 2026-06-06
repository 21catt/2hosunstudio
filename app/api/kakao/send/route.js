import { NextResponse } from 'next/server'
import { sendMemoToAdmins } from '../../../../lib/kakao'

export const dynamic = 'force-dynamic'

// 예약 행(record)에서 알림 문구 만들기.
// 흔한 컬럼명을 우선 시도하고, 하나도 못 잡으면 record 필드를 그대로 나열(보정용).
function buildText(r) {
  const pick = (...keys) => {
    for (const k of keys) if (r[k] != null && r[k] !== '') return r[k]
    return null
  }
  const name = pick('student_name', 'name', 'student', 'user_name')
  const type = pick('type', 'class_type', 'category', 'kind')
  const date = pick('date', 'booking_date', 'reserved_date', 'day')
  const time = pick('time', 'start_time', 'slot', 'reserved_time')

  const lines = ['새 예약']
  if (name) lines.push(`학생: ${name}`)
  if (type) lines.push(`유형: ${type}`)
  if (date || time) lines.push(`일시: ${[date, time].filter(Boolean).join(' ')}`)

  // 위 항목이 하나도 안 잡히면 record 주요 필드 자동 나열
  if (lines.length === 1) {
    const skip = new Set(['id', 'created_at', 'updated_at'])
    for (const [k, v] of Object.entries(r)) {
      if (skip.has(k) || v == null || v === '') continue
      lines.push(`${k}: ${v}`)
    }
  }
  return lines.join('\n').slice(0, 190) // 텍스트 템플릿 200자 제한 여유
}

export async function POST(req) {
  // 1) 시크릿 검증 — 공개 엔드포인트 보호
  if (req.headers.get('x-webhook-secret') !== process.env.KAKAO_NOTIFY_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2) Supabase 웹훅 페이로드: INSERT된 행이 record에 들어온다
  let payload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const r = payload?.record
  if (!r) return NextResponse.json({ error: 'no record' }, { status: 400 })

  // 3) 발송 (실제 발송 로직은 lib/kakao.js 하나로 통일)
  const text = buildText(r)
  const linkUrl = 'https://2hosunstudio.vercel.app/admin' // 등록된 도메인 하위
  const result = await sendMemoToAdmins(text, linkUrl)

  return NextResponse.json({ ok: true, ...result })
}