import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(req) {
  const { subscription, userId } = await req.json()
  if (!subscription || !userId) return NextResponse.json({ error: 'missing' }, { status: 400 })

  await supabase.from('push_subscriptions').upsert(
    { user_id: userId, subscription },
    { onConflict: 'user_id' }
  )
  return NextResponse.json({ ok: true })
}
