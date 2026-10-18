import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 커리큘럼(회차)·핵심 내용 쓰기 — 승인된 관리자 전원 (2026-10-18)
//
// 왜 서버를 거치나: 브라우저에서 바로 쓰면 DB 정책(RLS)이 막을 때
//   · insert 는 오류가 나지만 화면이 오류를 안 보여 줬고
//   · update 는 오류 없이 "0줄 바뀜"으로 끝나 화면엔 「저장됐어요」가 떴다.
// 관리자(양지운 쌤 포함)가 "등록이 안 된다"고 느낀 지점이 정확히 여기다.
// 그래서 관리자 판정은 users 표(role = admin ∧ approved ≠ false)로 서버가 직접 하고,
// 쓰기는 서비스 키로 한다 — DB 정책·로그인 토큰 메타 상태와 무관하게 같은 결과.
// 매 쓰기는 바뀐 줄 수를 확인해 0 이면 실패로 돌려준다(조용한 성공 금지).

async function requireAdmin(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 }) }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: '로그인이 필요해요 — 다시 로그인해 주세요' }, { status: 401 }) }
  const { data: me } = await supabaseAdmin.from('users').select('role, approved').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin' || me?.approved === false) {
    return { error: NextResponse.json({ error: '관리자 계정만 편집할 수 있어요' }, { status: 403 }) }
  }
  return { user }
}

const fail = (msg, status = 400) => NextResponse.json({ error: msg }, { status })

// 회차 순서를 1..n 으로 다시 매긴다. (course_name, step_order) 에 유일 제약이 있어도
// 겹치지 않게 먼저 큰 번호로 비켜 놓은 뒤 제자리로.
async function renumber(courseName, ids) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabaseAdmin.from('course_curriculum')
      .update({ step_order: 100000 + i }).eq('id', ids[i]).eq('course_name', courseName)
    if (error) return error
  }
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabaseAdmin.from('course_curriculum')
      .update({ step_order: i + 1 }).eq('id', ids[i]).eq('course_name', courseName)
    if (error) return error
  }
  return null
}

export async function POST(req) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error

  // 사진 업로드 — multipart
  const ctype = req.headers.get('content-type') || ''
  if (ctype.startsWith('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') return fail('파일이 없어요')
    const raw = (file.name || '').split('.').pop().toLowerCase()
    const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : 'jpg'
    const path = `curriculum/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error } = await supabaseAdmin.storage.from('seat-photos')
      .upload(path, buf, { contentType: file.type || 'image/jpeg' })
    if (error) return fail('업로드 실패: ' + error.message, 500)
    const { data } = supabaseAdmin.storage.from('seat-photos').getPublicUrl(path)
    return NextResponse.json({ ok: true, url: data.publicUrl })
  }

  const body = await req.json().catch(() => ({}))
  const { action, courseName } = body
  if (!courseName && action !== 'updateStep') return fail('수업이 선택되지 않았어요')

  if (action === 'addStep') {
    const title = (body.title || '').trim()
    if (!title) return fail('회차 제목을 적어 주세요')
    const { data: rows } = await supabaseAdmin.from('course_curriculum')
      .select('id, step_order').eq('course_name', courseName).order('step_order')
    const list = rows || []
    const maxOrder = list.reduce((m, r) => Math.max(m, r.step_order || 0), 0)
    const { data: added, error } = await supabaseAdmin.from('course_curriculum').insert({
      course_name: courseName,
      step_order: maxOrder + 1,
      title,
      keyword: (body.keyword || '').trim() || null,
      image_url: body.imageUrl || null,
    }).select().single()
    if (error || !added) return fail('회차 추가 실패: ' + (error?.message || '저장되지 않았어요'), 500)
    // 복제 = 원본 바로 뒤에
    if (body.afterId) {
      const ids = list.map(r => r.id)
      const idx = ids.indexOf(body.afterId)
      if (idx >= 0) {
        const order = [...ids.slice(0, idx + 1), added.id, ...ids.slice(idx + 1)]
        const e2 = await renumber(courseName, order)
        if (e2) return fail('순서 정리 실패: ' + e2.message, 500)
      }
    }
    return NextResponse.json({ ok: true, step: added })
  }

  if (action === 'updateStep') {
    const title = (body.title || '').trim()
    if (!body.id || !title) return fail('회차 제목을 적어 주세요')
    const { data, error } = await supabaseAdmin.from('course_curriculum').update({
      title,
      keyword: (body.keyword || '').trim() || null,
      image_url: body.imageUrl || null,
      updated_at: new Date().toISOString(),
    }).eq('id', body.id).select('id')
    if (error) return fail('회차 수정 실패: ' + error.message, 500)
    if (!data?.length) return fail('회차를 찾지 못했어요 — 새로고침 후 다시 해 주세요', 404)
    return NextResponse.json({ ok: true })
  }

  if (action === 'deleteStep') {
    if (!body.id) return fail('지울 회차가 없어요')
    const { data, error } = await supabaseAdmin.from('course_curriculum')
      .delete().eq('id', body.id).eq('course_name', courseName).select('id')
    if (error) return fail('회차 삭제 실패: ' + error.message, 500)
    if (!data?.length) return fail('회차를 찾지 못했어요 — 새로고침 후 다시 해 주세요', 404)
    const { data: rest } = await supabaseAdmin.from('course_curriculum')
      .select('id').eq('course_name', courseName).order('step_order')
    const e2 = await renumber(courseName, (rest || []).map(r => r.id))
    if (e2) return fail('순서 정리 실패: ' + e2.message, 500)
    return NextResponse.json({ ok: true })
  }

  if (action === 'reorder') {
    const ids = Array.isArray(body.ids) ? body.ids : []
    if (!ids.length) return fail('순서가 비었어요')
    const e2 = await renumber(courseName, ids)
    if (e2) return fail('순서 변경 실패: ' + e2.message, 500)
    return NextResponse.json({ ok: true })
  }

  if (action === 'saveCore') {
    const content = typeof body.coreContent === 'string' ? body.coreContent.trim() : ''
    const imgs = Array.isArray(body.coreImages) ? body.coreImages.filter(u => typeof u === 'string') : []
    const { data, error } = await supabaseAdmin.from('class_courses')
      .update({ core_content: content || null, core_images: imgs.length ? imgs : null })
      .eq('name', courseName).select('id')
    if (error) return fail('핵심 내용 저장 실패: ' + error.message, 500)
    if (!data?.length) return fail(`「${courseName}」 수업을 찾지 못했어요`, 404)
    return NextResponse.json({ ok: true, rows: data.length })
  }

  if (action === 'saveCoreDoc') {
    if (!body.doc || typeof body.doc !== 'object') return fail('저장할 내용이 없어요')
    const { data, error } = await supabaseAdmin.from('class_courses')
      .update({ core_doc: body.doc }).eq('name', courseName).select('id')
    if (error) return fail('리치 핵심내용 저장 실패: ' + error.message, 500)
    if (!data?.length) return fail(`「${courseName}」 수업을 찾지 못했어요`, 404)
    return NextResponse.json({ ok: true, rows: data.length })
  }

  return fail('알 수 없는 요청이에요')
}
