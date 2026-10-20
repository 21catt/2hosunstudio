// 3D 홈 배경 장면 — 출석한 수업 수로 하나씩 열린다(4 · 8 · 12 · 16회). 미리보기 대상(lib/useCastleSkin)의 설정에서 고른다.
// 지금 실제로 있는 장면은 젤리 성 하나 — 나머지 넷은 자리만(ready: false = 열려도 「준비 중」, 고를 수 없음).
// 새 장면을 넣을 때: 그 칸의 name·desc·thumb 를 채우고 ready: true, 그리고 /castle 이 key 로 장면을 고르게 한다.
// 출석 수 = 냥밭 작물 포인트와 같은 기준(bookings.attended === true).
export const CASTLE_SCENES = [
  { key: 'jelly',  name: '젤리 성',  desc: '떠 있는 성과 호수', unlock: 0,  ready: true,  thumb: '/castle-bg/scene.jpg' },
  { key: 'scene4',  name: '새 장면', desc: '준비 중',            unlock: 4,  ready: false, thumb: null },
  { key: 'scene8',  name: '새 장면', desc: '준비 중',            unlock: 8,  ready: false, thumb: null },
  { key: 'scene12', name: '새 장면', desc: '준비 중',            unlock: 12, ready: false, thumb: null },
  { key: 'scene16', name: '새 장면', desc: '준비 중',            unlock: 16, ready: false, thumb: null },
]
export const DEFAULT_SCENE = 'jelly'
export const SCENE_KEY = '2hs_castle_scene'

export function sceneUnlocked(key, { attended = 0, unlockAll = false } = {}) {
  const sc = CASTLE_SCENES.find(x => x.key === key)
  if (!sc) return false
  return unlockAll || attended >= sc.unlock
}
// 고를 수 있는가 = 열렸고 실제로 만들어져 있다
export function sceneSelectable(key, opts) {
  const sc = CASTLE_SCENES.find(x => x.key === key)
  return !!sc && sc.ready && sceneUnlocked(key, opts)
}
export function getSavedScene() {
  try {
    const v = localStorage.getItem(SCENE_KEY)
    return CASTLE_SCENES.some(x => x.key === v && x.ready) ? v : DEFAULT_SCENE
  } catch { return DEFAULT_SCENE }
}
export function saveSceneLocal(key) {
  try { localStorage.setItem(SCENE_KEY, key) } catch {}
}
