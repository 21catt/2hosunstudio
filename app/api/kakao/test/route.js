import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data: rows, error } = await supabaseAdmin.from('admin_kakao_tokens').select('*')
  if (error) return NextResponse.json({ step: 'db조회실패', error })
  if (!rows?.length) return NextResponse.json({ message: '토큰 행이 없음' })

  const results = []
  for (const row of rows) {
    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type: 'text',
          text: '테스트 알림입니다 🐾',
          link: {
            web_url: 'https://2hosunstudio.vercel.app',
            mobile_web_url: 'https://2hosunstudio.vercel.app',
          },
        }),
      }),
    })
    results.push({ nickname: row.nickname, status: res.status, kakao: await res.json() })
  }
  return NextResponse.json({ results })
}