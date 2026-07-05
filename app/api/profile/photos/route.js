import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 인스타형 프로필 사진 = 그 사람의 기록 사진(class_record_photos).
// 본인/관리자는 전부(공개+비공개), 외부인은 is_public=true만. 비공개 사진은 서명 URL 자체를 안 준다.

async function getViewer(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabaseAdmin.auth.getUser(token)
  return data?.user || null
}

async function isAdmin(id) {
  const { data } = await supabaseAdmin.from('users').select('role').eq('id', id).single()
  return data?.role === 'admin'
}

// GET /api/profile/photos?userId=... → { isOwner, total, photos:[{id,url,is_public,note}] }
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'no userId' }, { status: 400 })

  const viewer = await getViewer(req)
  let isOwner = !!viewer && viewer.id === userId
  if (!isOwner && viewer) isOwner = await isAdmin(viewer.id)

  const sel = (cols) => supabaseAdmin
    .from('class_records')
    .select(`id, class_date, note, class_record_photos(${cols})`)
    .eq('user_id', userId)
    .order('class_date', { ascending: false })

  // is_public 컬럼이 아직 없으면(마이그레이션 전) 없이 재조회
  let hasFlag = true
  let { data: recs, error } = await sel('id, storage_path, is_public, created_at')
  if (error) { hasFlag = false; ({ data: recs } = await sel('id, storage_path, created_at')) }

  const flat = []
  ;(recs || []).forEach(r => (r.class_record_photos || []).forEach(ph => flat.push({
    id: ph.id,
    storage_path: ph.storage_path,
    is_public: hasFlag ? !!ph.is_public : false,
    note: r.note || '',
    created_at: ph.created_at || r.class_date || '',
  })))
  flat.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const visible = isOwner ? flat : flat.filter(p => p.is_public)
  const paths = visible.map(p => p.storage_path)
  let signedMap = {}
  if (paths.length) {
    const { data: signed } = await supabaseAdmin.storage.from('class-records').createSignedUrls(paths, 3600)
    ;(signed || []).forEach(s => { if (s.signedUrl && !s.error) signedMap[s.path] = s.signedUrl })
  }
  const photos = visible
    .map(p => ({ id: p.id, url: signedMap[p.storage_path] || null, is_public: p.is_public, note: p.note }))
    .filter(p => p.url)

  return NextResponse.json({ isOwner, total: isOwner ? flat.length : photos.length, photos })
}

// POST /api/profile/photos  { photoId, isPublic } → 공개/비공개 토글 (본인/관리자만)
export async function POST(req) {
  const viewer = await getViewer(req)
  if (!viewer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { photoId, isPublic } = await req.json().catch(() => ({}))
  if (!photoId) return NextResponse.json({ error: 'no photoId' }, { status: 400 })

  const { data: ph } = await supabaseAdmin.from('class_record_photos').select('id, record_id').eq('id', photoId).single()
  if (!ph) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data: rec } = await supabaseAdmin.from('class_records').select('user_id').eq('id', ph.record_id).single()
  let ok = rec?.user_id === viewer.id
  if (!ok) ok = await isAdmin(viewer.id)
  if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin.from('class_record_photos').update({ is_public: !!isPublic }).eq('id', photoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
