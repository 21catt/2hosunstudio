import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    response_type: 'code',
    scope: 'talk_message',
  })
  return NextResponse.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`)
}
