import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 라운지에 공유된 수업기록 이미지 뷰어에서 "강사가 남긴 피드백"을 보여주기 위한 조회.
// 수강생끼리 서로의 공유 기록을 보므로(본인/관리자만이 아님) service-role 로 읽고,
// 피드백 첨부 사진(class-records 비공개 버킷)은 서명 URL 로 내려준다. 로그인만 요구.
//
// record_id 가 붙은 글(신규 공유) 뿐 아니라, 그 컬럼이 없던 시절의 기존 글도 자동으로 처리한다:
// 같은 작성자 + 생성시각이 거의 같은(공유는 기록 생성 직후 몇 초~수십 초) 기록을 찾아 매칭하고,
// 찾으면 posts.record_id 에 되써(self-heal) 다음부터는 매칭 없이 바로 조회된다.
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const postId = searchParams.get('postId')
  let recordId = searchParams.get('recordId')
  if (!postId && !recordId) return NextResponse.json({ error: 'no postId' }, { status: 400 })

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // recordId 를 직접 안 넘겼으면 postId 로 해석 — 없으면 기존 글이라 시각 매칭
  if (!recordId && postId) {
    const { data: post } = await supabaseAdmin.from('posts').select('*').eq('id', postId).maybeSingle()
    if (!post) return NextResponse.json({ feedback: [] })
    if (post.record_id) {
      recordId = post.record_id
    } else if ((post.tag === 'class' || post.tag === 'exhibit') && (post.title || '').includes('기록')) {
      // 공유 기록 글로 보이는 것만 매칭(일반 글 오매칭 방지). class_records.created_at 없으면 조용히 스킵.
      try {
        const { data: cands } = await supabaseAdmin
          .from('class_records')
          .select('id, created_at')
          .eq('user_id', post.author_id)
          .lte('created_at', new Date(new Date(post.created_at).getTime() + 30000).toISOString())
          .gte('created_at', new Date(new Date(post.created_at).getTime() - 15 * 60000).toISOString())
        if (cands && cands.length) {
          const t = new Date(post.created_at).getTime()
          cands.sort((a, b) => Math.abs(new Date(a.created_at).getTime() - t) - Math.abs(new Date(b.created_at).getTime() - t))
          recordId = cands[0].id
          // record_id 되쓰기(컬럼 없으면 실패해도 표시엔 지장 없음)
          try { await supabaseAdmin.from('posts').update({ record_id: recordId }).eq('id', postId) } catch {}
        }
      } catch {}
    }
    if (!recordId) return NextResponse.json({ feedback: [] })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('class_record_feedback')
    .select('id, body, photos, teacher_id, updated_at')
    .eq('record_id', recordId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = rows || []
  if (list.length === 0) return NextResponse.json({ feedback: [] })

  // 강사 이름 매핑 + 첨부 사진 서명을 동시에(둘 다 피드백 행에만 의존 — 순차 대기 제거)
  const teacherIds = [...new Set(list.map(r => r.teacher_id).filter(Boolean))]
  const [nameById, signedByRow] = await Promise.all([
    (async () => {
      const map = {}
      if (teacherIds.length) {
        const { data: us } = await supabaseAdmin.from('users').select('id, name').in('id', teacherIds)
        ;(us || []).forEach(u => { map[u.id] = u.name })
      }
      return map
    })(),
    // 모든 피드백의 사진을 한 번에 병렬 서명(행별로 나눠 기다리지 않음)
    Promise.all(list.map(async r => {
      const paths = Array.isArray(r.photos) ? r.photos.filter(Boolean) : []
      return (await Promise.all(paths.map(async p => {
        const { data } = await supabaseAdmin.storage.from('class-records').createSignedUrl(p, 604800)
        return data?.signedUrl || null
      }))).filter(Boolean)
    })),
  ])

  const feedback = list.map((r, i) => ({
    id: r.id,
    body: r.body || '',
    teacher_name: nameById[r.teacher_id] || '강사',
    photos: signedByRow[i],
  }))

  return NextResponse.json({ feedback })
}
