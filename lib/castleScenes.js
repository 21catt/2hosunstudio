// 3D 홈 배경 장면 — 출석한 수업 수로 하나씩 열린다(4 · 8 · 12 · 16회). 미리보기 대상(lib/useCastleSkin)의 설정에서 고른다.
// 있는 장면 = 젤리 성 · 시트러스 젤리(4회) · 젤리 문어(8회) · 설산 기차(12회). 나머지는 자리만(ready: false = 열려도 「준비 중」, 고를 수 없음).
// 새 장면을 넣을 때: 그 칸의 name·desc·thumb 를 채우고 ready: true · embed(한 파일 장면 주소) · globals.css 에 data-scene 배경 한 줄.
// 출석 수 = 냥밭 작물 포인트와 같은 기준(bookings.attended === true).
export const CASTLE_SCENES = [
  { key: 'jelly',  name: '젤리 성',  desc: '떠 있는 성과 호수', unlock: 0,  ready: true,  thumb: '/castle-bg/scene.jpg', thumbPos: 'center 30% / 150% auto' },
  // 시트러스 젤리 = 오렌지 테마(사용자 프롬프트 「Citrus Jelly」 그대로 — public/citrus-jelly, 홈에는 ?embed=1 로 얹는다)
  { key: 'citrus', name: '시트러스 젤리', desc: '잡아 늘리는 오렌지 조각', unlock: 4, ready: true, thumb: '/castle-bg/citrus.jpg', thumbPos: 'center 47% / 150% auto',
    embed: '/citrus-jelly/index.html?embed=1' },
  // 젤리 문어 = 사용자 프롬프트 「Octopus Jelly」(public/octopus-jelly, 홈에는 ?embed=1)
  { key: 'octopus', name: '젤리 문어', desc: '접시 위 말랑한 문어', unlock: 8, ready: true, thumb: '/castle-bg/octopus.jpg', thumbPos: 'center 42% / 150% auto',
    embed: '/octopus-jelly/index.html?embed=1' },
  // 설산 기차 = 사용자 스케치(후지산 같은 설산 · 오르내리는 철길 · 붉은 증기 기차 · 작은 마을) — public/snow-peak, 홈에는 ?embed=1
  { key: 'peak', name: '설산 기차', desc: '설산을 도는 기차와 산타 썰매', unlock: 12, ready: true, thumb: '/castle-bg/peak.jpg', thumbPos: 'center 40% / 150% auto',
    embed: '/snow-peak/index.html?embed=1' },
  { key: 'scene16', name: '새 장면', desc: '준비 중',            unlock: 16, ready: false, thumb: null },
]
export const DEFAULT_SCENE = 'jelly'
export const SCENE_KEY = '2hs_castle_scene'

// 오래 다닌 수강생 — 첫 출석한 수업이 3개월 넘게 전이면 3D 배경을 모두 연다(2026-10-20 사용자 지시)
export const ALL_SCENES_AFTER_MONTHS = 3
export function longTermStudent(firstAttendedDate, now = new Date()) {
  if (!firstAttendedDate) return false
  const d = new Date(firstAttendedDate + (String(firstAttendedDate).length <= 10 ? 'T00:00:00' : ''))
  if (isNaN(d)) return false
  const cut = new Date(now); cut.setMonth(cut.getMonth() - ALL_SCENES_AFTER_MONTHS)
  return d <= cut
}
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

export const sceneOf = key => CASTLE_SCENES.find(x => x.key === key) || CASTLE_SCENES[0]
