// 화실 소개(오시는 길·화실 사진) — studio_profile 한 줄(id = 1).
// 소개 페이지(/intro)와 관리자 화면(/admin/studio)이 같은 함수를 쓴다.
import { supabase } from './supabase'

export const STUDIO_PHOTO_MAX = 8
export const EMPTY_STUDIO = { address: '', address_detail: '', directions: '', map_url: '', photos: [] }

// 기본 위치 — 표가 없거나(마이그레이션 전) 아직 저장한 적이 없을 때 쓴다.
// 관리자 「화실소개」에서 저장하면 그 값이 이긴다. 지도 버튼은 검색이 아니라 확인된 장소 링크로 간다.
export const DEFAULT_STUDIO = {
  address: '서울 구로구 경인로72길 3-4',
  address_detail: '고동경양 3층 · 녹색 문',
  directions: '신도림역 1번 출구에서 걸어서 3분이에요.\n3층 녹색 문으로 들어오시면 돼요.',
  map_url: 'https://map.naver.com/p/search/2호선%20스튜디오',
  photos: [],
}

// 표가 아직 없으면(마이그레이션 전) 기본 위치 + error 를 돌려준다 — 화면이 죽지 않게.
export async function loadStudioProfile() {
  const { data, error } = await supabase.from('studio_profile').select('*').eq('id', 1).maybeSingle()
  if (error) return { profile: { ...DEFAULT_STUDIO }, error }
  // 저장된 값이 비어 있으면 기본 위치로 채운다 — 빈 칸이 화면에서 통째로 사라지지 않게
  const row = data || {}
  const merged = { ...EMPTY_STUDIO }
  for (const k of ['address', 'address_detail', 'directions', 'map_url']) merged[k] = (row[k] || '').trim() || DEFAULT_STUDIO[k]
  merged.photos = Array.isArray(row.photos) ? row.photos : []
  return { profile: merged, error: null }
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
