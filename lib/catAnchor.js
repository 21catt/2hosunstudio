// 장면 속 냥이 머리 위 화면 좌표 — 냥이 말풍선(components/CatTalk)이 그 자리에 붙는다 (2026-10-22)
//   장면이 매 프레임 쓴다: ref.current = { x, y, visible } (x·y = 브라우저 창 좌표 px, 말풍선은 position: fixed)
//   head = 스프라이트 로컬 좌표의 머리 끝(가운데 기준 스프라이트 = (0, 0.5, 0) · 발 기준 = (0, 1, 0)) · tmp = 재사용 Vector3
export function writeCatAnchor(ref, { sprite, camera, canvas, head, tmp }) {
  if (!ref) return
  const shown = !!(sprite.visible && sprite.material?.map && sprite.parent?.visible !== false)
  if (!shown) { ref.current = { x: 0, y: 0, visible: false }; return }
  tmp.copy(head); sprite.localToWorld(tmp); tmp.project(camera)
  const r = canvas.getBoundingClientRect()
  const x = r.left + (tmp.x + 1) / 2 * r.width, y = r.top + (1 - tmp.y) / 2 * r.height
  const visible = tmp.z < 1 && x > r.left - 40 && x < r.right + 40 && y > r.top - 40 && y < r.bottom + 40
  ref.current = { x, y, visible }
}
