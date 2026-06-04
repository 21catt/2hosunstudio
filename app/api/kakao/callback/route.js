import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  // 절대 URL로 리다이렉트 (상대경로면 500 에러 남)
  const go = (path) => NextResponse.redirect(new URL(path, request.url))

  if (!code) return go('/admin?kakao=fail&reason=nocode')

  try {
    // 1) 인가 코드 → 토큰 교환
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
      }),
    })
    const token = await tokenRes.json()
    if (!token.access_token) {
      console.error('토큰 교환 실패', token)
      return go('/admin?kakao=fail&reason=token')
    }

    // 2) 카카오 사용자 ID 조회
    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const me = await meRes.json()

    // 3) 토큰 저장 (kakao_id 기준 upsert)
    const accessExpiresAt = new Date(Date.now() + (token.expires_in - 60) * 1000).toISOString()
    const { error } = await supabaseAdmin.from('admin_kakao_tokens').upsert({
      kakao_id: me.id,
      nickname: me?.kakao_account?.profile?.nickname || null,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      access_expires_at: accessExpiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'kakao_id' })

    if (error) {
      console.error('토큰 저장 실패', error)
      return go('/admin?kakao=fail&reason=save')
    }

    return go('/admin?kakao=ok')
  } catch (e) {
    console.error('콜백 처리 오류', e)
    return go('/admin?kakao=fail&reason=exception')
  }
}
