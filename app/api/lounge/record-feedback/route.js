import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 라운지에 공유된 수업기록 이미지 뷰어에서 "강사가 남긴 피드백"을 보여주기 위한 조회.
// 수강생끼리 서로의 공유 기록을 보므로(본인/관리자만이 아님) service-role 로 읽고,
// 피드백 첨부 사진(class-records 비공개 버킷)은 서명 URL 로 내려준다.
// 열쇠(recordId)는 posts.record_id 로만 노출되고 uuid 라 사실상 추측 불가 — 로그인만 요구.
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'no recordId' }, { status: 400 })

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: rows, error } = await supabaseAdmin
    .from('class_record_feedback')
    .select('id, body, photos, teacher_id, updated_at')
    .eq('record_id', recordId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = rows || []
  if (list.length === 0) return NextResponse.json({ feedback: [] })

  // 강사 이름 매핑
  const teacherIds = [...new Set(list.map(r => r.teacher_id).filter(Boolean))]
  const nameById = {}
  if (teacherIds.length) {
    const { data: us } = await supabaseAdmin.from('users').select('id, name').in('id', teacherIds)
    ;(us || []).forEach(u => { nameById[u.id] = u.name })
  }

  // 피드백 첨부 사진 서명(class-records 비공개 버킷, 7일)
  const feedback = await Promise.all(list.map(async r => {
    const paths = Array.isArray(r.photos) ? r.photos.filter(Boolean) : []
    const photos = (await Promise.all(paths.map(async p => {
      const { data } = await supabaseAdmin.storage.from('class-records').createSignedUrl(p, 604800)
      return data?.signedUrl || null
    }))).filter(Boolean)
    return {
      id: r.id,
      body: r.body || '',
      teacher_name: nameById[r.teacher_id] || '강사',
      photos,
    }
  }))

  return NextResponse.json({ feedback })
}
