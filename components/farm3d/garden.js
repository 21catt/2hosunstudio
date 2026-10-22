// 3D 냥밭 — 꽃밭(잡초 500개 보상) + 냥이 일 효과(물주기 물방울 · 밭갈기 고랑·흙먼지 · 낮잠 Zzz) (2026-10-22)
//   꽃밭 규칙은 lib/flowerBed(물 하루 세 번 · 비 · 열 송이). 여기는 그리기만 한다: setFlowers(flowerView 결과 | null)
//   좌표 = 섬(island) 로컬. 꽃밭 자리 = 섬 뒤쪽 가운데(헛간 왼쪽 · 울타리 앞)

import { FLOWER_KINDS, FLOWER } from '../../lib/flowerBed'

export const BED = { x: -0.3, z: -2.0, w: 2.4, d: 1.05 }

export function makeGarden({ THREE, island, mat, reduce }) {
  const matCache = new Map()
  const cm = (c, o) => { const k = c + JSON.stringify(o || {}); if (!matCache.has(k)) matCache.set(k, mat(c, o)); return matCache.get(k) }
  const sphere = new THREE.SphereGeometry(1, 14, 10), cyl = new THREE.CylinderGeometry(1, 1, 1, 8), cone = new THREE.ConeGeometry(1, 1, 10, 1, true)

  // ── 꽃밭(보상을 받았을 때만 보인다) ──
  const bed = new THREE.Group(); bed.position.set(BED.x, 0, BED.z); bed.visible = false; island.add(bed)
  const frameMat = cm(0xf3d9b0), soilMat = mat(0x8a5a40, { roughness: 0.95 })
  const soil = new THREE.Mesh(new THREE.BoxGeometry(BED.w, 0.1, BED.d), soilMat); soil.position.y = 0.06; soil.receiveShadow = true; bed.add(soil)
  for (const [x, z, w, d] of [[0, -BED.d / 2, BED.w + 0.1, 0.07], [0, BED.d / 2, BED.w + 0.1, 0.07], [-BED.w / 2, 0, 0.07, BED.d], [BED.w / 2, 0, 0.07, BED.d]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), frameMat); b.position.set(x, 0.08, z); b.castShadow = true; bed.add(b)
  }
  // 열 자리(앞줄 다섯 · 뒷줄 다섯 — 피는 순서 = 앞줄 왼쪽부터)
  const SLOTS = Array.from({ length: FLOWER.COUNT }, (_, i) => [-0.96 + (i % 5) * 0.48, i < 5 ? 0.24 : -0.24])
  const slotGroups = SLOTS.map(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0.11, z); g.scale.setScalar(1.9); bed.add(g); return g }) // 멀리서도 모양이 보이게 크게
  const dots = SLOTS.map(([x, z]) => { const m = new THREE.Mesh(sphere, cm(0x6b4532)); m.scale.set(0.05, 0.02, 0.05); m.position.set(x, 0.115, z); bed.add(m); return m })
  let shownKey = '', bedWet = 0

  const put = (g, geo, m, [sx, sy, sz], [x, y, z], rot) => { const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); if (rot) o.rotation.set(...rot); o.castShadow = true; g.add(o); return o }

  // 꽃 한 송이 — k = 종류, s = 0..1 피어난 정도(1 = 활짝), stage = 0..5
  function buildFlower(g, k, stage) {
    for (const c of [...g.children]) g.remove(c)
    const leaf = cm(0x5fae5f), stemM = cm(0x6cb86a)
    const H = (k.big ? 0.46 : 0.32) * [0.25, 0.55, 0.8, 0.95, 1, 1][stage]
    // 줄기·잎
    put(g, cyl, stemM, [0.012, H, 0.012], [0, H / 2, 0])
    put(g, sphere, leaf, [0.06, 0.018, 0.03], [0.05, H * 0.35, 0], [0, 0, 0.5])
    if (stage >= 1) put(g, sphere, leaf, [0.06, 0.018, 0.03], [-0.05, H * 0.55, 0], [0, 0, -0.5])
    if (stage < 2) return
    const head = new THREE.Group(); head.position.y = H; g.add(head)
    const col = cm(k.color, { roughness: 0.5 }), cen = k.center ? cm(k.center) : null
    if (stage === 2) { put(head, sphere, col, [0.04, 0.06, 0.04], [0, 0.03, 0]); return } // 봉오리
    const open = stage === 3 ? 0.55 : stage === 4 ? 0.82 : 1
    const R = (k.big ? 0.13 : 0.085) * open, n = k.petals
    if (k.shape === 'flat') {
      head.rotation.x = -0.5
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(head, sphere, col, [R * 0.55, 0.008, R * 0.18], [Math.cos(a) * R * 0.6, 0, Math.sin(a) * R * 0.6], [0, -a, 0]) }
      put(head, sphere, cen, [R * 0.38, R * 0.18, R * 0.38], [0, 0.008, 0])
    } else if (k.shape === 'cup') {
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(head, sphere, col, [R * 0.32, R * 0.75, R * 0.2], [Math.cos(a) * R * 0.32, R * 0.55, Math.sin(a) * R * 0.32], [Math.sin(a) * 0.35, -a, -Math.cos(a) * 0.35]) }
      if (cen) put(head, sphere, cen, [R * 0.2, R * 0.2, R * 0.2], [0, R * 0.5, 0])
    } else if (k.shape === 'ball') {
      put(head, sphere, col, [R * 0.55, R * 0.55, R * 0.55], [0, R * 0.5, 0])
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = i < 5 ? 0.42 : 0.3, y = i < 5 ? 0.35 : 0.7; put(head, sphere, cm(i % 2 ? k.color : 0xc93450), [R * 0.4, R * 0.32, R * 0.16], [Math.cos(a) * R * rr, R * y, Math.sin(a) * R * rr], [0, -a, 0.4]) }
    } else if (k.shape === 'spike') {
      for (let i = 0; i < n; i++) put(head, sphere, col, [0.022 * open, 0.026 * open, 0.022 * open], [Math.sin(i * 2.4) * 0.012, i * 0.026 * open, Math.cos(i * 2.4) * 0.012])
    } else if (k.shape === 'bell') {
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, b = new THREE.Group(); b.position.set(Math.cos(a) * 0.05, -0.02 - i * 0.025, Math.sin(a) * 0.05); head.add(b)
        put(b, cone, col, [R * 0.38, R * 0.55, R * 0.38], [0, 0, 0], [0, 0, 0]) }
    } else if (k.shape === 'cluster') {
      for (let i = 0; i < n; i++) { const p = new THREE.Vector3(Math.sin(i * 2.4) * Math.cos(i * 1.3), Math.cos(i * 1.7) * 0.6 + 0.6, Math.cos(i * 2.4) * Math.cos(i * 1.3)).multiplyScalar(R * 0.55)
        put(head, sphere, cm(i % 3 ? k.color : 0xb7a4ff), [R * 0.24, R * 0.18, R * 0.24], [p.x, p.y, p.z]) }
    } else if (k.shape === 'star') {
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; put(head, sphere, col, [R * 0.75, 0.01, R * 0.16], [Math.cos(a) * R * 0.6, R * 0.25, Math.sin(a) * R * 0.6], [0, -a, 0.55]) }
      put(head, cyl, cen, [0.004, R * 0.5, 0.004], [0, R * 0.4, 0])
    }
  }

  function setFlowers(v) {
    bed.visible = !!v
    if (!v) return
    const key = `${v.bloomed}:${v.stage}`
    if (key === shownKey) return
    shownKey = key
    slotGroups.forEach((g, i) => {
      dots[i].visible = i > v.bloomed
      if (i < v.bloomed) buildFlower(g, FLOWER_KINDS[i], 5)
      else if (i === v.bloomed && v.bloomed < FLOWER.COUNT) buildFlower(g, FLOWER_KINDS[i], v.stage)
      else for (const c of [...g.children]) g.remove(c)
    })
  }

  // ── 물방울(물뿌리개) ──
  const drops = Array.from({ length: 26 }, () => { const m = new THREE.Mesh(sphere, mat(0x8fc8f5, { transparent: true, opacity: 0.85, roughness: 0.1 })); m.scale.setScalar(0.022); m.visible = false; island.add(m); return { m, v: new THREE.Vector3(), life: 0 } })
  let pour = 0, pourFrom = new THREE.Vector3(), pourTo = new THREE.Vector3(), pourBed = false
  function water(from, to, onBed) { pour = 1.6; pourFrom.copy(from); pourTo.copy(to); pourBed = onBed }

  // ── 밭갈기(고랑·흙먼지) ──
  const furrows = []
  const furrowMat = () => new THREE.MeshStandardMaterial({ color: 0x5e3b2a, roughness: 1, transparent: true, opacity: 0.9 })
  function till(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0.115, z); island.add(g)
    const m = furrowMat()
    for (let k = -1; k <= 1; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.012, 0.06), m); f.position.z = k * 0.26; g.add(f) }
    furrows.push({ g, m, life: 30 })
    for (let k = 0; k < 8; k++) puff(x + (Math.random() - 0.5) * 0.7, z + (Math.random() - 0.5) * 0.7)
  }
  const puffs = []
  function puff(x, z) { const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: 0xc9a27e, transparent: true, opacity: 0.7, roughness: 1 })); m.position.set(x, 0.15, z); m.scale.setScalar(0.04); island.add(m); puffs.push({ m, life: 0.9 }) }

  // ── 낮잠 Zzz ──
  const zTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = 'bold 48px sans-serif'; x.fillStyle = '#7f6bd6'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Z', 32, 34)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })()
  const zs = Array.from({ length: 3 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false })); s.visible = false; island.add(s); return { s, ph: i / 3 } })

  function update(dt, t, { catPos, napping }) {
    // 물방울 — 냥이 손 → 목표 쪽으로 포물선
    if (pour > 0) {
      pour -= dt
      for (const d of drops) if (d.life <= 0 && Math.random() < dt * 22) {
        d.life = 0.7; d.m.visible = true; d.m.position.copy(pourFrom).add(new THREE.Vector3(0, 0.45, 0))
        d.v.copy(pourTo).sub(pourFrom).setY(0).multiplyScalar(1.1).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.0 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4))
      }
      if (pourBed) bedWet = 1
    }
    for (const d of drops) if (d.life > 0) { d.life -= dt; d.v.y -= 4.5 * dt; d.m.position.addScaledVector(d.v, dt); if (d.life <= 0 || d.m.position.y < 0.08) { d.life = 0; d.m.visible = false } }
    bedWet = Math.max(0, bedWet - dt * 0.03)
    soilMat.color.setRGB(0.54 - bedWet * 0.18, 0.35 - bedWet * 0.13, 0.25 - bedWet * 0.09)
    // 고랑 — 30초에 걸쳐 옅어진다
    for (const f of [...furrows]) { f.life -= dt; f.m.opacity = Math.min(0.9, f.life / 10); if (f.life <= 0) { island.remove(f.g); f.m.dispose(); furrows.splice(furrows.indexOf(f), 1) } }
    for (const p of [...puffs]) { p.life -= dt; p.m.scale.setScalar(0.04 + (0.9 - p.life) * 0.18); p.m.position.y += dt * 0.25; p.m.material.opacity = Math.max(0, p.life * 0.75)
      if (p.life <= 0) { island.remove(p.m); p.m.material.dispose(); puffs.splice(puffs.indexOf(p), 1) } }
    // Zzz
    for (const z of zs) {
      z.s.visible = !!napping
      if (!napping) continue
      const k = (t * 0.35 + z.ph) % 1
      z.s.position.set(catPos.x + 0.25 + k * 0.25 + (reduce ? 0 : Math.sin(t * 2 + z.ph * 6) * 0.04), 0.75 + k * 0.7, catPos.z)
      const sc = 0.12 + k * 0.14; z.s.scale.set(sc, sc, 1); z.s.material.opacity = Math.sin(k * Math.PI)
    }
    // 꽃 살랑
    if (!reduce && bed.visible) slotGroups.forEach((g, i) => { g.rotation.z = Math.sin(t * 1.6 + i) * 0.05 })
  }

  return { setFlowers, water, till, update, bedSpot: () => new THREE.Vector3(BED.x + 0.15, 0.11, BED.z + BED.d / 2 + 0.3) }
}
