import { NextResponse } from 'next/server'
import { sendMemoToAdmins } from '../../../../lib/kakao'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await sendMemoToAdmins(
      '실제 함수 테스트 🐾\n예약 알림 경로 점검',
      'https://2hosunstudio.vercel.app/admin'
    )
    return NextResponse.json({ v: 'v4', result })
  } catch (e) {
    return NextResponse.json({ v: 'v4', error: String(e) }, { status: 500 })
  }
}