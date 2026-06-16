import { NextResponse } from 'next/server'
import { sendMemoToAdmins } from '../../../../lib/kakao'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const { text, link } = body
  if (!text) return NextResponse.json({ error: 'no text' }, { status: 400 })

  const result = await sendMemoToAdmins(
    text.slice(0, 190),
    link || 'https://2hosunstudio.vercel.app/admin'
  )

  return NextResponse.json({ ok: true, ...result })
}
