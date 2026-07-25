import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 강사 피드백 이미지 업로드 — 관리자만. class-records 버킷의 학생 폴더 아래
// {학생id}/{record_id}/fb_*.jpg 로 service-role 업로드(클라이언트 RLS 우회).
// 열람 경로가 학생 폴더로 시작해야 기존 /api/records/signed-url 로 학생·관리자 모두 서명 가능.
// 이미지 최적화(리사이즈·JPEG 재인코딩)는 클라이언트에서 compressImage 후 전송한다.

export async function POST(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: u } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let form
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'bad form' }, { status: 400 }) }
  const recordId = form.get('recordId')
  const file = form.get('file')
  if (!recordId || !file || typeof file === 'string') return NextResponse.json({ error: 'missing file' }, { status: 400 })
  if (!file.type?.startsWith('image/')) return NextResponse.json({ error: 'not an image' }, { status: 400 })
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'too large' }, { status: 413 })

  // record → 학생 소유자 확인(경로 prefix용)
  const { data: rec } = await supabaseAdmin.from('class_records').select('user_id').eq('id', recordId).single()
  if (!rec) return NextResponse.json({ error: 'record not found' }, { status: 404 })

  const raw = (file.name?.split('.').pop() || '').toLowerCase()
  const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : 'jpg'
  const rand = Math.random().toString(36).slice(2)
  const path = `${rec.user_id}/${recordId}/fb_${Date.now()}_${rand}.${ext}`

  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabaseAdmin.storage
    .from('class-records')
    .upload(path, buf, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ path })
}
