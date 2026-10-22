// 3D 냥밭 손님들 — 새·두더지·지렁이 (2026-10-22, 꾸밈 놀이 — 작물·잡초 기록과 무관)
//   · 새   = 가끔 날아와 밭에 앉아 작물을 쫀다 → 농부냥이 달려가 쫓는다(새를 누르면 냥이가 바로 달려간다). 밤·비 오는 동안엔 안 온다
//   · 두더지 = 구멍 다섯 곳에서 번갈아 고개를 내민다 — 올라와 있을 때 누르면 잡는다(두더지 게임). 누르기 쉽게 몸보다 넓은 눌림 자리
//   · 지렁이 = 풀밭·흙을 꿈틀꿈틀 기어다니다 가끔 흙 속으로 들어갔다 다른 곳에서 나온다. 그냥 두어도 된다
//   좌표 = 섬(island) 로컬. 기하·재질은 종류마다 하나를 함께 쓴다(새·두더지가 오가도 새로 만들지 않는다)

const HOLES = [[-1.75, -0.55], [0.15, -2.25], [2.25, 0.15], [-0.55, 2.3], [1.55, 2.35]]
const POND = { x: -2.05, z: 2.05, r: 1.25 }, SHED = { x: 1.9, z: -1.9, r: 1.2 }

export function makeCritters({ THREE, island, mat, pickable, unpick, plots, reduce }) {
  const rnd = (a, b) => a + Math.random() * (b - a)
  const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o })

  // ───────── 새 ─────────
  const G = {
    body: new THREE.SphereGeometry(0.11, 14, 10), head: new THREE.SphereGeometry(0.075, 12, 10),
    beak: new THREE.ConeGeometry(0.025, 0.07, 8), eye: new THREE.SphereGeometry(0.014, 6, 6),
    wing: new THREE.SphereGeometry(0.08, 10, 6), tail: new THREE.ConeGeometry(0.05, 0.12, 4),
    hit: new THREE.SphereGeometry(0.26, 10, 8),
  }
  const M = {
    beak: mat(0xf5a33c), eye: basic(0x2b2233), belly: mat(0xfff3e4),
    hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  }
  const BIRD_COLORS = [0x7fb6e8, 0xb98b62, 0xe98c9b, 0x8fcf8f]
  const birdMats = BIRD_COLORS.map(c => mat(c))
  const birds = []
  let birdId = 0, nextBird = rnd(6, 12)

  function makeBird() {
    const g = new THREE.Group(), col = birdMats[Math.floor(Math.random() * birdMats.length)]
    const body = new THREE.Mesh(G.body, col); body.scale.set(1, 0.85, 1.25); body.castShadow = true; g.add(body)
    const belly = new THREE.Mesh(G.body, M.belly); belly.scale.set(0.7, 0.6, 0.9); belly.position.set(0, -0.03, 0.03); g.add(belly)
    const headPiv = new THREE.Group(); headPiv.position.set(0, 0.08, 0.1); g.add(headPiv)
    const head = new THREE.Mesh(G.head, col); head.castShadow = true; headPiv.add(head)
    const beak = new THREE.Mesh(G.beak, M.beak); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.005, 0.09); headPiv.add(beak)
    for (const s of [-1, 1]) { const e = new THREE.Mesh(G.eye, M.eye); e.position.set(0.045 * s, 0.02, 0.05); headPiv.add(e) }
    const wings = [-1, 1].map(s => {
      const piv = new THREE.Group(); piv.position.set(0.08 * s, 0.03, 0); g.add(piv)
      const w = new THREE.Mesh(G.wing, col); w.scale.set(1.2, 0.25, 0.9); w.position.set(0.07 * s, 0, -0.01); piv.add(w)
      return { piv, s }
    })
    const tail = new THREE.Mesh(G.tail, col); tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, 0.04, -0.15); g.add(tail)
    const hit = new THREE.Mesh(G.hit, M.hit); hit.position.y = 0.04; g.add(hit)
    return { g, headPiv, wings, hit }
  }

  function spawnBird() {
    // 작물이 자란 칸을 먼저 노린다
    const grown = plots.filter(p => p.plant.children.length), pool = grown.length ? grown : plots
    const taken = new Set(birds.filter(b => b.state !== 'out').map(b => b.plot))
    const free = pool.filter(p => !taken.has(p.i)); if (!free.length) return
    const p = free[Math.floor(Math.random() * free.length)]
    const b = makeBird(), id = ++birdId
    const a = rnd(0, Math.PI * 2)
    const from = new THREE.Vector3(Math.cos(a) * 6, rnd(2.6, 3.4), Math.sin(a) * 6)
    const to = new THREE.Vector3(p.x + rnd(-0.22, 0.22), 0.2, p.z + rnd(-0.22, 0.22))
    b.g.position.copy(from); island.add(b.g)
    pickable(b.hit, 'bird', { bird: id })
    birds.push({ ...b, id, plot: p.i, state: 'in', t: 0, from, to, dur: rnd(2.2, 3), peck: 0, chased: false, vel: new THREE.Vector3() })
  }

  function shoo(b) {
    if (b.state === 'out') return false
    b.state = 'out'; b.t = 0
    const away = b.g.position.clone().setY(0); if (away.lengthSq() < 0.01) away.set(1, 0, 0)
    b.vel.copy(away.setLength(3)).setY(2.4)
    return true
  }

  function removeBird(b) { unpick(b.hit); island.remove(b.g) }

  // ───────── 두더지 ─────────
  const MG = {
    hole: new THREE.CircleGeometry(0.2, 22), mound: new THREE.TorusGeometry(0.21, 0.06, 8, 26),
    body: new THREE.CapsuleGeometry(0.13, 0.16, 6, 14), snout: new THREE.SphereGeometry(0.045, 10, 8),
    eye: new THREE.SphereGeometry(0.018, 8, 6), paw: new THREE.SphereGeometry(0.04, 8, 6),
    hit: new THREE.CylinderGeometry(0.32, 0.32, 0.5, 14), star: new THREE.OctahedronGeometry(0.05, 0),
  }
  const MM = {
    hole: basic(0x3a2418), mound: mat(0x8a5b3e, { roughness: 0.95 }), body: mat(0x7a5a48), snout: mat(0xf2a3b3),
    paw: mat(0xf6d2c6), star: basic(0xffd84a, { transparent: true }),
  }
  const DOWN = -0.36, UP = 0.05
  const moles = HOLES.map(([x, z], i) => {
    const hole = new THREE.Mesh(MG.hole, MM.hole); hole.rotation.x = -Math.PI / 2; hole.position.set(x, 0.012, z); island.add(hole)
    const mound = new THREE.Mesh(MG.mound, MM.mound); mound.rotation.x = -Math.PI / 2; mound.scale.z = 0.6; mound.position.set(x, 0.02, z)
    mound.receiveShadow = true; island.add(mound)
    const g = new THREE.Group(); g.position.set(x, DOWN, z); island.add(g)
    const body = new THREE.Mesh(MG.body, MM.body); body.position.y = 0.16; body.castShadow = true; g.add(body)
    const face = new THREE.Group(); face.position.set(0, 0.25, 0); g.add(face)
    const snout = new THREE.Mesh(MG.snout, MM.snout); snout.position.set(0, -0.02, 0.13); face.add(snout)
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(G.eye, M.eye); e.scale.setScalar(1.3); e.position.set(0.05 * s, 0.04, 0.11); face.add(e)
      const paw = new THREE.Mesh(MG.paw, MM.paw); paw.scale.set(1.2, 0.6, 1); paw.position.set(0.1 * s, 0.1, 0.1); g.add(paw)
    }
    const hit = new THREE.Mesh(MG.hit, M.hit); hit.position.y = 0.2; hit.visible = true; g.add(hit)
    // 공중에 뜬 별(잡았을 때)
    const stars = Array.from({ length: 5 }, () => { const s = new THREE.Mesh(MG.star, MM.star.clone()); s.visible = false; island.add(s); return s })
    return { i, x, z, g, body, hit, stars, state: 'down', t: 0, up: 0, picked: false, bonk: 0 }
  })
  // 두더지 기억: 지금 하나만(가끔 둘) 올라온다
  let nextMole = rnd(2, 4), caught = 0

  function popMole() {
    const down = moles.filter(m => m.state === 'down'); if (!down.length) return
    const m = down[Math.floor(Math.random() * down.length)]
    m.state = 'rise'; m.t = 0; m.stay = rnd(1.2, 1.9); m.bonk = 0
    if (!m.picked) { pickable(m.hit, 'mole', { mole: m.i }); m.picked = true }
  }
  function moleDown(m) { m.state = 'fall'; m.t = 0 }

  // ───────── 지렁이 ─────────
  const WG = { seg: new THREE.SphereGeometry(0.035, 10, 8), hit: new THREE.SphereGeometry(0.16, 8, 6) }
  const WM = { a: mat(0xe8899a, { roughness: 0.4 }), b: mat(0xf0a3b0, { roughness: 0.4 }) }
  const SEGS = 7
  function wormSpot() {
    for (let k = 0; k < 20; k++) {
      const x = rnd(-2.5, 2.5), z = rnd(-2.5, 2.5)
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r || Math.hypot(x - SHED.x, z - SHED.z) < SHED.r) continue
      return [x, z]
    }
    return [0, 1.6]
  }
  const worms = Array.from({ length: 3 }, (_, i) => {
    const g = new THREE.Group(); island.add(g)
    const segs = Array.from({ length: SEGS }, (_, k) => {
      const m = new THREE.Mesh(WG.seg, k % 2 ? WM.a : WM.b); m.scale.setScalar(1 - k * 0.07); m.castShadow = true; g.add(m); return m
    })
    const hit = new THREE.Mesh(WG.hit, M.hit); g.add(hit)
    pickable(hit, 'worm', { worm: i })
    const [x, z] = wormSpot()
    const trail = Array.from({ length: SEGS * 4 }, () => new THREE.Vector3(x, 0.03, z))
    return { g, segs, hit, x, z, a: rnd(0, Math.PI * 2), trail, sink: 0, state: 'crawl', t: rnd(6, 14), wiggle: 0, ph: rnd(0, 6) }
  })

  // ───────── 매 프레임 ─────────
  const tmp = new THREE.Vector3()
  function update(dt, t, { night, raining, catPos }) {
    // 새
    if (!night && !raining) {
      nextBird -= dt
      if (nextBird <= 0) { nextBird = rnd(14, 28); if (birds.filter(b => b.state !== 'out').length < 2) spawnBird() }
    }
    const shooed = []
    for (const b of [...birds]) {
      b.t += dt
      const flap = reduce ? 0.3 : Math.sin(t * 28 + b.id) * 0.9
      if (b.state === 'in') {
        const k = Math.min(1, b.t / b.dur), e = 1 - Math.pow(1 - k, 2.2)
        b.g.position.lerpVectors(b.from, b.to, e); b.g.position.y += Math.sin(k * Math.PI) * 0.6
        tmp.copy(b.to).sub(b.from); b.g.rotation.y = Math.atan2(tmp.x, tmp.z)
        for (const w of b.wings) w.piv.rotation.z = flap * w.s
        if (k >= 1) { b.state = 'peck'; b.t = 0 }
      } else if (b.state === 'peck') {
        for (const w of b.wings) w.piv.rotation.z = 0.08 * w.s
        const pk = reduce ? 0 : Math.max(0, Math.sin(t * 9 + b.id * 2))
        b.headPiv.rotation.x = pk * 0.9; b.g.position.y = b.to.y + (reduce ? 0 : Math.abs(Math.sin(t * 2.5 + b.id)) * 0.015)
        if (Math.random() < dt * 0.3) b.g.rotation.y += rnd(-1, 1)
        // 냥이가 가까이 오면 놀라서 날아간다
        if (catPos && Math.hypot(catPos.x - b.g.position.x, catPos.z - b.g.position.z) < 0.5) { if (shoo(b)) shooed.push(b) }
        // 오래 둬도(냥이가 못 오면) 배부르면 간다
        if (b.t > 25) shoo(b)
      } else {
        b.vel.y += dt * 0.8
        b.g.position.addScaledVector(b.vel, dt)
        b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z)
        for (const w of b.wings) w.piv.rotation.z = (reduce ? 0.3 : Math.sin(t * 34 + b.id) * 1.1) * w.s
        b.headPiv.rotation.x = 0
        if (b.t > 3) { removeBird(b); birds.splice(birds.indexOf(b), 1) }
      }
    }

    // 두더지
    nextMole -= dt
    if (nextMole <= 0) { nextMole = rnd(1.6, 4.2); popMole(); if (Math.random() < 0.2) popMole() }
    for (const m of moles) {
      m.t += dt
      if (m.state === 'rise') { const k = Math.min(1, m.t / 0.2); m.g.position.y = DOWN + (UP - DOWN) * (1 - Math.pow(1 - k, 3)); if (k >= 1) { m.state = 'up'; m.t = 0 } }
      else if (m.state === 'up') {
        m.g.position.y = UP + (reduce ? 0 : Math.sin(t * 7 + m.i) * 0.012)
        m.g.rotation.y = reduce ? 0 : Math.sin(t * 2 + m.i) * 0.5
        if (m.t > m.stay) moleDown(m)
      } else if (m.state === 'bonk') {
        const k = Math.min(1, m.t / 0.5)
        m.body.scale.set(1 + 0.25 * (1 - k), 0.6 + 0.4 * k, 1 + 0.25 * (1 - k))
        m.g.position.y = UP - k * 0.1
        m.stars.forEach((s, j) => {
          s.visible = k < 1
          const a = j / m.stars.length * Math.PI * 2 + t * 4
          s.position.set(m.x + Math.cos(a) * 0.22, 0.5 + k * 0.25, m.z + Math.sin(a) * 0.22)
          s.rotation.y = t * 6; s.material.opacity = 1 - k
        })
        if (k >= 1) { m.body.scale.set(1, 1, 1); m.stars.forEach(s => { s.visible = false }); moleDown(m) }
      } else if (m.state === 'fall') {
        const k = Math.min(1, m.t / 0.22); m.g.position.y = UP + (DOWN - UP) * k * k
        if (k >= 1) { m.state = 'down'; m.t = 0; if (m.picked) { unpick(m.hit); m.picked = false } }
      }
    }

    // 지렁이
    for (const w of worms) {
      w.t -= dt; w.wiggle = Math.max(0, w.wiggle - dt)
      if (w.state === 'crawl') {
        const speed = 0.12 + w.wiggle * 0.25
        if (!reduce) w.a += Math.sin(t * 0.7 + w.ph) * dt * 1.2
        let nx = w.x + Math.sin(w.a) * speed * dt, nz = w.z + Math.cos(w.a) * speed * dt
        const bad = Math.abs(nx) > 2.65 || Math.abs(nz) > 2.65 || Math.hypot(nx - POND.x, nz - POND.z) < POND.r || Math.hypot(nx - SHED.x, nz - SHED.z) < SHED.r
        if (bad) { w.a += Math.PI * rnd(0.6, 1.4); nx = w.x; nz = w.z }
        w.x = nx; w.z = nz
        w.sink = Math.max(0, w.sink - dt * 1.5)
        if (w.t <= 0) { w.state = 'dig'; w.t = 0.8 }
      } else if (w.state === 'dig') {
        w.sink = Math.min(1, w.sink + dt * 1.6)
        if (w.t <= 0) {
          const [x, z] = wormSpot(); w.x = x; w.z = z; w.a = rnd(0, Math.PI * 2)
          for (const p of w.trail) p.set(x, 0.03, z)
          w.state = 'crawl'; w.t = rnd(8, 16)
        }
      }
      // 머리 자취를 따라 몸이 따라온다 + 꿈틀
      w.trail.pop(); w.trail.unshift(new THREE.Vector3(w.x, 0.03, w.z))
      const amp = (reduce ? 0 : 0.025) + w.wiggle * 0.05
      for (let k = 0; k < SEGS; k++) {
        const p = w.trail[Math.min(w.trail.length - 1, k * 3)]
        const off = Math.sin(t * 8 + w.ph - k * 0.9) * amp
        w.segs[k].position.set(p.x + Math.cos(w.a) * off, 0.03 + Math.max(0, Math.sin(t * 6 - k)) * 0.012 - w.sink * 0.1, p.z - Math.sin(w.a) * off)
      }
      w.hit.position.copy(w.segs[2].position)
      w.g.visible = w.sink < 0.98
    }
    return shooed
  }

  // 냥이가 쫓아야 할 새 — 앉아서 1초 넘게 쪼았거나, 학생이 누른 새
  function chaseTarget() {
    let best = null
    for (const b of birds) if (b.state === 'peck' && (b.chased || b.t > 1.2) && (!best || b.chased > best.chased)) best = b
    return best ? best.g.position : null
  }

  // 누름 — 장면이 부른다. 반환 = 페이지에 넘길 결과(없으면 null = 무시)
  function tap(kind, data) {
    if (kind === 'bird') {
      const b = birds.find(v => v.id === data.bird); if (!b) return null
      if (b.state === 'out') return null
      b.chased = true
      return { kind: 'bird', landed: b.state === 'peck' }
    }
    if (kind === 'mole') {
      const m = moles[data.mole]; if (!m || (m.state !== 'up' && m.state !== 'rise')) return null
      m.state = 'bonk'; m.t = 0; caught++
      window.JellySfx?.play('pop', { s: 0.8, pitch: 0.7 })
      return { kind: 'mole', caught }
    }
    if (kind === 'worm') { const w = worms[data.worm]; if (w) w.wiggle = 1.2; return { kind: 'worm' } }
    return null
  }

  return { update, chaseTarget, tap, _spawnBird: spawnBird, _popMole: popMole, _birds: birds, _state: () => ({ birds: birds.map(b => b.state), moles: moles.map(m => m.state) }) }
}
