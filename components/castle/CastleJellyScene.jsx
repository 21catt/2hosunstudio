'use client'
// Castle Jelly — 3D 메인 장면 (개발 중 · /castle 관리자 전용 미리보기)
//   1단계(2026-10-19): 젤리 블록·절벽·성·폭포·범선·시간대·불꽃놀이·누르면 들어가기 단추.
//   2단계(2026-10-19): 물결 = 얕은 물 높이장 계산(96×96, 고정 간격) · 수면 빛 굴절(transmission) ·
//     호수 바닥 빛 무늬(높이장 곡률로 매 프레임 계산) · 물보라 · 배 예포(포탄 → 물기둥) ·
//     소원 동전(폭포 아래 웅덩이로 던지면 젤리 속을 천천히 가라앉아 바닥에 쌓인다) ·
//     젤리 공 던지기(튀고 떠다닌다) · 블록 옆면을 끌어 기울이기(물이 출렁인다) · 소나무 끌어 휘기.
//
// 설계 규칙:
//  · 조절 값은 settingsRef 로 읽는다 — 슬라이더를 움직여도 장면을 다시 만들지 않는다.
//  · 물리는 고정 간격(1/60s) — 화면 주사율과 무관하게 같은 움직임.
//  · 탑·성문·배·화로를 누르면 onPick(종류, 화면 x, y) — 페이지가 그 자리에 「들어가기」 단추를 띄운다.
//  · 모든 계산은 블록 좌표계(block.worldToLocal) — 블록을 기울이거나 출렁여도 물·동전이 같이 간다.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export const FLAVOURS = {
  glacier: { lake: '#8fd3ea', deep: '#5fb3d6', label: '빙하' },
  rose:    { lake: '#f4b6cb', deep: '#e38aab', label: '로즈' },
  lilac:   { lake: '#cdbcf3', deep: '#a993e3', label: '라일락' },
}

const STRATA = [ // 위 → 아래 (호수 아래 블록 단면)
  { h: 0.35, c: '#f4a9c0' },
  { h: 0.30, c: '#fbe8c8' },
  { h: 0.35, c: '#c9b6ec' },
  { h: 0.25, c: '#b8e6d2' },
  { h: 0.30, c: '#e98aa8' },
]
const JELLY_TOP = 0.32 // 호수 물 층 두께(투명) — 그 아래가 호수 바닥
const FLOOR_Y = -JELLY_TOP
const HALF = 3
const PLATEAU = { x0: -HALF, x1: -0.4, z0: -HALF, z1: -0.3, top: 1.3 }
const N = 96            // 물 높이장 격자(정점과 1:1)
const CELL = (HALF * 2) / (N - 1)

function lerpColor(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t) }
function tri(t, a, b, c) { return t < 0.5 ? lerpColor(a, b, t * 2) : lerpColor(b, c, (t - 0.5) * 2) }
function triN(t, a, b, c) { return t < 0.5 ? a + (b - a) * t * 2 : b + (c - b) * (t - 0.5) * 2 }

export default function CastleJellyScene({ settingsRef, onPick, commandRef, onReady }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = () => mount.clientWidth, H = () => mount.clientHeight
    const narrow = () => W() < 760

    // ── 렌더러 · 카메라 ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    let pr = Math.min(1.5, window.devicePixelRatio || 1)
    renderer.setPixelRatio(pr)
    renderer.setSize(W(), H())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, W() / H(), 0.1, 100)
    const placeCamera = () => {
      const d = narrow() ? 26 : 18.5
      camera.position.set(d * 0.6, d * 0.5, d * 0.75)
      camera.lookAt(0, 0.5, 0)
    }
    placeCamera()
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.5, 0)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 10; controls.maxDistance = 30
    controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.25
    controls.update()

    // ── 빛 ───────────────────────────────────────────────────────
    const hemi = new THREE.HemisphereLight('#ffffff', '#d9c9ae', 1.1)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight('#ffffff', 2.2)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 })
    sun.shadow.bias = -0.0008
    scene.add(sun, sun.target)

    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0, ...o })
    const glossy = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.15 })
    const gold = new THREE.MeshStandardMaterial({ color: '#e7b84a', metalness: 0.85, roughness: 0.25 })
    const add = (m, x, y, z, parent) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }

    // ── 탁자 ─────────────────────────────────────────────────────
    const table = new THREE.Mesh(new THREE.CircleGeometry(16, 64), mat('#e2d7c4', { roughness: 0.9 }))
    table.rotation.x = -Math.PI / 2
    table.position.y = -2.0
    table.receiveShadow = true
    scene.add(table)

    // ── 젤리 블록 ────────────────────────────────────────────────
    const block = new THREE.Group()
    scene.add(block)
    let y = FLOOR_Y
    for (const st of STRATA) {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, st.h, HALF * 2), glossy(st.c)), 0, y - st.h / 2, 0, block)
      m.userData.pick = 'block'
      y -= st.h
    }
    // 호수 물 층(굴절되는 젤리)
    const jellyMat = new THREE.MeshPhysicalMaterial({
      // ⚠️ 굴절(transmission) 재질끼리는 서로가 안 보여 검게 나온다 — 굴절은 수면 하나만, 이 층은 반투명
      color: FLAVOURS.glacier.deep, roughness: 0.08, clearcoat: 1,
      transparent: true, opacity: 0.45, depthWrite: false,
    })
    const jellyBand = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, JELLY_TOP, HALF * 2), jellyMat)
    jellyBand.position.y = -JELLY_TOP / 2
    jellyBand.userData.pick = 'block'
    block.add(jellyBand)

    // 호수 바닥 빛 무늬(커스틱) — 높이장 곡률로 매 프레임 그린다
    const causticData = new Uint8Array(N * N * 4)
    const causticTex = new THREE.DataTexture(causticData, N, N, THREE.RGBAFormat)
    causticTex.magFilter = THREE.LinearFilter; causticTex.minFilter = THREE.LinearFilter
    causticTex.needsUpdate = true
    const caustic = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2),
      new THREE.MeshBasicMaterial({ map: causticTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    caustic.rotation.x = -Math.PI / 2
    caustic.position.y = FLOOR_Y + 0.004
    block.add(caustic)

    // 수면 — 정점 = 높이장 격자(N×N)
    const lakeGeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N - 1, N - 1)
    lakeGeo.rotateX(-Math.PI / 2) // 행 0 = z -3, 열 0 = x -3
    const lakeMat = new THREE.MeshPhysicalMaterial({
      color: FLAVOURS.glacier.lake, transmission: 0.55, thickness: 0.3, ior: 1.33, roughness: 0.04,
      clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
      emissive: FLAVOURS.glacier.lake, emissiveIntensity: 0.22,
    })
    const lake = new THREE.Mesh(lakeGeo, lakeMat)
    lake.receiveShadow = true
    lake.userData.pick = 'lake'
    block.add(lake)

    // ── 물 높이장 ────────────────────────────────────────────────
    const h = new Float32Array(N * N), v = new Float32Array(N * N)
    const solid = new Uint8Array(N * N)
    const gx = x => Math.round((x + HALF) / CELL), gz = z => Math.round((z + HALF) / CELL)
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = -HALF + c * CELL, z = -HALF + r * CELL
      if (x < PLATEAU.x1 && z < PLATEAU.z1) solid[r * N + c] = 1
    }
    const bump = (x, z, amt, rad = 2.5) => {
      const cc = gx(x), rr = gz(z), R = Math.ceil(rad * 1.6)
      for (let r = rr - R; r <= rr + R; r++) for (let c = cc - R; c <= cc + R; c++) {
        if (r < 1 || c < 1 || r >= N - 1 || c >= N - 1) continue
        const i = r * N + c
        if (solid[i]) continue
        const d2 = ((r - rr) ** 2 + (c - cc) ** 2) / (rad * rad)
        h[i] += amt * Math.exp(-d2)
      }
    }
    const sampleH = (x, z) => {
      const fc = Math.min(N - 1.001, Math.max(0, (x + HALF) / CELL)), fr = Math.min(N - 1.001, Math.max(0, (z + HALF) / CELL))
      const c = Math.floor(fc), r = Math.floor(fr), tx = fc - c, tz = fr - r
      const i = r * N + c
      return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - tz) + (h[i + N] * (1 - tx) + h[i + N + 1] * tx) * tz
    }
    const nb = (i, j) => (solid[j] ? h[i] : h[j])
    function simStep(damp) {
      for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) {
        const i = r * N + c
        if (solid[i]) continue
        const avg = (nb(i, i - 1) + nb(i, i + 1) + nb(i, i - N) + nb(i, i + N)) * 0.25
        v[i] = (v[i] + (avg - h[i]) * 0.9) * damp
      }
      for (let i = 0; i < N * N; i++) { if (!solid[i]) h[i] += v[i]; else h[i] = 0 }
      // 가장자리 = 블록 벽(반사)
      for (let k = 0; k < N; k++) {
        h[k] = h[k + N]; h[(N - 1) * N + k] = h[(N - 2) * N + k]
        h[k * N] = h[k * N + 1]; h[k * N + N - 1] = h[k * N + N - 2]
      }
    }

    // 젤리 속 물줄기 + 방울
    const plumeN = 280
    const plumeGeo = new THREE.BufferGeometry()
    const plumePos = new Float32Array(plumeN * 3).fill(-99)
    const plumeVel = new Float32Array(plumeN * 3)
    const plumeLife = new Float32Array(plumeN)
    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3))
    block.add(new THREE.Points(plumeGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.05, transparent: true, opacity: 0.75, depthWrite: false })))
    // 바닥을 따라 흐르는 물줄기 실(밝은 선)
    const threadN = 6
    const threads = []
    for (let k = 0; k < threadN; k++) {
      const g = new THREE.BufferGeometry()
      const pts = new Float32Array(24 * 3)
      g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }))
      block.add(line)
      threads.push({ g, pts, line, phase: k * 1.3, spread: (k - threadN / 2) * 0.13 })
    }

    // 물보라 · 물기둥(공용 입자)
    const sprayN = 500
    const sprayGeo = new THREE.BufferGeometry()
    const sprayPos = new Float32Array(sprayN * 3).fill(-99)
    const sprayVel = new Float32Array(sprayN * 3)
    const sprayLife = new Float32Array(sprayN)
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3))
    block.add(new THREE.Points(sprayGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.045, transparent: true, opacity: 0.8, depthWrite: false })))
    let sprayHead = 0
    const spray = (x, z, n, up = 1.6, spreadV = 0.6) => {
      for (let k = 0; k < n; k++) {
        const j = sprayHead++ % sprayN
        sprayPos[j * 3] = x + (Math.random() - 0.5) * 0.1; sprayPos[j * 3 + 1] = 0.02; sprayPos[j * 3 + 2] = z + (Math.random() - 0.5) * 0.1
        const a = Math.random() * Math.PI * 2, s = Math.random() * spreadV
        sprayVel[j * 3] = Math.cos(a) * s; sprayVel[j * 3 + 1] = up * (0.5 + Math.random() * 0.7); sprayVel[j * 3 + 2] = Math.sin(a) * s
        sprayLife[j] = 0.6 + Math.random() * 0.6
      }
    }

    // ── 절벽 고원 ────────────────────────────────────────────────
    const P = PLATEAU
    const pw = P.x1 - P.x0, pd = P.z1 - P.z0, pcx = (P.x0 + P.x1) / 2, pcz = (P.z0 + P.z1) / 2
    ;[
      { y0: -0.3, y1: 0.2, c: '#f4a9c0' }, { y0: 0.2, y1: 0.55, c: '#fbe8c8' },
      { y0: 0.55, y1: 0.85, c: '#c9b6ec' }, { y0: 0.85, y1: 1.12, c: '#e98aa8' },
      { y0: 1.12, y1: P.top, c: '#9fcf8f' },
    ].forEach(b => { add(new THREE.Mesh(new THREE.BoxGeometry(pw, b.y1 - b.y0, pd), glossy(b.c)), pcx, (b.y0 + b.y1) / 2, pcz, block).userData.pick = 'block' })
    ;[[-0.2, -0.9, 0.22], [-0.25, -0.15, 0.17], [-1.3, 0.0, 0.2], [-2.2, -0.05, 0.16]].forEach(([x, z, r]) =>
      add(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat('#e3b6c4')), x, 0.05, z, block))

    // 강 · 샘
    const riverZ = -0.7
    const water = new THREE.MeshPhysicalMaterial({ color: '#a8dcef', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 })
    add(new THREE.Mesh(new THREE.BoxGeometry(P.x1 - P.x0 - 0.2, 0.03, 0.28), water), (P.x0 + 0.2 + P.x1) / 2, P.top + 0.015, riverZ, block)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20), water), P.x0 + 0.3, P.top + 0.02, riverZ, block)

    // ── 성 ───────────────────────────────────────────────────────
    const castle = new THREE.Group()
    castle.position.set(-1.75, P.top, -1.95)
    block.add(castle)
    const cream = mat('#f6ead2'), cream2 = mat('#f3e4c8')
    const windowMat = new THREE.MeshStandardMaterial({ color: '#3b3550', emissive: '#ffcf7a', emissiveIntensity: 0 })
    const S = 0.9
    const wallH = 0.38
    ;[[0, -S, 2 * S, 0.12], [0, S, 2 * S, 0.12], [-S, 0, 0.12, 2 * S], [S, 0, 0.12, 2 * S]].forEach(([x, z, w, d]) => {
      add(new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), cream), x, wallH / 2, z, castle)
      for (let i = 0; i < 7; i++) {
        const t = -1 + (2 * i + 1) / 7
        add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.14), cream), w > d ? x + t * (w / 2) : x, wallH + 0.045, w > d ? z : z + t * (d / 2), castle)
      }
    })
    add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.62, 0.6), mat('#f9f0de')), -0.05, 0.31, -0.15, castle)
    const hallRoof = add(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.45, 4), glossy('#f08fb3')), -0.05, 0.84, -0.15, castle)
    hallRoof.rotation.y = Math.PI / 4; hallRoof.scale.set(1, 1, 0.75)
    const winGeo = new THREE.PlaneGeometry(0.09, 0.14)
    const addWin = (x, yy, z, parent) => { const w = new THREE.Mesh(winGeo, windowMat); w.position.set(x, yy, z); parent.add(w) }
    ;[-0.3, -0.05, 0.2].forEach(x => addWin(x, 0.38, 0.152, castle))
    const towers = []
    ;[
      [-S, S, 0.22, 0.95, '#ef8fb3'], [S, S, 0.22, 1.05, '#b49ae8'],
      [-S, -S, 0.2, 0.85, '#8fb8f0'], [S, -S, 0.2, 0.9, '#ef8fb3'],
      [0.25, -0.35, 0.17, 1.55, '#8fb8f0'],
    ].forEach(([x, z, r, ht, roof]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); castle.add(g)
      const body = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, ht, 24), cream2), 0, ht / 2, 0, g)
      const cone = add(new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, ht * 0.62, 24), glossy(roof)), 0, ht * 1.31, 0, g)
      add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), gold), 0, ht * 1.62 + 0.03, 0, g)
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1, 6, 1), new THREE.MeshStandardMaterial({ color: roof, side: THREE.DoubleSide }))
      flag.position.set(0.12, ht * 1.62 + 0.14, 0); g.add(flag)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), mat('#c99a35')); pole.position.set(0, ht * 1.62 + 0.12, 0); g.add(pole)
      addWin(0, ht * 0.6, r + 0.002, g)
      body.userData.pick = 'tower'; cone.userData.pick = 'tower'; body.userData.towerIdx = towers.length; cone.userData.towerIdx = towers.length
      towers.push({ g, flag, flagBase: flag.geometry.attributes.position.array.slice(), top: new THREE.Vector3(x, ht * 1.62, z), wob: 0, wobV: 0 })
    })
    const gate = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.06), mat('#5a4636')), 0, 0.16, S + 0.04, castle)
    gate.userData.pick = 'gate'
    const bridgeHinge = new THREE.Group(); bridgeHinge.position.set(0, 0.02, S + 0.07); castle.add(bridgeHinge)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.62), mat('#c79a6a')), 0, 0, 0.31, bridgeHinge).userData.pick = 'gate'
    const brazier = new THREE.Group(); brazier.position.set(0.55, 0, S + 0.35); castle.add(brazier)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.14, 12), mat('#6d5a4a')), 0, 0.07, 0, brazier).userData.pick = 'brazier'
    const flame = add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#ff9d4d', emissive: '#ff7a1a', emissiveIntensity: 1.5 })), 0, 0.2, 0, brazier)
    flame.castShadow = false; flame.userData.pick = 'brazier'
    const fireLight = new THREE.PointLight('#ffaa55', 0.6, 3, 1.6); fireLight.position.set(0, 0.35, 0); brazier.add(fireLight)

    // 냥밭 고양이 — 학생이 고른 농부냥이 성 마당에 나와 있다(누르면 냥밭)
    const catSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
    catSprite.scale.set(0.42, 0.54, 1)
    catSprite.position.set(-1.05, P.top + 0.27, -0.5)
    catSprite.userData.pick = 'cat'
    catSprite.visible = false
    block.add(catSprite)
    let catUrl = null
    const texLoader = new THREE.TextureLoader()
    const loadCat = url => {
      catUrl = url
      if (!url) { catSprite.visible = false; return }
      texLoader.load(url, tex => {
        if (catUrl !== url) { tex.dispose(); return }
        tex.colorSpace = THREE.SRGBColorSpace
        catSprite.material.map?.dispose()
        catSprite.material.map = tex; catSprite.material.needsUpdate = true
        const a = tex.image.width / tex.image.height
        catSprite.scale.set(0.54 * a, 0.54, 1)
        catSprite.visible = true
      })
    }
    let catHop = 0

    // 소나무(끌어서 휘기) · 꽃덤불 · 갈대
    const pines = []
    const pineMat = [mat('#5fae7a'), mat('#4f9d6c')]
    ;[[-2.75, -2.7], [-2.55, -0.55], [-0.65, -2.75], [-2.85, -1.4], [-0.7, -0.5]].forEach(([x, z], i) => {
      const ht = 0.45 + (i % 3) * 0.12
      const pivot = new THREE.Group(); pivot.position.set(x, P.top, z); block.add(pivot)
      const t = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, ht, 10), pineMat[i % 2]), 0, ht / 2, 0, pivot)
      t.userData.pick = 'pine'; t.userData.pineIdx = i
      pines.push({ pivot, bx: 0, bz: 0, vx: 0, vz: 0, held: false, i })
    })
    ;[[-2.2, -0.45, '#f7b6cf'], [-1.2, -0.4, '#fbd3e2'], [-0.85, -1.0, '#f7b6cf']].forEach(([x, z, c]) =>
      add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat(c)), x, P.top + 0.08, z, block))
    for (let i = 0; i < 14; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), mat('#7a9a52')), 2.2 + (i % 5) * 0.12, 0.12, -2.4 + Math.floor(i / 5) * 0.15, block).castShadow = false

    // ── 폭포 ─────────────────────────────────────────────────────
    const fallN = 900
    const fallGeo = new THREE.BufferGeometry()
    const fallPos = new Float32Array(fallN * 3), fallVel = new Float32Array(fallN * 3)
    fallGeo.setAttribute('position', new THREE.BufferAttribute(fallPos, 3))
    block.add(new THREE.Points(fallGeo, new THREE.PointsMaterial({ color: '#eaf8ff', size: 0.06, transparent: true, opacity: 0.85, depthWrite: false })))
    const lip = new THREE.Vector3(P.x1 + 0.02, P.top - 0.02, riverZ)
    const respawnFall = i => {
      fallPos[i * 3] = lip.x + Math.random() * 0.03
      fallPos[i * 3 + 1] = lip.y + Math.random() * 0.02
      fallPos[i * 3 + 2] = lip.z + (Math.random() - 0.5) * 0.26
      fallVel[i * 3] = 0.55 + Math.random() * 0.25; fallVel[i * 3 + 1] = -0.05; fallVel[i * 3 + 2] = (Math.random() - 0.5) * 0.08
    }
    for (let i = 0; i < fallN; i++) { respawnFall(i); fallPos[i * 3 + 1] -= Math.random() * P.top }
    const impact = new THREE.Vector3(lip.x + 0.42, 0, riverZ)
    const mist = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }))
    mist.position.set(impact.x, 0.1, impact.z); mist.scale.set(1, 0.45, 1); block.add(mist)

    // ── 범선 ─────────────────────────────────────────────────────
    const ship = new THREE.Group(); block.add(ship)
    const hullShape = new THREE.Shape()
    hullShape.moveTo(-0.32, 0.06); hullShape.lineTo(0.36, 0.06); hullShape.quadraticCurveTo(0.3, -0.08, 0.2, -0.1); hullShape.lineTo(-0.24, -0.1); hullShape.quadraticCurveTo(-0.32, -0.04, -0.32, 0.06)
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.16, bevelEnabled: false }), glossy('#4a78bf')), 0, 0.08, -0.08, ship).userData.pick = 'ship'
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), mat('#6d5a4a')), 0, 0.42, 0, ship)
    const sail = add(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.32, 4, 4), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide })), 0.02, 0.42, 0, ship)
    sail.rotation.y = Math.PI / 2; sail.userData.pick = 'ship'
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ color: '#e7b84a', side: THREE.DoubleSide })), 0.06, 0.72, 0, ship).rotation.y = Math.PI / 2
    const shipPath = { cx: 1.35, cz: 1.25, r: 1.05 }

    // ── 별 ───────────────────────────────────────────────────────
    const starN = 260
    const sp = new Float32Array(starN * 3)
    let seed = 20261019
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < starN; i++) {
      const th = rnd() * Math.PI * 2, ph = 0.15 + rnd() * 1.1, R = 34
      sp[i * 3] = R * Math.cos(th) * Math.cos(ph); sp[i * 3 + 1] = R * Math.sin(ph); sp[i * 3 + 2] = R * Math.sin(th) * Math.cos(ph)
    }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0, depthWrite: false })
    scene.add(new THREE.Points(starGeo, starMat))

    // ── 움직이는 것들: 불꽃놀이 · 포탄 · 연기 · 동전 · 공 ─────────
    const fireworks = []
    const FW_COLORS = ['#f4a9c0', '#b49ae8', '#8fb8f0', '#ffd27a', '#9be3c4']
    const fwLight = new THREE.PointLight('#ffffff', 0, 14, 1.5); scene.add(fwLight)
    function launch() {
      const tw = towers[Math.floor(Math.random() * towers.length)]
      const from = block.localToWorld(tw.top.clone().add(castle.position))
      const color = new THREE.Color(FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)])
      const n = 90
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) { pos[i * 3] = from.x; pos[i * 3 + 1] = from.y; pos[i * 3 + 2] = from.z }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }))
      scene.add(pts)
      fireworks.push({ pts, pos, vel, n, color, phase: 'rise', t: 0, y: from.y, apex: from.y + 2.2 + Math.random() * 1.2, from })
    }

    const shots = [] // 예포 포탄
    const smokes = []
    const ballMat = new THREE.MeshStandardMaterial({ color: '#3b3550', roughness: 0.4 })
    function salute() {
      const fwd = new THREE.Vector3(Math.cos(ship.rotation.y), 0, -Math.sin(ship.rotation.y)) // 배가 보는 쪽(+x 로컬)
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x)
      // 호수 가운데 쪽으로 쏜다
      const toCenter = new THREE.Vector3(0.6, 0, 0.4).sub(ship.position)
      if (side.dot(toCenter) < 0) side.negate()
      for (let k = 0; k < 2; k++) {
        const o = ship.position.clone().add(fwd.clone().multiplyScalar(k ? 0.12 : -0.1)).add(new THREE.Vector3(0, 0.14, 0))
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), ballMat); m.position.copy(o); block.add(m)
        const vel = side.clone().multiplyScalar(1.6 + Math.random() * 0.4).add(new THREE.Vector3(0, 1.4, 0))
        setTimeout(() => shots.push({ m, vel }), k * 220)
        const sm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#f2efe9', transparent: true, opacity: 0.85, depthWrite: false }))
        sm.position.copy(o).add(side.clone().multiplyScalar(0.12)); block.add(sm)
        smokes.push({ m: sm, t: -k * 0.22 })
      }
      jiggleV += 0.15
    }

    const coins = []
    const coinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20)
    const camLocal = () => block.worldToLocal(camera.position.clone())
    function throwCoin() {
      const from = camLocal().lerp(new THREE.Vector3(0, 0.5, 0), 0.55)
      const target = new THREE.Vector3(impact.x + 0.15 + (Math.random() - 0.3) * 0.5, 0, impact.z + 0.25 + (Math.random() - 0.5) * 0.5)
      const T = 0.9
      const vel = target.clone().sub(from).divideScalar(T); vel.y += 0.5 * 6.5 * T
      const m = new THREE.Mesh(coinGeo, gold); m.position.copy(from); m.castShadow = true; block.add(m)
      coins.push({ m, vel, state: 'air', spin: 6 + Math.random() * 6, t: 0 })
      if (coins.length > 40) { const old = coins.shift(); block.remove(old.m) }
    }

    const balls = []
    const BALL_COLORS = ['#f4a9c0', '#b49ae8', '#8fb8f0', '#ffd27a', '#9be3c4']
    function throwBall() {
      const from = camLocal().lerp(new THREE.Vector3(0, 0.5, 0), 0.5)
      const target = new THREE.Vector3(0.3 + Math.random() * 1.8, 0, -0.1 + Math.random() * 2.3)
      const T = 1.0
      const vel = target.clone().sub(from).divideScalar(T); vel.y += 0.5 * 6.5 * T
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshPhysicalMaterial({ color: BALL_COLORS[balls.length % 5], roughness: 0.2, clearcoat: 1, transmission: 0.35, thickness: 0.2 }))
      m.position.copy(from); m.castShadow = true; block.add(m)
      balls.push({ m, vel })
      if (balls.length > 6) { const old = balls.shift(); block.remove(old.m) }
    }

    // ── 누르기 · 끌기 ─────────────────────────────────────────────
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let mode = null, lastRipple = 0, downAt = null, tiltStart = null, heldPine = null
    let tiltX = 0, tiltZ = 0, tiltVX = 0, tiltVZ = 0, tiltTX = 0, tiltTZ = 0
    let jiggle = 0, jiggleV = 0
    const pickAt = (cx, cy) => {
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      for (const hit of ray.intersectObjects(block.children, true)) {
        let o = hit.object
        while (o && !o.userData.pick && o.parent) o = o.parent
        if (o?.userData.pick) return { kind: o.userData.pick, point: hit.point, obj: o }
      }
      return null
    }
    const onDown = e => {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
      const hit = pickAt(e.clientX, e.clientY)
      if (hit?.kind === 'lake') {
        mode = 'lake'; controls.enabled = false
        const p = block.worldToLocal(hit.point.clone()); bump(p.x, p.z, -0.05)
      } else if (hit?.kind === 'block') {
        mode = 'tilt'; controls.enabled = false; tiltStart = { x: e.clientX, y: e.clientY }
      } else if (hit?.kind === 'pine') {
        mode = 'pine'; controls.enabled = false; heldPine = pines[hit.obj.userData.pineIdx]; heldPine.held = true
        tiltStart = { x: e.clientX, y: e.clientY }
      }
    }
    const onMove = e => {
      if (mode === 'lake') {
        const now = performance.now()
        if (now - lastRipple < 40) return
        lastRipple = now
        const hit = pickAt(e.clientX, e.clientY)
        if (hit?.kind === 'lake') { const p = block.worldToLocal(hit.point.clone()); bump(p.x, p.z, -0.035, 2) }
      } else if (mode === 'tilt') {
        tiltTZ = Math.max(-0.22, Math.min(0.22, -(e.clientX - tiltStart.x) / 900))
        tiltTX = Math.max(-0.22, Math.min(0.22, (e.clientY - tiltStart.y) / 900))
      } else if (mode === 'pine' && heldPine) {
        heldPine.bz = Math.max(-0.7, Math.min(0.7, -(e.clientX - tiltStart.x) / 180))
        heldPine.bx = Math.max(-0.7, Math.min(0.7, (e.clientY - tiltStart.y) / 180))
      }
    }
    const onUp = e => {
      const was = mode
      mode = null; controls.enabled = true
      tiltTX = 0; tiltTZ = 0
      if (heldPine) { heldPine.held = false; heldPine = null }
      if (!downAt) return
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
      const quick = performance.now() - downAt.t < 450
      downAt = null
      if (was === 'lake' || moved > 6 || !quick) return
      const hit = pickAt(e.clientX, e.clientY)
      if (!hit || hit.kind === 'lake' || hit.kind === 'block' || hit.kind === 'pine') return
      jiggleV += 0.5
      if (hit.kind === 'tower') { const tw = towers[hit.obj.userData.towerIdx]; if (tw) tw.wobV += 3 }
      if (hit.kind === 'brazier') fireLight.intensity = 2.4
      if (hit.kind === 'ship') bump(ship.position.x, ship.position.z, -0.06)
      if (hit.kind === 'cat') catHop = 1
      const rect = renderer.domElement.getBoundingClientRect()
      onPick?.(hit.kind, e.clientX - rect.left, e.clientY - rect.top)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    let bridgeUp = false
    if (commandRef) commandRef.current = {
      fireworks: () => { for (let i = 0; i < 3; i++) setTimeout(launch, i * 260) },
      toggleBridge: () => { bridgeUp = !bridgeUp; return bridgeUp },
      tip: () => { tiltVZ += 1.4; jiggleV += 0.8 },
      salute,
      coin: () => { for (let i = 0; i < 3; i++) setTimeout(throwCoin, i * 140) },
      ball: throwBall,
    }
    // 개발 확인용(배포 빌드엔 없음)
    if (process.env.NODE_ENV === 'development') window.__castle = { cmd: commandRef?.current, counts: () => ({ coins: coins.length, balls: balls.length, shots: shots.length, restCoins: coins.filter(c => c.state === 'rest').length, ballY: balls.map(b => +b.m.position.y.toFixed(2)), quality, pr }) }

    const ro = new ResizeObserver(() => {
      renderer.setSize(W(), H())
      camera.aspect = W() / H(); camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    // ── 고정 간격 물리 ───────────────────────────────────────────
    const STEP = 1 / 60
    let acc = 0, last = performance.now(), time = 0, raf = 0, nextAutoFw = 0
    // 자동 품질: 처음 몇 초의 프레임 속도를 보고 느리면 한 단계씩 내린다(해상도 → 굴절 → 그림자)
    let fpsFrames = 0, fpsT0 = 0, quality = 3
    let flavourNow = null

    function stepPhysics(dt) {
      const st = settingsRef.current
      const firm = st.firmness, flow = st.flow, dampS = st.damping ?? 0.5
      time += dt
      // 블록 출렁 · 기울기 스프링(단단할수록 빠르고 덜 흔들린다)
      const k = 40 + firm * 160, c = 3 + firm * 9
      jiggleV += (-k * jiggle - c * jiggleV) * dt; jiggle += jiggleV * dt
      const tk = 30 + firm * 60, tc = 4 + firm * 6
      const prevTX = tiltX, prevTZ = tiltZ
      tiltVX += (-(tiltX - tiltTX) * tk - tiltVX * tc) * dt; tiltX += tiltVX * dt
      tiltVZ += (-(tiltZ - tiltTZ) * tk - tiltVZ * tc) * dt; tiltZ += tiltVZ * dt
      // 기울어지는 만큼 물이 한쪽으로 몰린다
      const dX = tiltX - prevTX, dZ = tiltZ - prevTZ
      if (Math.abs(dX) + Math.abs(dZ) > 1e-5) {
        for (let r = 1; r < N - 1; r++) for (let cc = 1; cc < N - 1; cc++) {
          const i = r * N + cc
          if (solid[i]) continue
          const x = -HALF + cc * CELL, z = -HALF + r * CELL
          v[i] += (dZ * x - dX * z) * 0.06
        }
      }
      // 물 높이장
      const damp = 0.996 - dampS * 0.03
      // 폭포가 두드리는 자리 — 흐름에 비례
      bump(impact.x + (Math.random() - 0.5) * 0.1, impact.z + (Math.random() - 0.5) * 0.15, -(0.004 + flow * 0.014) * (0.6 + Math.random() * 0.8), 1.6)
      if (Math.random() < flow * 0.5) spray(impact.x, impact.z, 2, 1.2 + flow, 0.5)
      // 범선 뱃전 물결
      if (Math.random() < 0.25) bump(ship.position.x, ship.position.z, -0.006, 1.5)
      simStep(damp)
      // 폭포 입자
      const active = Math.floor(fallN * (0.15 + flow * 0.85))
      for (let i = 0; i < fallN; i++) {
        if (i >= active) { fallPos[i * 3 + 1] = -99; continue }
        if (fallPos[i * 3 + 1] < -50) { respawnFall(i); continue }
        fallVel[i * 3 + 1] -= 6.5 * dt
        fallPos[i * 3] += fallVel[i * 3] * dt; fallPos[i * 3 + 1] += fallVel[i * 3 + 1] * dt; fallPos[i * 3 + 2] += fallVel[i * 3 + 2] * dt
        if (fallPos[i * 3 + 1] < 0.02) {
          if (Math.random() < 0.12 * (0.3 + flow)) {
            const j = Math.floor(Math.random() * plumeN)
            plumePos[j * 3] = fallPos[i * 3]; plumePos[j * 3 + 1] = -0.02; plumePos[j * 3 + 2] = fallPos[i * 3 + 2]
            plumeVel[j * 3] = 0.25 + Math.random() * 0.35; plumeVel[j * 3 + 1] = -0.3 - Math.random() * 0.2; plumeVel[j * 3 + 2] = (Math.random() - 0.5) * 0.3
            plumeLife[j] = 1.8 + Math.random()
          }
          respawnFall(i)
        }
      }
      for (let j = 0; j < plumeN; j++) {
        if (plumeLife[j] <= 0) { plumePos[j * 3 + 1] = -99; continue }
        plumeLife[j] -= dt
        plumeVel[j * 3 + 1] += 0.34 * dt
        plumeVel[j * 3] *= 0.995
        plumePos[j * 3] += plumeVel[j * 3] * dt
        plumePos[j * 3 + 1] = Math.min(-0.02, Math.max(FLOOR_Y + 0.02, plumePos[j * 3 + 1] + plumeVel[j * 3 + 1] * dt))
        plumePos[j * 3 + 2] += plumeVel[j * 3 + 2] * dt
        if (Math.abs(plumePos[j * 3]) > HALF - 0.05 || Math.abs(plumePos[j * 3 + 2]) > HALF - 0.05) plumeLife[j] = 0
      }
      for (let j = 0; j < sprayN; j++) {
        if (sprayLife[j] <= 0) continue
        sprayLife[j] -= dt
        sprayVel[j * 3 + 1] -= 4.5 * dt
        sprayPos[j * 3] += sprayVel[j * 3] * dt; sprayPos[j * 3 + 1] += sprayVel[j * 3 + 1] * dt; sprayPos[j * 3 + 2] += sprayVel[j * 3 + 2] * dt
        if (sprayLife[j] <= 0 || sprayPos[j * 3 + 1] < 0) { sprayLife[j] = 0; sprayPos[j * 3 + 1] = -99 }
      }
      // 범선
      const sa = time * (st.reducedMotion ? 0.08 : 0.18)
      const sx = shipPath.cx + Math.cos(sa) * shipPath.r, sz = shipPath.cz + Math.sin(sa) * shipPath.r
      ship.position.set(sx, sampleH(sx, sz), sz)
      ship.rotation.y = -sa
      ship.rotation.z = Math.sin(time * 1.6) * 0.05 + (sampleH(sx + 0.15, sz) - sampleH(sx - 0.15, sz)) * 2
      // 포탄 → 물기둥
      for (let s2 = shots.length - 1; s2 >= 0; s2--) {
        const sh = shots[s2]
        sh.vel.y -= 6.5 * dt
        sh.m.position.addScaledVector(sh.vel, dt)
        if (sh.m.position.y < 0) {
          const { x, z } = sh.m.position
          if (Math.abs(x) < HALF && Math.abs(z) < HALF && !(x < P.x1 && z < P.z1)) { bump(x, z, -0.09, 2.5); spray(x, z, 40, 2.4, 0.5) }
          block.remove(sh.m); shots.splice(s2, 1)
        }
      }
      for (let s2 = smokes.length - 1; s2 >= 0; s2--) {
        const sm = smokes[s2]
        sm.t += dt
        if (sm.t < 0) { sm.m.visible = false; continue }
        sm.m.visible = true
        sm.m.scale.setScalar(1 + sm.t * 4); sm.m.position.y += dt * 0.25
        sm.m.material.opacity = Math.max(0, 0.85 - sm.t * 0.7)
        if (sm.t > 1.3) { block.remove(sm.m); sm.m.material.dispose(); smokes.splice(s2, 1) }
      }
      // 동전: 날아가서 → 수면에서 퐁 → 젤리 속을 흔들리며 가라앉아 → 바닥에 쌓인다
      for (const cn of coins) {
        cn.t += dt
        if (cn.state === 'air') {
          cn.vel.y -= 6.5 * dt
          cn.m.position.addScaledVector(cn.vel, dt)
          cn.m.rotation.x += cn.spin * dt
          if (cn.m.position.y < 0) { cn.state = 'water'; bump(cn.m.position.x, cn.m.position.z, -0.03, 1.5); spray(cn.m.position.x, cn.m.position.z, 8, 1.2, 0.3) }
        } else if (cn.state === 'water') {
          cn.m.position.y -= 0.22 * dt
          cn.m.position.x += Math.sin(cn.t * 5 + cn.spin) * 0.08 * dt
          cn.m.rotation.x += Math.sin(cn.t * 3) * dt * 2
          if (cn.m.position.y <= FLOOR_Y + 0.008) { cn.state = 'rest'; cn.m.position.y = FLOOR_Y + 0.008; cn.m.rotation.set(0, cn.spin, 0) }
        }
      }
      // 젤리 공: 튀고 → 떠다니고 → 벽·절벽에 부딪힌다
      for (const b of balls) {
        const p = b.m.position
        b.vel.y -= 6.5 * dt
        const water = sampleH(p.x, p.z)
        if (p.y - 0.11 < water) {
          const sub = Math.min(0.22, water - (p.y - 0.11))
          b.vel.y += sub * 90 * dt
          b.vel.multiplyScalar(0.985)
          if (b.vel.y < -1.2) { bump(p.x, p.z, -0.06, 2); spray(p.x, p.z, 14, 1.4, 0.4); jiggleV += 0.2 }
          if (Math.random() < 0.05) bump(p.x, p.z, -0.004, 1.2)
        }
        p.addScaledVector(b.vel, dt)
        const lim = HALF - 0.12
        if (p.x > lim) { p.x = lim; b.vel.x *= -0.6 } if (p.x < -lim) { p.x = -lim; b.vel.x *= -0.6 }
        if (p.z > lim) { p.z = lim; b.vel.z *= -0.6 } if (p.z < -lim) { p.z = -lim; b.vel.z *= -0.6 }
        if (p.y < 0.6 && p.x < P.x1 + 0.11 && p.z < P.z1 + 0.11) { // 절벽 벽
          if (P.x1 + 0.11 - p.x < P.z1 + 0.11 - p.z) { p.x = P.x1 + 0.11; b.vel.x = Math.abs(b.vel.x) * 0.6 } else { p.z = P.z1 + 0.11; b.vel.z = Math.abs(b.vel.z) * 0.6 }
        }
        b.m.rotation.x += b.vel.z * dt * 4; b.m.rotation.z -= b.vel.x * dt * 4
      }
      // 소나무 스프링
      for (const pn of pines) {
        if (!pn.held) {
          pn.vx += (-pn.bx * 60 - pn.vx * 5) * dt; pn.bx += pn.vx * dt
          pn.vz += (-pn.bz * 60 - pn.vz * 5) * dt; pn.bz += pn.vz * dt
        }
      }
      // 탑 흔들림
      for (const tw of towers) { tw.wobV += (-tw.wob * 120 - tw.wobV * 8) * dt; tw.wob += tw.wobV * dt }
      // 도개교
      const want = bridgeUp ? -1.25 : 0
      bridgeHinge.rotation.x += (want - bridgeHinge.rotation.x) * Math.min(1, dt * 3)
      // 불꽃놀이
      for (let f = fireworks.length - 1; f >= 0; f--) {
        const fw = fireworks[f]
        fw.t += dt
        if (fw.phase === 'rise') {
          fw.y += 4.2 * dt
          for (let i = 0; i < fw.n; i++) fw.pos[i * 3 + 1] = fw.y
          if (fw.y >= fw.apex) {
            fw.phase = 'burst'; fw.t = 0
            for (let i = 0; i < fw.n; i++) {
              const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s2 = 1.4 + Math.random() * 0.6, rr = Math.sqrt(1 - u * u)
              fw.vel[i * 3] = rr * Math.cos(th) * s2; fw.vel[i * 3 + 1] = u * s2; fw.vel[i * 3 + 2] = rr * Math.sin(th) * s2
            }
            fwLight.color.copy(fw.color); fwLight.position.set(fw.from.x, fw.y, fw.from.z); fwLight.intensity = 6
          }
        } else {
          for (let i = 0; i < fw.n; i++) {
            fw.vel[i * 3 + 1] -= 1.2 * dt
            fw.vel[i * 3] *= 0.985; fw.vel[i * 3 + 1] *= 0.985; fw.vel[i * 3 + 2] *= 0.985
            fw.pos[i * 3] += fw.vel[i * 3] * dt; fw.pos[i * 3 + 1] += fw.vel[i * 3 + 1] * dt; fw.pos[i * 3 + 2] += fw.vel[i * 3 + 2] * dt
          }
          fw.pts.material.opacity = Math.max(0, 1 - fw.t / 1.6)
          if (fw.t > 1.7) { scene.remove(fw.pts); fw.pts.geometry.dispose(); fw.pts.material.dispose(); fireworks.splice(f, 1) }
        }
        fw.pts.geometry.attributes.position.needsUpdate = true
      }
      fwLight.intensity *= Math.pow(0.04, dt)
      fireLight.intensity += (0.6 + Math.sin(time * 11) * 0.12 - fireLight.intensity) * Math.min(1, dt * 2)
    }

    // ── 그리기용 갱신 ────────────────────────────────────────────
    function updateWaterVisuals(night) {
      const arr = lakeGeo.attributes.position.array
      for (let i = 0, p = 0; i < N * N; i++, p += 3) arr[p + 1] = solid[i] ? -0.06 : h[i]
      lakeGeo.attributes.position.needsUpdate = true
      lakeGeo.computeVertexNormals()
      // 바닥 빛 무늬: 볼록(빛이 모임) = 밝게 + 잔잔할 때도 흐르는 무늬
      const base = night ? 0.25 : 1
      for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) {
        const i = r * N + c, o = (((N - 1 - r) * N) + c) * 4 // 텍스처 행은 아래 → 위
        if (solid[i]) { causticData[o + 3] = 0; continue }
        const lap = h[i - 1] + h[i + 1] + h[i - N] + h[i + N] - 4 * h[i]
        const x = c * 0.31, z = r * 0.27
        const amb = Math.max(0, Math.sin(x + time * 1.1) * Math.sin(z - time * 0.9) + Math.sin((x + z) * 0.7 + time * 1.4) * 0.6) * 0.35
        const I = Math.max(0, Math.min(1, -lap * 55 + amb)) * base
        causticData[o] = 255; causticData[o + 1] = 255; causticData[o + 2] = 255
        causticData[o + 3] = Math.round(I * 150)
      }
      causticTex.needsUpdate = true
      // 물줄기 실: 폭포 아래에서 바닥을 따라 퍼져 나간다
      for (const th of threads) {
        for (let k = 0; k < 24; k++) {
          const s = k / 23
          const x = impact.x + s * 2.4
          const z = impact.z + s * 1.4 + th.spread * (0.4 + s * 3) + Math.sin(s * 6 + time * 1.6 + th.phase) * 0.08
          th.pts[k * 3] = Math.min(HALF - 0.05, x); th.pts[k * 3 + 1] = FLOOR_Y + 0.02 + Math.sin(s * 9 + time * 3 + th.phase) * 0.008; th.pts[k * 3 + 2] = Math.min(HALF - 0.05, z)
        }
        th.g.attributes.position.needsUpdate = true
        th.g.setDrawRange(0, 24)
        th.line.material.opacity = 0.15 + settingsRef.current.flow * 0.4
      }
    }

    function applyLook() {
      const st = settingsRef.current
      const t = st.timeOfDay
      const ang = triN(t, 1.05, 0.28, -0.25)
      sun.position.set(Math.cos(ang) * 8 + 2, Math.sin(ang) * 10 + 1, 5)
      sun.color.copy(tri(t, '#ffffff', '#ffb27a', '#8ea0ff'))
      sun.intensity = triN(t, 2.2, 1.4, 0.25)
      hemi.color.copy(tri(t, '#ffffff', '#ffd2b0', '#3a3f7a'))
      hemi.groundColor.copy(tri(t, '#d9c9ae', '#c7a58e', '#1c1a2c'))
      hemi.intensity = triN(t, 1.1, 0.8, 0.35)
      starMat.opacity = Math.max(0, (t - 0.6) / 0.4)
      windowMat.emissiveIntensity = Math.max(0, (t - 0.35) / 0.65) * 1.6
      if (flavourNow !== st.flavour) {
        flavourNow = st.flavour
        const f = FLAVOURS[st.flavour] || FLAVOURS.glacier
        lakeMat.color.set(f.lake); lakeMat.emissive.set(f.lake)
        jellyMat.color.set(f.deep)
      }
      if (t > 0.8 && !st.reducedMotion && time > nextAutoFw) { launch(); nextAutoFw = time + 2 + Math.random() * 2 }
      if ((st.catImg || null) !== catUrl) loadCat(st.catImg || null)
      return t > 0.7
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      if (document.hidden) { last = now; return }
      const dtReal = (now - last) / 1000
      acc += Math.min(0.25, dtReal)
      last = now
      let steps = 0
      while (acc >= STEP && steps < 12) { stepPhysics(STEP); acc -= STEP; steps++ }
      if (steps >= 12) acc = 0
      if (!fpsT0) fpsT0 = now
      fpsFrames++
      if (now - fpsT0 > 1500 && quality > 0) {
        const fps = fpsFrames / ((now - fpsT0) / 1000)
        if (fps < 42) {
          quality--
          if (quality === 2) { pr = 1; renderer.setPixelRatio(pr); renderer.setSize(W(), H()) }
          if (quality === 1) { lakeMat.transmission = 0; lakeMat.opacity = 0.8; lakeMat.needsUpdate = true }
          if (quality === 0) { renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true }) }) }
        } else quality = 0 // 충분히 빠르면 그대로 둔다
        fpsFrames = 0; fpsT0 = now
      }
      const night = applyLook()
      updateWaterVisuals(night)
      fallGeo.attributes.position.needsUpdate = true
      plumeGeo.attributes.position.needsUpdate = true
      sprayGeo.attributes.position.needsUpdate = true
      for (const tw of towers) {
        const a = tw.flag.geometry.attributes.position.array
        for (let i = 0; i < a.length; i += 3) a[i + 2] = Math.sin(tw.flagBase[i] * 22 + time * 6) * 0.02 * (tw.flagBase[i] + 0.11) * 8
        tw.flag.geometry.attributes.position.needsUpdate = true
        tw.g.rotation.z = tw.wob * 0.05; tw.g.scale.y = 1 + tw.wob * 0.03
      }
      for (const pn of pines) { pn.pivot.rotation.x = pn.bx + Math.sin(time * 1.3 + pn.i) * 0.03; pn.pivot.rotation.z = pn.bz + jiggle * 0.08 }
      block.rotation.x = tiltX; block.rotation.z = tiltZ
      block.scale.set(1 - jiggle * 0.03, 1 + jiggle * 0.06, 1 - jiggle * 0.03)
      flame.scale.y = 1 + Math.sin(time * 14) * 0.15
      // 고양이: 숨 쉬듯 살짝 · 누르면 폴짝
      catHop = Math.max(0, catHop - 0.045)
      catSprite.position.y = P.top + 0.27 + Math.sin(time * 2.2) * 0.008 + Math.sin(catHop * Math.PI) * 0.25
      mist.material.opacity = 0.15 + settingsRef.current.flow * 0.3
      controls.update()
      renderer.render(scene, camera)
    }
    let disposed = false
    const start = () => { if (disposed) return; raf = requestAnimationFrame(t => { frame(t); onReady?.() }) }
    // 셰이더를 미리 컴파일한다 — 첫 프레임에서 몇 초씩 멈추던 것(굴절·그림자 재질)을 로딩 화면 뒤로 숨긴다
    if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(start, start)
    else start()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose()) })
      causticTex.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      if (commandRef) commandRef.current = null
    }
  }, [])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
}
