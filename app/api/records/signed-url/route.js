import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'no path' }, { status: 400 })

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // path format: {user_id}/{record_id}/{filename}
  const ownerId = path.split('/')[0]
  const isOwner = ownerId === user.id

  if (!isOwner) {
    const { data: u } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
    if (u?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin.storage.from('class-records').createSignedUrl(path, 3600)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}
