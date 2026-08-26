import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 푸시 구독 등록 — service-role 로 쓴다.
// ⚠️ anon key 로 쓰면 push_subscriptions 에 RLS 를 켜는 순간 조용히 실패한다
//    (인증 문맥이 없어 auth.uid() 가 null). 그래서 이 표는 서버에서만 만진다.
// ⚠️ userId 를 본문에서 그대로 믿지 않는다 — 남의 id 로 구독을 덮어쓸 수 있다.
//    로그인 토큰이 있으면 그 사람으로만 등록한다.
export async function POST(req) {
  const { subscription, userId } = await req.json().catch(() => ({}))
  if (!subscription) return NextResponse.json({ error: 'missing' }, { status: 400 })

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  let uid = null
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token)
    uid = data?.user?.id || null
  }
  // 토큰이 없으면(구버전 클라이언트) 기존처럼 본문 id 를 쓴다 — 배포 순서 때문에 끊지 않는다
  const target = uid || userId
  if (!target) return NextResponse.json({ error: 'missing' }, { status: 400 })

  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    { user_id: target, subscription },
    { onConflict: 'user_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
