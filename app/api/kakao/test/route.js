import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data: rows, error } = await supabaseAdmin.from('admin_kakao_tokens').select('*')
  if (error) return NextResponse.json({ v: 'v3', step: 'db조회실패', error })
  if (!rows?.length) return NextResponse.json({ v: 'v3', message: '토큰 행이 없음' })

  const templateObject = {
    object_type: 'text',
    text: '테스트 알림입니다 🐾',
    link: {
      web_url: 'https://2hosunstudio.vercel.app',
      mobile_web_url: 'https://2hosunstudio.vercel.app',
    },
  }
  const body = 'template_object=' + encodeURIComponent(JSON.stringify(templateObject))

  const results = []
  for (const row of rows) {
    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body,
    })
    results.push({ nickname: row.nickname, status: res.status, kakao: await res.json() })
  }
  return NextResponse.json({ v: 'v3', results })
}