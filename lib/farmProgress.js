// 냥밭 진행 규칙 — 기존 냥밭(/student/farm)과 3D 냥밭(/castle/farm)이 같은 함수를 쓴다.
// 규칙이 두 곳에 따로 있으면 한쪽만 고쳐져 두 화면의 작물·잡초가 달라진다.
import { CROP_STAGES } from './farmCats'
import { WEED, weedStage } from './weeds'
import { ticketStarted } from './booking'

// 작물 칸 수(앞칸부터 4점씩 채운다)
export const CROP_PLOTS = 4

// 출석 → 작물 포인트. 참여작가는 모임 출석 1회당 2pt, 수강생은 1pt.
// 남은 포인트(포인트 − 수확×4)가 앞칸부터 4점씩 순서대로 작물을 채운다.
export function cropProgress({ attended = 0, isArtist = false, harvest = 0 }) {
  const cropAttended = attended * (isArtist ? 2 : 1)
  const cropPoints = Math.max(0, cropAttended - harvest * CROP_STAGES)
  return {
    cropPoints,
    cropReady: cropPoints >= CROP_STAGES,
    // i번째 칸의 단계(0 = 빈 칸 … CROP_STAGES = 완숙). 수확은 맨 앞칸(0)만.
    plotStage: i => Math.max(0, Math.min(CROP_STAGES, cropPoints - i * CROP_STAGES)),
  }
}

// 냥밭에서 잡초가 자라는 수강권인가 — 만료일이 없어도 유효로 본다(기존 관용 유지), 시작일 규칙만 공유.
export function farmTicketValid(t, todayStr) {
  return !!(t && t.remain > 0 && (!t.expires_at || t.expires_at >= todayStr) && ticketStarted(t, todayStr))
}

// 잡초 하나 뽑기 — 뽑을 수 없으면(이미 없음·아직 어림) null.
// 반환: { state, gotReward } — gotReward 는 500개 보상 플래그가 처음 켜질 때만 참.
export function pullWeed(s, w, now) {
  if (!s || !s.weeds.some(x => x.id === w.id)) return null
  if (weedStage(w, now) < WEED.REMOVABLE_STAGE) return null
  const removed = s.removed + 1
  const gotReward = !s.rewarded && removed >= WEED.REWARD_AT
  return {
    state: { ...s, weeds: s.weeds.filter(x => x.id !== w.id), removed, rewarded: s.rewarded || removed >= WEED.REWARD_AT },
    gotReward,
  }
}
