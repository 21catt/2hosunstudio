// 화실 소개(오시는 길·화실 사진) — studio_profile 한 줄(id = 1).
// 소개 페이지(/intro)와 관리자 화면(/admin/studio)이 같은 함수를 쓴다.
import { supabase } from './supabase'

export const STUDIO_PHOTO_MAX = 8
export const EMPTY_STUDIO = { address: '', address_detail: '', directions: '', map_url: '', photos: [] }

// 표가 아직 없으면(마이그레이션 전) 빈 값 + error 를 돌려준다 — 화면이 죽지 않게.
export async function loadStudioProfile() {
  const { data, error } = await supabase.from('studio_profile').select('*').eq('id', 1).maybeSingle()
  if (error) return { profile: { ...EMPTY_STUDIO }, error }
  return { profile: { ...EMPTY_STUDIO, ...(data || {}), photos: Array.isArray(data?.photos) ? data.photos : [] }, error: null }
}

export async function saveStudioProfile(p) {
  const row = {
    id: 1,
    address: (p.address || '').trim(),
    address_detail: (p.address_detail || '').trim(),
    directions: (p.directions || '').trim(),
    map_url: (p.map_url || '').trim(),
    photos: p.photos || [],
    updated_at: new Date().toISOString(),
  }
  return supabase.from('studio_profile').upsert(row)
}

// 지도 링크 — 관리자가 붙여 넣은 공유 링크가 우선, 없으면 주소로 검색
export function mapLinks(p) {
  const q = encodeURIComponent(p.address || '')
  return {
    naver: p.map_url || `https://map.naver.com/p/search/${q}`,
    kakao: `https://map.kakao.com/link/search/${q}`,
    embed: `https://maps.google.com/maps?q=${q}&z=16&output=embed`,
  }
}

export function storagePathOf(url) {
  return (url || '').split('/seat-photos/')[1] || null
}
