import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function refreshAccessToken(refreshToken, kakaoId) {
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KAKAO_REST_API_KEY,
      refresh_token: refreshToken,
    })
  })
  const data = await res.json()
  if (!data.access_token) return null

  await supabase.from('kakao_tokens').update({
    access_token: data.access_token,
    ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    updated_at: new Date().toISOString()
  }).eq('kakao_id', kakaoId)

  return data.access_token
}

export async function POST(req) {
  const { title, body } = await req.json()

  const { data: tokens } = await supabase.from('kakao_tokens').select('*')
  if (!tokens || tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const message = {
    object_type: 'text',
    text: `${title}\n${body}`,
    link: { web_url: process.env.KAKAO_REDIRECT_URI.replace('/api/kakao/callback', '') }
  }

  let sent = 0
  for (const token of tokens) {
    let accessToken = token.access_token

    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ template_object: JSON.stringify(message) })
    })
    const result = await res.json()

    // 토큰 만료 시 리프레시 후 재시도
    if (result.code === -401) {
      accessToken = await refreshAccessToken(token.refresh_token, token.kakao_id)
      if (!accessToken) continue

      await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ template_object: JSON.stringify(message) })
      })
    }
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
