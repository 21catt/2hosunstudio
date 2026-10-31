// 우리 스튜디오 3D 벽 그림 — 내 수업 기록 사진을 벽에 건다.
//   · 기본 = 최근 기록 사진 순서대로(새 기록을 올리면 자동으로 바뀐다)
//   · 학생이 칸을 직접 고르면 그 칸은 고정 — 새 기록이 올라와도 바뀌지 않는다
//   · 고정 값 = auth user_metadata.studio_wall { 칸 번호: storage_path } (표·마이그레이션 없음)
//   · 고정한 사진을 지웠으면 그 칸은 다시 최근 기록을 따른다
import { supabase } from './supabase'

export const WALL_SLOTS = ['큰 초상 자리', '파란 그림 자리', '회색 그림 자리', '가로 풍경 자리', '이젤 아래 자리']
const BUCKET = 'class-records'

// 순수 함수 — 칸마다 { path, pinned } 또는 null(원래 벽 그림)
export function resolveWall(recent, pins = {}) {
  const have = new Set(recent)
  const held = WALL_SLOTS.map((_, i) => (pins?.[i] && have.has(pins[i]) ? pins[i] : null))
  const used = new Set(held.filter(Boolean))
  const rest = recent.filter(p => !used.has(p))
  return held.map(p => (p ? { path: p, pinned: true } : rest.length ? { path: rest.shift(), pinned: false } : null))
}

export function nextPins(pins, slot, path) {
  const n = { ...(pins || {}) }
  if (path) n[slot] = path; else delete n[slot]
  return n
}

// 내 기록 사진 경로 — 최근 기록부터
export async function fetchMyPhotos(userId, limit = 24) {
  const { data } = await supabase.from('class_records').select('created_at, class_record_photos(storage_path)')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(40)
  return [...new Set((data || []).flatMap(r => (r.class_record_photos || []).map(p => p.storage_path)))].slice(0, limit)
}

export async function signPaths(paths) {
  if (!paths.length) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  return Object.fromEntries((data || []).filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]))
}

export const savePins = pins => supabase.auth.updateUser({ data: { studio_wall: pins } })
