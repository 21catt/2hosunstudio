// 젤리성 「해변」 시범판(2026-10-22 — 로컬 미리보기 /castle?beach=1 · 배포 전 사용자 판정, 레퍼런스 = 위에서 내려다본 휴양지 해변 사진들)
//   성은 없다. 틀(블록)을 넓히고(반폭 4) 오른쪽 앞이 넓은 백사장(대각선 해안선), 나머지는 아쿠아빛 바다(바다가 해변보다 넓다).
//   해안선에 파도가 밀려와 하얀 거품으로 퍼졌다 빠진다. 알록달록 파라솔·타월·선베드, 조그만 사람들이 걷다가 물에 들어가 헤엄치고,
//   튜브·매트를 타고 둥둥, 타월 위에 누워 쉰다. 꽃게·조개·문어가 물가를 다니고 갈매기가 원을 그리며 난다.
//   좌표 = 블록(block) 로컬. 물 표면 y = 0, 고원 = 뒤 왼쪽(x < -0.3 · z < -0.12). 모든 자리는 반폭 3 기준 값 × K(= HALF/3)

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const inPlateau = () => false // 해변엔 고원이 없다
const N2 = Math.SQRT1_2

// 야자수 하나(줄기·잎) — 휘어 오르는 줄기 + 늘어진 잎 일곱 + 코코넛 셋
export function palmGeometries(THREE, mergeGeometries, seed = 0) {
  const trunk = [], leaves = [], nuts = []
  const H = 0.95, bend = 0.16 + (seed % 3) * 0.05, segs = 7
  const at = t => [Math.sin(t * 1.4) * bend * t, t * H]
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, [x0, y0] = at(t0), [x1, y1] = at(t1)
    const len = Math.hypot(x1 - x0, y1 - y0), r = 0.045 - t0 * 0.018
    const g = new THREE.CylinderGeometry(r * 0.92, r, len * 1.02, 8)
    g.rotateZ(-Math.atan2(x1 - x0, y1 - y0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0); trunk.push(g)
    const ring = new THREE.TorusGeometry(r * 0.98, 0.006, 4, 10); ring.rotateX(Math.PI / 2); ring.translate(x0, y0 + 0.01, 0); trunk.push(ring)
  }
  const [tx, ty] = at(1)
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + seed * 0.7
    for (let k = 0; k < 2; k++) {
      const g = new THREE.SphereGeometry(1, 8, 4); g.scale(0.2, 0.012, 0.055); g.translate(0.18, 0, 0)
      g.rotateZ(k === 0 ? 0.25 : -0.55); g.translate(k === 0 ? 0 : 0.34, k === 0 ? 0 : 0.08, 0)
      g.rotateY(a); g.translate(tx, ty, 0); leaves.push(g)
    }
  }
  for (let i = 0; i < 3; i++) { const g = new THREE.SphereGeometry(0.035, 10, 8); g.translate(tx + Math.cos(i * 2.1) * 0.04, ty - 0.04, Math.sin(i * 2.1) * 0.04); nuts.push(g) }
  return { trunk: mergeGeometries(trunk), leaves: mergeGeometries(leaves), nuts: mergeGeometries(nuts) }
}

// 벤치 — 연한 티크 널 + 흰 철제 다리
export function makeBench(THREE, std) {
  const g = new THREE.Group(), teak = std('#c99a6a', { roughness: 0.7 }), iron = std('#f6f3ee', { roughness: 0.45, metalness: 0.2 })
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.022, 0.05), teak); s.position.set(0, 0.16, -0.06 + i * 0.06); g.add(s) }
  for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.02), teak); s.position.set(0, 0.24 + i * 0.07, -0.11); s.rotation.x = -0.18; g.add(s) }
  for (const sx of [-0.27, 0.27]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.2), iron); leg.position.set(sx, 0.08, 0); g.add(leg)
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.025), iron); back.position.set(sx, 0.25, -0.12); back.rotation.x = -0.18; g.add(back)
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}

export function buildBeach({ THREE, block, std, mergeGeometries, sandTex, floorMat, HALF, rng, calm, bump }) {
  const K = HALF / 3
  // 해안선 = x+z = S0. 뒤 왼쪽(x+z 가 작은 쪽)이 넓은 백사장, 앞 오른쪽이 바다 — 카메라는 바다 너머로 해변을 본다
  const S0 = 0.4
  // 해안선 굴곡 — 해안을 따라가는 좌표(x−z)에 따라 만(灣)과 곶이 번갈아(일자 경계 대신)
  const bend = t => (0.55 * Math.sin(t * 0.52 + 0.4) + 0.28 * Math.sin(t * 1.27 + 1.9) + 0.12 * Math.sin(t * 2.9)) * K
  const landward = (x, z) => S0 - (x + z) + bend(x - z) // + = 뭍 쪽
  // 모래 높이 — 뭍은 해안선에서 0.16 까지 완만히 오르고, 물밑은 해변에서 멀어질수록 점점 깊어진다(먼바다 ≈ 바닥 -0.8)
  const sandHeight = (x, z) => { const l = landward(x, z); return l >= 0 ? smooth(0, 0.9 * K, l) * 0.16 : -0.8 * (1 - Math.exp(l / (2.4 * K))) }
  const onBeach = (x, z) => landward(x, z) > -0.45 * K
  const all = new THREE.Group(); block.add(all)
  const onSand = (x, z) => Math.max(0, sandHeight(x, z))
  const rnd = (a, b) => a + rng() * (b - a)
  const R = () => Math.random()
  const E = HALF - 0.2 // 소품·사람이 다니는 가장자리 안쪽 한계
  // 해안선에서 뭍 쪽으로 d 만큼(음수 = 바다 쪽), 해안선 위치 u 0..1
  const shoreA = S0 - (HALF - 0.02), shoreB = HALF - 0.02
  // 해안선 위 점(u 0..1) 에서 뭍 쪽으로 d — 곧은 기준선 점을 굴곡만큼 밀어 진짜 해안선(landward = 0)에 맞춘다
  const alongShore = (u, d) => { const x0 = shoreA + u * (shoreB - shoreA), z0 = S0 - x0, dd = d - bend(x0 - z0) * N2; return [x0 - dd * N2, z0 - dd * N2] }
  const distLand = (x, z) => landward(x, z) * N2 // 해안선에서 뭍 쪽 거리

  // ── 모래(블록 전체 — 고원 안쪽은 묻힌다) ──
  const SEG = 140, SZ = HALF * 2
  const g = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG); g.rotateX(-Math.PI / 2)
  const p = g.attributes.position.array, col = new Float32Array(p.length), c = new THREE.Color()
  const dry = new THREE.Color('#fff3da'), dry2 = new THREE.Color('#f7e6c4'), damp = new THREE.Color('#ecd3a3'), under = new THREE.Color('#fffaf0'), deepC = new THREE.Color('#2aa9b8')
  for (let i = 0; i < p.length; i += 3) {
    const y = sandHeight(p[i], p[i + 2]); p[i + 1] = y
    if (y > 0.05) c.copy(dry).lerp(dry2, 0.5 + 0.5 * Math.sin(p[i] * 9 + p[i + 2] * 6) * Math.sin(p[i + 2] * 7)) // 모래 결
    else if (y > -0.02) c.copy(damp) // 젖은 물가
    else c.copy(under).lerp(deepC, smooth(0.02, 0.6, -y)) // 깊을수록 진한 물빛(바닥 색이 비친다)
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals()
  const wetMat = floorMat.clone(); wetMat.color.set('#ffffff'); wetMat.vertexColors = true // 물속 = 호수 바닥처럼 물결 빛 무늬(없으면 젤리 빛깔에 어둡게 묻힌다)
  const dryMat = std('#ffffff', { map: sandTex, roughness: 0.95, vertexColors: true })
  { const ix = g.index.array, wet = [], dr = []
    for (let t = 0; t < ix.length; t += 3) { const ys = [ix[t], ix[t + 1], ix[t + 2]].map(v => p[v * 3 + 1]); (Math.max(...ys) < -0.01 ? wet : dr).push(ix[t], ix[t + 1], ix[t + 2]) }
    g.setIndex([...wet, ...dr]); g.addGroup(0, wet.length, 0); g.addGroup(wet.length, dr.length, 1) }
  const sand = new THREE.Mesh(g, [wetMat, dryMat]); sand.receiveShadow = true; sand.userData.pick = 'sand'; all.add(sand) // 누르면 모래성
  // 블록 가장자리 단면(모래가 물 위로 솟은 만큼)
  for (const side of ['x', 'z']) {
    const pos = [], idx = []
    for (let i = 0; i <= SEG; i++) {
      const u = -HALF + i / SEG * SZ, [x, z] = side === 'x' ? [-HALF, u] : [u, -HALF], top = Math.max(0, sandHeight(x, z)) // 뭍 쪽 두 가장자리
      pos.push(x, top, z, x, 0, z)
      if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals()
    all.add(new THREE.Mesh(sg, std('#ead2a2', { roughness: 0.95, side: THREE.DoubleSide })))
  }

  // ── 파도 — 해안선을 따라 하얀 거품 띠가 밀려왔다 빠진다 ──
  const foamTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64
    const x = cv.getContext('2d')
    for (let i = 0; i < 1500; i++) { const v = Math.pow(Math.random(), 1.8), yy = v * 64
      x.fillStyle = `rgba(255,255,255,${(1 - v) * 0.9})`; x.beginPath(); x.arc(Math.random() * 512, yy, 1 + Math.random() * 4 * (1 - v), 0, 6.3); x.fill() }
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(0, 0, 512, 5) // 앞 가장자리 = 진한 흰 선
    const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t
  })()
  const US = 110
  function makeBand(width) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array((US + 1) * 2 * 3), uv = new Float32Array((US + 1) * 2 * 2), idx = []
    for (let i = 0; i <= US; i++) { uv.set([i / US * 9, 0, i / US * 9, 1], i * 4); if (i < US) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) } }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx)
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }))
    m.renderOrder = 3; m.frustumCulled = false; all.add(m)
    return { m, pos, width }
  }
  // 0..2 = 밀려오는 파도(차례로) · 3 = 물가에 늘 남는 레이스 · 4..5 = 먼바다의 흰 물마루(가늘게 밀려온다)
  const bands = [makeBand(0.3 * K), makeBand(0.26 * K), makeBand(0.28 * K), makeBand(0.1 * K), makeBand(0.05 * K), makeBand(0.05 * K)]
  function placeBand(b, t, d0, wNow, k) {
    for (let i = 0; i <= US; i++) {
      const u = i / US, wig = Math.sin(u * 23 + t * 0.9 + k * 2) * 0.06 * K + Math.sin(u * 61 - t * 1.4 + k) * 0.03 * K
      for (let s = 0; s < 2; s++) {
        let [x, z] = alongShore(u, d0 + wig - s * wNow) // s=0 앞(뭍 쪽), s=1 뒤(바다 쪽)
        x = Math.max(-HALF, Math.min(HALF, x)); z = Math.max(-HALF, Math.min(HALF, z)) // 굴곡이 틀 밖으로 밀어도 가장자리에서 멈춘다
        const j = (i * 2 + s) * 3; b.pos[j] = x; b.pos[j + 1] = Math.max(sandHeight(x, z) + 0.006, 0.03); b.pos[j + 2] = z
      }
    }
    b.m.geometry.attributes.position.needsUpdate = true
  }
  let lastSplash = 0

  // ── 소품: 파라솔·타월·선베드·모래성·서핑보드 ──
  const STRIPES = [
    ['#ff5d6c', '#ffb13b', '#ffe24d', '#5fd38f', '#3fb6ff', '#9b7bff'], // 무지개
    ['#ff8a5b', '#ffd25a'], ['#2f7fe0', '#ffffff'], ['#ffd93b'], ['#ffffff'], ['#ff6fa0', '#ffffff'], ['#3fd0c4', '#fff6e6'], ['#ffffff'],
    ['#ff5d6c', '#ffb13b', '#ffe24d', '#5fd38f', '#3fb6ff', '#9b7bff'], ['#ffffff'],
  ]
  function umbrella(x, z, stripes, tilt) {
    const u = new THREE.Group(); u.position.set(x, onSand(x, z), z); u.rotation.set(tilt, rnd(0, 6), tilt * 0.6); all.add(u)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.5, 6), std('#f7f3ea')); pole.position.y = 0.25; u.add(pole)
    const segs = 12
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.11, 2, 1, true, i / segs * Math.PI * 2, Math.PI * 2 / segs), std(stripes[i % stripes.length], { side: THREE.DoubleSide, roughness: 0.6 }))
      seg.position.y = 0.5; seg.castShadow = true; u.add(seg)
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), std('#ffffff')); knob.position.y = 0.56; u.add(knob)
  }
  function towel(x, z, a, cols) {
    const t = new THREE.Group(); t.position.set(x, onSand(x, z) + 0.005, z); t.rotation.y = a; all.add(t)
    cols.forEach((cc, i) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.36), std(cc, { roughness: 0.9 })); s.position.x = (i - (cols.length - 1) / 2) * 0.06; s.receiveShadow = true; t.add(s) })
  }
  function lounger(x, z, a) {
    const l = new THREE.Group(); l.position.set(x, onSand(x, z), z); l.rotation.y = a; all.add(l)
    const white = std('#fbfaf6', { roughness: 0.5 })
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.3), white); bed.position.set(0, 0.06, 0.03); l.add(bed)
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.12), white); back.position.set(0, 0.1, -0.15); back.rotation.x = -0.7; l.add(back)
    for (const sx of [-0.07, 0.07]) for (const sz of [-0.1, 0.15]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.012), white); leg.position.set(sx, 0.03, sz); l.add(leg) }
    l.traverse(o => { if (o.isMesh) o.castShadow = true })
  }
  const beachSpot = (dMin, dMax) => { for (let k = 0; k < 80; k++) { const x = rnd(-E, E), z = rnd(-E, E), d = distLand(x, z); if (d > dMin && d < dMax) return [x, z] } return [-1, -1] }
  // 파라솔 열 — 해안선과 나란히 두 줄(물가 쪽 · 뭍 쪽)
  const shades = []
  for (let i = 0; i < 18; i++) { // 세 줄 · 여섯 개씩
    const u = 0.07 + (i % 6) * 0.17 + rnd(-0.04, 0.04), d = [0.55, 1.2, 1.9][Math.floor(i / 6)] * K + rnd(-0.1, 0.1)
    const [x, z] = alongShore(u, d)
    if (Math.abs(x) > E || Math.abs(z) > E) continue
    umbrella(x, z, STRIPES[i % STRIPES.length], rnd(-0.08, 0.08)); shades.push([x, z])
  }
  const TOWELS = [['#4fb6d6', '#fff6e6', '#4fb6d6', '#fff6e6', '#4fb6d6'], ['#ff6f91', '#ffd25a', '#ff6f91', '#ffd25a'], ['#9b7bff', '#ffffff', '#9b7bff'], ['#5fd38f', '#ffffff', '#5fd38f', '#ffffff']]
  shades.forEach(([x, z], i) => { if (i % 2 === 0) towel(x + 0.17, z - 0.05, rnd(0, 3), TOWELS[i % TOWELS.length]); else lounger(x + 0.14, z + 0.12, -Math.PI * 0.75 + rnd(-0.3, 0.3)) })
  { const [x, z] = alongShore(0.35, 0.25 * K)
    const sc = new THREE.Group(); sc.position.set(x, onSand(x, z), z); all.add(sc); const sm = std('#ecd09a', { roughness: 1 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 10), sm); base.position.y = 0.035; sc.add(base)
    for (const [dx, dz] of [[0.07, 0.07], [-0.07, 0.07], [0.07, -0.07], [-0.07, -0.07]]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), sm); t.position.set(dx, 0.11, dz); sc.add(t) }
    const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.05, 10), std('#3fb6ff')); pail.position.set(0.16, 0.025, 0.04); sc.add(pail) }
  { const [x, z] = alongShore(0.8, 0.3 * K)
    const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.36, 4, 12), std('#ffd25a', { roughness: 0.35 })); board.scale.set(1, 1, 0.22)
    board.position.set(x, onSand(x, z) + 0.02, z); board.rotation.set(Math.PI / 2, 0, 0.8); board.castShadow = true; all.add(board) }
  // 야자수 — 해변 뒤쪽(뭍 쪽 두 가장자리)을 따라 줄지어
  const trunkMat = std('#a97c55', { roughness: 0.8 }), leafMat = new THREE.MeshPhysicalMaterial({ color: '#3fa565', roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }), nutMat = std('#6b4a2c')
  const palmSpots = []
  for (let v = -HALF + 0.4; v < HALF; v += 0.62) for (const [x, z] of [[-HALF + 0.38 + rnd(-0.1, 0.12), v + rnd(-0.12, 0.12)], [v + rnd(-0.12, 0.12), -HALF + 0.38 + rnd(-0.1, 0.12)]]) {
    if (distLand(x, z) < 2.2 * K || palmSpots.some(([a, b]) => Math.hypot(a - x, b - z) < 0.45)) continue
    palmSpots.push([x, z])
  }
  for (const [i, [x, z]] of palmSpots.entries()) {
    const pg = palmGeometries(THREE, mergeGeometries, i + 3), pv = new THREE.Group(); pv.position.set(x, onSand(x, z), z); pv.scale.setScalar(1 + rnd(0, 0.3)); pv.rotation.y = rnd(0, 6); all.add(pv)
    for (const [geo, m] of [[pg.trunk, trunkMat], [pg.leaves, leafMat], [pg.nuts, nutMat]]) { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; pv.add(mesh) }
  }

  // ── 조그만 사람들 ──
  const SKIN = ['#f6d2b8', '#e9b892', '#c98c62', '#8d5a3b'], SUIT = ['#ff5d6c', '#3fb6ff', '#ffd93b', '#5fd38f', '#9b7bff', '#ff8a5b', '#ffffff', '#2f3a8f']
  const HAIR = ['#2b2233', '#6b4a2c', '#e6c27a', '#a8432a']
  const sphere = new THREE.SphereGeometry(1, 12, 10), cap = new THREE.CapsuleGeometry(1, 1.2, 4, 10)
  function makePerson(i) {
    const g = new THREE.Group(); all.add(g)
    const skin = std(SKIN[i % SKIN.length], { roughness: 0.6 }), suit = std(SUIT[(i * 3) % SUIT.length], { roughness: 0.5 }), hair = std(HAIR[(i * 5) % HAIR.length])
    const body = new THREE.Group(); g.add(body)
    const torso = new THREE.Mesh(cap, suit); torso.scale.set(0.028, 0.026, 0.022); torso.position.y = 0.105; torso.castShadow = true; torso.userData.pick = 'person'; body.add(torso)
    const head = new THREE.Mesh(sphere, skin); head.scale.setScalar(0.026); head.position.y = 0.168; head.castShadow = true; head.userData.pick = 'person'; body.add(head)
    const hr = new THREE.Mesh(sphere, hair); hr.scale.set(0.027, 0.018, 0.027); hr.position.set(0, 0.177, -0.004); body.add(hr)
    const legs = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.set(0.011 * s, 0.075, 0); body.add(pv); const l = new THREE.Mesh(cap, skin); l.scale.set(0.01, 0.022, 0.01); l.position.y = -0.035; l.castShadow = true; pv.add(l); return pv })
    const arms = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.set(0.032 * s, 0.13, 0); body.add(pv); const a = new THREE.Mesh(cap, skin); a.scale.set(0.008, 0.02, 0.008); a.position.y = -0.03; pv.add(a); return pv })
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 8, 16), std(['#ff6fa0', '#ffd93b', '#3fd0c4', '#ff8a5b'][i % 4], { roughness: 0.35 }))
    tube.rotation.x = Math.PI / 2; tube.position.y = 0.075; tube.visible = false; body.add(tube)
    g.scale.setScalar(1.35)
    const pp = { g, body, legs, arms, tube, x: 0, z: 0, tx: 0, tz: 0, a: 0, wait: R() * 3, ph: R() * 6, jump: 0, run: false }
    g.userData.pp = pp
    return pp
  }
  const seaSpot = () => { for (let k = 0; k < 80; k++) { const x = rnd(-E, E), z = rnd(-E, E), d = distLand(x, z); if (d > -1.3 * K && d < -0.3 * K && !inPlateau(x, z)) return [x, z] } return [1.6 * K, 1.0 * K] }
  // 걷는 사람 여덟(가끔 물에 들어가 헤엄치다 나온다)
  const walkers = Array.from({ length: 8 }, (_, i) => {
    const pp = makePerson(i), inSea = i < 3, [x, z] = inSea ? seaSpot() : beachSpot(0.15 * K, 1.5 * K)
    pp.x = pp.tx = x; pp.z = pp.tz = z; return pp
  })
  const goSand = pp => { const [x, z] = beachSpot(0.12 * K, 1.5 * K); pp.tx = x; pp.tz = z }
  const goSea = pp => { const [x, z] = seaSpot(); pp.tx = x; pp.tz = z }
  // 튜브·매트 넷 — 바다에서 둥둥
  const floaters = Array.from({ length: 5 }, (_, i) => {
    const pp = makePerson(10 + i), [x, z] = seaSpot(); pp.x = x; pp.z = z
    if (i % 2 === 0) pp.tube.visible = true
    else {
      const mat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.24), std(['#ff6fa0', '#ffd93b', '#3fd0c4'][i % 3], { roughness: 0.35 })); mat.position.y = 0.01; pp.g.add(mat)
      pp.body.rotation.x = -Math.PI / 2; pp.body.position.set(0, 0.035, 0.09); pp.mat = mat
    }
    pp.drift = new THREE.Vector2(rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(0.025)
    return pp
  })
  // 타월 위에 누워 쉬는 사람
  const loungers = shades.filter((_, i) => i % 2 === 0).slice(0, 6).map(([x, z], i) => {
    const pp = makePerson(20 + i); pp.x = x + 0.17; pp.z = z - 0.05
    pp.g.position.set(pp.x, onSand(pp.x, pp.z) + 0.012, pp.z); pp.g.rotation.y = rnd(0, 6); pp.body.rotation.x = -Math.PI / 2; pp.body.position.set(0, 0.02, 0.08)
    return pp
  })

  // ── 꽃게 셋 · 조개 넷 · 문어 하나(물가) ──
  const crabMat = std('#f0613f', { roughness: 0.4 }), eyeMat = std('#1f1a26'), crabs = []
  for (let i = 0; i < 3; i++) {
    const cg = new THREE.Group(); cg.scale.setScalar(1.6); all.add(cg)
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), crabMat); body.scale.set(1.25, 0.55, 0.9); body.position.y = 0.04; body.castShadow = true; cg.add(body)
    const claws = [-1, 1].map(s => { const cl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), crabMat); cl.scale.set(1.2, 0.7, 1); cl.position.set(0.07 * s, 0.05, 0.05); cg.add(cl); return cl })
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMat); e.position.set(0.02 * s, 0.085, 0.035); cg.add(e) }
    const legs = []
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 4), crabMat); l.position.set(0.075 * s, 0.025, -0.03 + k * 0.025); l.rotation.z = s * 1.0; cg.add(l); legs.push(l) }
    body.userData.pick = 'crab'
    crabs.push({ g: cg, claws, legs, u: R(), dir: R() < 0.5 ? -1 : 1, speed: 0.05 + R() * 0.04, d: (0.15 + i * 0.12) * K, pause: 0, hop: 0 })
  }
  const shellMats = ['#fbd6cf', '#f6e2b8', '#e9d3f2', '#fff1e3'].map(cc => std(cc, { roughness: 0.35, side: THREE.DoubleSide }))
  const clams = [[0.15, 0.25], [0.45, 0.4], [0.7, 0.2], [0.88, 0.45]].map(([u, d], i) => {
    const [x, z] = alongShore(u, d * K)
    const cg = new THREE.Group(); cg.position.set(x, onSand(x, z) + 0.005, z); cg.rotation.y = rnd(0, 6); cg.scale.setScalar(1.6); all.add(cg)
    const half = () => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellMats[i]); h.scale.set(1, 0.45, 0.85); h.castShadow = true; return h }
    const bottom = half(); bottom.rotation.x = Math.PI; cg.add(bottom)
    const hinge = new THREE.Group(); hinge.position.z = -0.042; cg.add(hinge)
    const top = half(); top.position.z = 0.042; hinge.add(top)
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), std('#ffffff', { roughness: 0.15, metalness: 0.2 })); pearl.position.y = 0.006; cg.add(pearl)
    top.userData.pick = 'clam'; bottom.userData.pick = 'clam'
    return { hinge, ph: R() * 6, speed: 0.4 + R() * 0.3 }
  })
  const octMat = std('#f28fb2', { roughness: 0.35 }), oct = new THREE.Group(); oct.scale.setScalar(1.8); all.add(oct)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), octMat); head.scale.set(1, 1.15, 1); head.position.y = 0.11; head.castShadow = true; oct.add(head)
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeMat); e.position.set(0.03 * s, 0.1, 0.065); oct.add(e) }
  const tents = []
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, tg = new THREE.Group(); tg.position.set(Math.cos(a) * 0.04, 0.05, Math.sin(a) * 0.04); tg.rotation.y = -a; oct.add(tg)
    const segs = []; let parent = tg
    for (let k = 0; k < 4; k++) { const sg = new THREE.Group(); sg.position.x = k === 0 ? 0 : 0.03; parent.add(sg); const m = new THREE.Mesh(new THREE.SphereGeometry(0.018 - k * 0.003, 8, 6), octMat); m.scale.set(1.6, 0.8, 1); m.position.x = 0.015; sg.add(m); segs.push(sg); parent = sg }
    tents.push({ segs, a })
  }
  head.userData.pick = 'octopus'
  const octo = { u: 0.3, dir: 1, wig: 0 }

  // ── 갈매기 다섯 ──
  const gullW = std('#ffffff', { roughness: 0.5 }), gullG = std('#9aa3ad'), beakM = std('#f5b335')
  const gulls = Array.from({ length: 5 }, (_, i) => {
    const gg = new THREE.Group(); gg.scale.setScalar(1.9); all.add(gg)
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), gullW); b.scale.set(0.8, 0.7, 1.8); gg.add(b)
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), gullW); hd.position.set(0, 0.025, 0.09); gg.add(hd)
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.035, 6), beakM); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.02, 0.125); gg.add(bk)
    const wings = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.x = 0.03 * s; gg.add(pv)
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.008, 0.07), gullW); w.position.x = 0.11 * s; pv.add(w)
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.009, 0.05), gullG); tip.position.x = 0.21 * s; pv.add(tip); return { pv, s } })
    return { g: gg, wings, r: (2.0 + i * 0.35) * K, y: 2.3 + (i % 2) * 0.6 + i * 0.1, a: i * 1.3, v: 0.14 + i * 0.025, cx: (0.4 + (i % 2) * 0.6) * K, cz: (0.4 - (i % 2) * 0.5) * K, ph: i }
  })

  // ───────── 놀거리 ─────────
  let bigT = 0
  function bigWave() {
    if (bigT > 0.5) return
    bigT = 4.5
    for (const pp of walkers) if (distLand(pp.x, pp.z) < 1.6 * K) { const [x, z] = beachSpot(1.9 * K, 2.8 * K); pp.tx = x; pp.tz = z; pp.run = true; pp.wait = 2 } // 물가 사람들은 뭍으로 뛰어간다
    if (bump) for (let s = 0; s < 14; s++) setTimeout(() => { const [x, z] = alongShore(R(), -0.8 * K); bump(x, z, 0.06, 2.6) }, s * 120)
  }
  // 물 빛깔 — 깊은 곳 바닥 색을 다시 칠한다(물 색은 장면이 젤리 재질로 바꾼다)
  function setWater(deepHex) {
    deepC.set(deepHex)
    for (let i = 0; i < p.length; i += 3) { const y = p[i + 1]; if (y > -0.02) continue; c.copy(under).lerp(deepC, smooth(0.02, 0.6, -y)); col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b }
    g.attributes.color.needsUpdate = true
  }
  // 돌고래 — 먼바다에서 해안과 나란히 세 번씩 뛰어오른다
  const dolMat = std('#7fa9c9', { roughness: 0.3 }), dolBelly = std('#e8f1f7', { roughness: 0.3 })
  function makeDolphin() {
    const d = new THREE.Group(); d.scale.setScalar(1.7); all.add(d)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 6, 12), dolMat); body.rotation.x = Math.PI / 2; body.castShadow = true; d.add(body)
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 6, 10), dolBelly); belly.rotation.x = Math.PI / 2; belly.position.y = -0.015; d.add(belly)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 8), dolMat); nose.rotation.x = Math.PI / 2; nose.position.z = 0.17; d.add(nose)
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), dolMat); fin.position.set(0, 0.06, -0.01); fin.rotation.x = -0.4; d.add(fin)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.04), dolMat); tail.position.z = -0.17; d.add(tail)
    d.visible = false
    return d
  }
  const dolphins = Array.from({ length: 3 }, makeDolphin).map(m => ({ m, active: false }))
  function launchDolphins() {
    const dir = R() < 0.5 ? 1 : -1, u0 = dir > 0 ? 0.12 : 0.88
    dolphins.forEach((d, i) => { Object.assign(d, { active: true, u: u0 - dir * i * 0.04, dir, off: (-2.0 - i * 0.18) * K, ph: -i * 0.9, splashed: false }) })
  }
  // 서퍼 — 먼바다에서 파도를 타고 해안까지, 닿으면 내려서 해변을 걷는다
  let surfer = null
  const trail = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })); m.visible = false; all.add(m); return m })
  function launchSurfer() {
    if (surfer) return
    const pp = makePerson(30 + Math.floor(R() * 8))
    const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.24, 4, 10), std(['#ffd25a', '#ff6f91', '#3fd0c4'][Math.floor(R() * 3)], { roughness: 0.35 })); board.scale.set(1, 1, 0.25); board.rotation.x = Math.PI / 2; board.position.y = 0.012; pp.g.add(board)
    surfer = { pp, board, u: 0.2 + R() * 0.6, d: -2.6 * K }
  }
  // 누른 모래에 모래성(여덟 개까지 — 넘치면 오래된 것부터)
  const castles = [], sandM = std('#ecd09a', { roughness: 1 })
  function sandcastle(x, z) {
    if (sandHeight(x, z) < 0.02) return false
    const sc = new THREE.Group(); sc.position.set(x, onSand(x, z), z); sc.scale.setScalar(0.01); all.add(sc)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 10), sandM); base.position.y = 0.03; base.castShadow = true; sc.add(base)
    for (const [dx, dz] of [[0.06, 0.06], [-0.06, 0.06], [0.06, -0.06], [-0.06, -0.06]]) { const tw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 8), sandM); tw.position.set(dx, 0.1, dz); sc.add(tw) }
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.003), std(['#ff5d6c', '#3fb6ff', '#ffd93b'][castles.length % 3])); flag.position.set(0.016, 0.17, 0); sc.add(flag)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.08, 4), std('#ffffff')); pole.position.y = 0.14; sc.add(pole)
    castles.push({ sc, t: 0 })
    if (castles.length > 8) all.remove(castles.shift().sc)
    return true
  }

  let clock = 0
  function update(dt) {
    clock += dt; const t = clock
    wetMat.emissiveIntensity = floorMat.emissiveIntensity // 낮·밤 따라

    // 파도 — 6초 주기, 셋이 2초 간격으로 차례로 밀려와 모래 위로 퍼졌다 사라진다
    // 큰 파도 — 누르면 4.5초 동안 파도가 훨씬 높이 밀려 올라온다
    const surge = bigT > 0 ? smooth(0, 1.2, 4.5 - bigT) * smooth(0, 1.5, bigT) : 0
    bigT = Math.max(0, bigT - dt)
    const P = 6
    for (let k = 0; k < 3; k++) {
      const ph = ((t + k * P / 3) % P) / P
      const d0 = (-0.75 + smooth(0, 0.7, ph) * (0.95 + surge * 1.1) - Math.max(0, ph - 0.75) * 0.6) * K // 바다에서 와서 뭍(+0.2)까지, 끝에 조금 물러난다(큰 파도 = 훨씬 위까지)
      const op = ph < 0.1 ? ph / 0.1 : ph > 0.7 ? Math.max(0, 1 - (ph - 0.7) / 0.3) : 1
      const w = bands[k].width * (0.6 + smooth(0.3, 0.75, ph) * 0.9) * (1 + surge * 1.2)
      placeBand(bands[k], t, d0, w, k); bands[k].m.material.opacity = op * 0.95
      if (!calm && bump && ph > 0.5 && ph < 0.52 && t - lastSplash > 1) { lastSplash = t; for (let s = 0; s < 5; s++) { const [x, z] = alongShore(R(), -0.5 * K); bump(x, z, 0.025, 2) } }
    }
    placeBand(bands[3], t, 0.02 * K + Math.sin(t * 1.05) * 0.06, bands[3].width, 3)
    // 먼바다 물마루 — 바다 쪽에서 해안으로 천천히 다가오다 사라진다
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.09 + k * 0.5) % 1)
      placeBand(bands[4 + k], t, (-2.4 + ph * 1.5) * K, bands[4 + k].width, 4 + k)
      bands[4 + k].m.material.opacity = Math.sin(ph * Math.PI) * 0.55
    }

    // 사람 — 걷다가(모래), 물에 닿으면 헤엄(몸이 잠기고 팔을 젓는다)
    for (const pp of walkers) {
      const dx = pp.tx - pp.x, dz = pp.tz - pp.z, dist = Math.hypot(dx, dz)
      const inWater = sandHeight(pp.x, pp.z) < -0.04
      if (dist > 0.02) {
        const sp = (inWater ? 0.08 : 0.15) * (calm ? 0.5 : 1) * (pp.run ? 2.8 : 1)
        pp.x += dx / dist * Math.min(dist, sp * dt); pp.z += dz / dist * Math.min(dist, sp * dt); pp.a = Math.atan2(dx, dz)
      } else {
        pp.wait -= dt
        pp.run = false
        if (pp.wait <= 0) { pp.wait = 1.5 + R() * 3; if (inWater) (R() < 0.5 ? goSea : goSand)(pp); else (R() < 0.4 ? goSea : goSand)(pp) }
      }
      const moving = dist > 0.02 && !calm
      const y = inWater ? -0.115 + Math.sin(t * 3 + pp.ph) * 0.006 : onSand(pp.x, pp.z)
      pp.jump = Math.max(0, pp.jump - dt * 1.6)
      pp.g.position.set(pp.x, y + Math.abs(Math.sin(pp.jump * Math.PI * 2)) * 0.12 * (pp.jump > 0 ? 1 : 0), pp.z); pp.g.rotation.y = pp.a
      if (pp.jump > 0) { pp.arms.forEach((a, k) => { a.rotation.z = (k ? -1 : 1) * 2.6 }) }
      pp.legs.forEach((l, k) => { l.rotation.x = moving && !inWater ? Math.sin(t * 10 + pp.ph + k * Math.PI) * 0.6 : 0 })
      pp.arms.forEach((a, k) => { a.rotation.x = inWater ? Math.sin(t * 5 + pp.ph + k * Math.PI) * 2.2 : moving ? -Math.sin(t * 10 + pp.ph + k * Math.PI) * 0.5 : 0; a.rotation.z = inWater ? 0 : (k ? -0.15 : 0.15) })
    }
    // 튜브·매트 — 천천히 떠다니며 물결에 흔들린다
    for (const pp of floaters) {
      if (!calm) { pp.x += pp.drift.x * dt; pp.z += pp.drift.y * dt }
      const d = distLand(pp.x, pp.z)
      if (d > -0.3 * K || d < -1.4 * K || Math.abs(pp.x) > E || Math.abs(pp.z) > E || inPlateau(pp.x, pp.z)) { pp.drift.multiplyScalar(-1); pp.x += pp.drift.x * dt * 3; pp.z += pp.drift.y * dt * 3 }
      pp.jump = Math.max(0, pp.jump - dt * 1.2)
      pp.g.position.set(pp.x, -0.02 + Math.sin(t * 1.6 + pp.ph) * (0.012 + surge * 0.05) + Math.sin(pp.jump * Math.PI) * 0.08, pp.z)
      pp.g.rotation.set(Math.sin(t * 1.3 + pp.ph) * 0.08, pp.ph + t * 0.05, Math.cos(t * 1.1 + pp.ph) * 0.08)
      if (!pp.mat) { pp.body.position.y = -0.045; pp.arms.forEach((a, k) => { a.rotation.z = (k ? -1 : 1) * 1.2 }) }
      pp.legs.forEach((l, k) => { l.rotation.x = calm ? 0 : Math.sin(t * 2 + pp.ph + k) * 0.3 })
    }
    for (const pp of loungers) pp.legs.forEach((l, k) => { l.rotation.x = calm ? 0 : Math.max(0, Math.sin(t * 0.8 + pp.ph + k * 2)) * 0.5 })

    // 꽃게 — 해안선과 나란히 옆걸음, 가끔 멈춰 집게를 든다
    for (const cb of crabs) {
      if (cb.pause > 0) cb.pause -= dt
      else { cb.u += cb.dir * cb.speed * dt / (4 * K); if (cb.u > 0.95 || cb.u < 0.05) cb.dir *= -1; if (R() < dt * 0.25) cb.pause = 1 + R() * 1.5 }
      const [x, z] = alongShore(cb.u, cb.d)
      cb.hop = Math.max(0, cb.hop - dt * 2.5)
      cb.g.position.set(x, onSand(x, z) + Math.sin(cb.hop * Math.PI) * 0.12, z); cb.g.rotation.y = -Math.PI / 4
      const walking = cb.pause <= 0 && !calm
      cb.legs.forEach((l, k) => { l.rotation.x = walking ? Math.sin(t * 16 + k * 1.3) * 0.5 : 0 })
      cb.claws.forEach((cl, k) => { cl.position.y = 0.05 + (cb.pause > 0 && !calm ? Math.abs(Math.sin(t * 5 + k)) * 0.04 : 0) })
    }
    for (const cl of clams) cl.hinge.rotation.x = -(calm ? 0.35 : 0.1 + Math.max(0, Math.sin(t * cl.speed + cl.ph)) * 0.75)
    // 문어 — 물가를 따라 느릿느릿
    octo.u += octo.dir * dt * 0.012 * (calm ? 0 : 1); if (octo.u > 0.9 || octo.u < 0.1) octo.dir *= -1
    octo.wig = Math.max(0, octo.wig - dt)
    { const [x, z] = alongShore(octo.u, (0.1 + Math.sin(t * 0.4) * 0.05) * K)
      oct.position.set(x, onSand(x, z) + Math.abs(Math.sin(t * 2.2)) * 0.01, z); oct.rotation.y = octo.dir > 0 ? Math.PI * 0.75 : -Math.PI * 0.25 }
    head.scale.y = 1.15 + Math.sin(t * 2.2) * 0.05
    for (const tn of tents) tn.segs.forEach((sg, k) => { sg.rotation.z = -0.25 + (calm ? 0 : Math.sin(t * 3.2 + tn.a * 2 - k * 0.8) * (0.25 + octo.wig * 0.4)) })
    // 갈매기 — 원을 그리며, 날갯짓과 활공을 번갈아
    for (const gl of gulls) {
      gl.a += gl.v * dt
      gl.g.position.set(gl.cx + Math.cos(gl.a) * gl.r, gl.y + Math.sin(t * 0.7 + gl.ph) * 0.12, gl.cz + Math.sin(gl.a) * gl.r)
      gl.g.rotation.set(0, -gl.a, -0.25)
      const flap = calm ? 0.1 : (Math.sin(t * 0.5 + gl.ph) > 0.2 ? Math.sin(t * 9 + gl.ph) * 0.5 : 0.08)
      for (const w of gl.wings) w.pv.rotation.z = flap * w.s
    }
  }
  function updateFun(dt, t) {
    // 돌고래
    for (const d of dolphins) {
      if (!d.active) continue
      d.ph += dt * 1.9; d.u += d.dir * dt * 0.05
      const arc = Math.sin(d.ph), [x, z] = alongShore(d.u, d.off)
      d.m.visible = d.ph > 0 && arc > -0.15
      d.m.position.set(x, -0.05 + Math.max(-0.2, arc) * 0.45, z)
      d.m.rotation.set(-Math.cos(d.ph) * 0.9, d.dir > 0 ? Math.PI * 0.75 : -Math.PI * 0.25, 0)
      if (arc < -0.1 && Math.cos(d.ph) < 0 && !d.splashed) { d.splashed = true; if (bump) bump(x, z, 0.05, 2) }
      if (arc > 0.2) d.splashed = false
      if (d.ph > Math.PI * 6) { d.active = false; d.m.visible = false } // 세 번 뛰고 들어간다
    }
    // 서퍼
    if (surfer) {
      const sf = surfer, pp = sf.pp
      sf.d += dt * 0.32 * K
      const [x, z] = alongShore(sf.u, sf.d)
      pp.x = x; pp.z = z
      pp.g.position.set(x, Math.max(0, sandHeight(x, z)) + 0.01 + Math.sin(t * 3) * 0.01, z); pp.g.rotation.y = Math.PI * 1.25 + Math.sin(t * 1.3) * 0.25
      pp.body.rotation.z = Math.sin(t * 1.7) * 0.15; pp.arms.forEach((a, k) => { a.rotation.z = (k ? -1 : 1) * 1.4 })
      trail.forEach((m, i) => { const [tx, tz] = alongShore(sf.u + Math.sin(t * 4 + i) * 0.002, sf.d - 0.06 - i * 0.05); m.visible = true; m.position.set(tx, 0.03, tz); m.material.opacity = 0.8 * (1 - i / trail.length); m.scale.setScalar(1 + i * 0.25) })
      if (sf.d > 0.25 * K) { // 해안 도착 — 내려서 걷는다(보드는 모래에 둔다)
        pp.g.remove(sf.board); sf.board.position.set(x + 0.08, onSand(x, z) + 0.01, z); all.add(sf.board)
        pp.body.rotation.z = 0; pp.tx = x; pp.tz = z; pp.wait = 1; pp.jump = 1
        walkers.push(pp); trail.forEach(m => { m.visible = false }); surfer = null
      }
    }
    // 모래성 — 쑥 솟아오른다
    for (const cs of castles) { cs.t = Math.min(1, cs.t + dt * 2.5); cs.sc.scale.setScalar(Math.max(0.01, 1.7 * (1 - Math.pow(1 - cs.t, 3)))) }
  }

  function tap(kind, obj, point) {
    if (kind === 'sand' && point) { const lp = block.worldToLocal(point.clone()); sandcastle(lp.x, lp.z) }
    if (kind === 'person') { let o = obj; while (o && !o.userData.pp) o = o.parent; if (o) { o.userData.pp.jump = 1 } }
    if (kind === 'crab') { const cb = crabs.find(c => c.g === obj.parent); if (cb) { cb.hop = 1; cb.dir *= -1; cb.pause = 0 } }
    if (kind === 'octopus') octo.wig = 1.5
    if (kind === 'clam') { const cl = clams.find(c => c.hinge === obj.parent); if (cl) cl.ph += Math.PI }
  }
  update(0.016) // 첫 그림부터 파도·사람 자리가 잡혀 있게
  return { update: dt => { update(dt); updateFun(dt, clock) }, tap, onBeach, setWater, bigWave, dolphins: launchDolphins, surf: launchSurfer, group: all }
}
