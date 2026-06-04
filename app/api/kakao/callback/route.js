import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect('/admin?kakao=error')

  // 인가 코드로 토큰 교환
  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code,
    })
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.refresh_token) return NextResponse.redirect('/admin?kakao=error')

  // Supabase에 토큰 저장 (upsert - 여러 관리자 지원)
  const { access_token, refresh_token } = tokenData

  // 카카오 사용자 정보로 kakao_id 가져오기
  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${access_token}` }
  })
  const kakaoUser = await userRes.json()
  const kakaoId = String(kakaoUser.id)

  await supabase.from('kakao_tokens').upsert(
    { kakao_id: kakaoId, access_token, refresh_token, updated_at: new Date().toISOString() },
    { onConflict: 'kakao_id' }
  )

  return NextResponse.redirect(`${process.env.KAKAO_REDIRECT_URI.replace('/api/kakao/callback', '')}/admin?kakao=success`)
}
