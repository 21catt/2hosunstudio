'use client'
// Castle Jelly — 3D 메인 1단계 장면 (2026-10-19, 개발 중 · /castle 관리자 전용 미리보기)
//
// 탁자 위 정사각 젤리 호수 블록(단면 = 사탕 줄무늬) + 왼쪽 뒤 줄무늬 절벽 고원 + 크림색 성 +
// 샘 → 강 → 폭포 → 호수(호수 속 물줄기·거품) + 호수를 도는 작은 범선.
// 시간대(낮 → 노을 → 밤, 밤엔 별·창불·자동 불꽃놀이) · 폭포 세기 · 젤리 단단함 · 맛(빙하/로즈/라일락).
//
// 설계 규칙:
//  · 조절 값은 settingsRef 로 읽는다 — 슬라이더를 움직여도 장면을 다시 만들지 않는다(리액트 렌더 0).
//  · 물리는 고정 간격(1/60s) — 화면 주사율과 무관하게 같은 움직임.
//  · 탑·성문·배·화로를 누르면 onPick(종류, 화면 x, y) — 페이지가 그 자리에 「들어가기」 단추를 띄운다
//    (누르자마자 이동하면 장난치다 화면이 바뀐다).
//  · WebGL(three.js). WebGPU 전용 기능(굴절·커스틱)은 다음 단계 — 여기선 반투명·반사광으로 흉내만.

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
const JELLY_TOP = 0.32 // 호수 물 층 두께(투명)
const HALF = 3          // 블록 반 폭
const PLATEAU = { x0: -HALF, x1: -0.4, z0: -HALF, z1: -0.3, top: 1.3 }

function lerpColor(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t) }
function tri(t, a, b, c) { return t < 0.5 ? lerpColor(a, b, t * 2) : lerpColor(b, c, (t - 0.5) * 2) }
function triN(t, a, b, c) { return t < 0.5 ? a + (b - a) * t * 2 : b + (c - b) * (t - 0.5) * 2 }

export default function CastleJellyScene({ settingsRef, onPick, commandRef }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = () => mount.clientWidth, H = () => mount.clientHeight

    // ── 렌더러 · 카메라 ──────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(W(), H())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, W() / H(), 0.1, 100)
    const narrow = () => W() < 760
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

    // ── 재질 도우미 ─────────────────────────────────────────────
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0, ...o })
    const glossy = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.15 })
    const add = (m, x, y, z, parent = scene) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }

    // ── 탁자 ─────────────────────────────────────────────────────
    const table = new THREE.Mesh(new THREE.CircleGeometry(16, 64), mat('#e2d7c4', { roughness: 0.9 }))
    table.rotation.x = -Math.PI / 2
    table.position.y = -2.0
    table.receiveShadow = true
    scene.add(table)

    // ── 젤리 블록 (단면 줄무늬) ──────────────────────────────────
    const block = new THREE.Group() // 단단함 흔들림을 이 묶음째 준다
    scene.add(block)
    let y = -JELLY_TOP
    for (const s of STRATA) {
      add(new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, s.h, HALF * 2), glossy(s.c)), 0, y - s.h / 2, 0, block)
      y -= s.h
    }
    const blockBottom = y
    // 호수 물 층(투명) — 단면 위쪽 띠
    const jellyMat = new THREE.MeshPhysicalMaterial({
      color: FLAVOURS.glacier.lake, transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1,
      transmission: 0, depthWrite: false,
    })
    const jellyBand = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, JELLY_TOP, HALF * 2), jellyMat)
    jellyBand.position.y = -JELLY_TOP / 2
    block.add(jellyBand)

    // 호수 수면 — 높이장
    const SEG = 64
    const lakeGeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG)
    lakeGeo.rotateX(-Math.PI / 2)
    const lakeMat = new THREE.MeshPhysicalMaterial({
      color: FLAVOURS.glacier.lake, transparent: true, opacity: 0.82, roughness: 0.06, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide,
      emissive: FLAVOURS.glacier.lake, emissiveIntensity: 0.18, // 그늘에서도 젤리 빛이 남게
    })
    const lake = new THREE.Mesh(lakeGeo, lakeMat)
    lake.receiveShadow = true
    lake.userData.pick = 'lake'
    block.add(lake)
    const lakeBase = lakeGeo.attributes.position.array.slice()

    // 호수 속 물줄기(폭포가 젤리 속으로 이어진다) + 거품 방울
    const plumeN = 260
    const plumeGeo = new THREE.BufferGeometry()
    const plumePos = new Float32Array(plumeN * 3)
    const plumeVel = new Float32Array(plumeN * 3)
    const plumeLife = new Float32Array(plumeN)
    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3))
    const plume = new THREE.Points(plumeGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.05, transparent: true, opacity: 0.75, depthWrite: false }))
    block.add(plume)

    // ── 절벽 고원 (줄무늬 바위 + 이끼) ───────────────────────────
    const P = PLATEAU
    const pw = P.x1 - P.x0, pd = P.z1 - P.z0, pcx = (P.x0 + P.x1) / 2, pcz = (P.z0 + P.z1) / 2
    const bands = [
      { y0: -0.3, y1: 0.2, c: '#f4a9c0' }, { y0: 0.2, y1: 0.55, c: '#fbe8c8' },
      { y0: 0.55, y1: 0.85, c: '#c9b6ec' }, { y0: 0.85, y1: 1.12, c: '#e98aa8' },
      { y0: 1.12, y1: P.top, c: '#9fcf8f' },
    ]
    for (const b of bands) add(new THREE.Mesh(new THREE.BoxGeometry(pw, b.y1 - b.y0, pd), glossy(b.c)), pcx, (b.y0 + b.y1) / 2, pcz, block)
    // 바위 무더기(절벽 아래)
    ;[[-0.2, -0.9, 0.22], [-0.25, -0.15, 0.17], [-1.3, 0.0, 0.2], [-2.2, -0.05, 0.16]].forEach(([x, z, r]) =>
      add(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat('#e3b6c4')), x, 0.05, z, block))

    // ── 강 · 샘 ───────────────────────────────────────────────────
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
    const S = 0.9 // 성벽 반 폭
    // 성벽 + 성가퀴
    const wallH = 0.38
    ;[[0, -S, 2 * S, 0.12], [0, S, 2 * S, 0.12], [-S, 0, 0.12, 2 * S], [S, 0, 0.12, 2 * S]].forEach(([x, z, w, d]) => {
      add(new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), cream), x, wallH / 2, z, castle)
      const n = 7
      for (let i = 0; i < n; i++) {
        const t = -1 + (2 * i + 1) / n
        const cx = w > d ? x + t * (w / 2) : x, cz = w > d ? z : z + t * (d / 2)
        add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.14), cream), cx, wallH + 0.045, cz, castle)
      }
    })
    // 대전당
    add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.62, 0.6), mat('#f9f0de')), -0.05, 0.31, -0.15, castle)
    const hallRoof = add(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.45, 4), glossy('#f08fb3')), -0.05, 0.84, -0.15, castle)
    hallRoof.rotation.y = Math.PI / 4
    hallRoof.scale.set(1, 1, 0.75)
    const winGeo = new THREE.PlaneGeometry(0.09, 0.14)
    const addWin = (x, yy, z, ry = 0, parent = castle) => { const w = new THREE.Mesh(winGeo, windowMat); w.position.set(x, yy, z); w.rotation.y = ry; parent.add(w) }
    ;[-0.3, -0.05, 0.2].forEach(x => addWin(x, 0.38, 0.152))
    // 탑
    const towers = []
    const towerDef = [
      [-S, S, 0.22, 0.95, '#ef8fb3'], [S, S, 0.22, 1.05, '#b49ae8'],
      [-S, -S, 0.2, 0.85, '#8fb8f0'], [S, -S, 0.2, 0.9, '#ef8fb3'],
      [0.25, -0.35, 0.17, 1.55, '#8fb8f0'], // 가운데 높은 탑
    ]
    for (const [x, z, r, h, roof] of towerDef) {
      const g = new THREE.Group(); g.position.set(x, 0, z); castle.add(g)
      const body = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 24), cream2), 0, h / 2, 0, g)
      const cone = add(new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, h * 0.62, 24), glossy(roof)), 0, h + h * 0.31, 0, g)
      add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: '#e7b84a', metalness: 0.8, roughness: 0.25 })), 0, h + h * 0.62 + 0.03, 0, g)
      // 깃발
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1, 6, 1), new THREE.MeshStandardMaterial({ color: roof, side: THREE.DoubleSide }))
      flag.position.set(0.12, h + h * 0.62 + 0.14, 0); g.add(flag)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), mat('#c99a35')); pole.position.set(0, h + h * 0.62 + 0.12, 0); g.add(pole)
      addWin(0, h * 0.6, r + 0.002, 0, g)
      body.userData.pick = 'tower'; cone.userData.pick = 'tower'
      towers.push({ g, flag, flagBase: flag.geometry.attributes.position.array.slice(), top: new THREE.Vector3(x, h + h * 0.62, z) })
    }
    // 성문 + 도개교
    const gate = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.06), mat('#5a4636')), 0, 0.16, S + 0.04, castle)
    gate.userData.pick = 'gate'
    const bridgeHinge = new THREE.Group(); bridgeHinge.position.set(0, 0.02, S + 0.07); castle.add(bridgeHinge)
    const bridge = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.62), mat('#c79a6a')), 0, 0, 0.31, bridgeHinge)
    bridge.userData.pick = 'gate'
    // 화로
    const brazier = new THREE.Group(); brazier.position.set(0.55, 0, S + 0.35); castle.add(brazier)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.14, 12), mat('#6d5a4a')), 0, 0.07, 0, brazier).userData.pick = 'brazier'
    const flame = add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#ff9d4d', emissive: '#ff7a1a', emissiveIntensity: 1.5 })), 0, 0.2, 0, brazier)
    flame.castShadow = false; flame.userData.pick = 'brazier'
    const fireLight = new THREE.PointLight('#ffaa55', 0.6, 3, 1.6); fireLight.position.set(0, 0.35, 0); brazier.add(fireLight)

    // 소나무·꽃덤불·갈대
    const pine = mat('#5fae7a'), pine2 = mat('#4f9d6c')
    ;[[-2.75, -2.7], [-2.55, -0.25 - 0.3], [-0.65, -2.75], [-2.85, -1.4], [-0.7, -0.5]].forEach(([x, z], i) => {
      const h = 0.45 + (i % 3) * 0.12
      const t = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 10), i % 2 ? pine : pine2), x, P.top + h / 2, z, block)
      t.userData.sway = i
    })
    ;[[-2.2, -0.45, '#f7b6cf'], [-1.2, -0.4, '#fbd3e2'], [-0.85, -1.0, '#f7b6cf']].forEach(([x, z, c]) =>
      add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat(c)), x, P.top + 0.08, z, block))
    for (let i = 0; i < 14; i++) {
      const r = add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), mat('#7a9a52')), 2.2 + (i % 5) * 0.12, 0.12, -2.4 + Math.floor(i / 5) * 0.15, block)
      r.castShadow = false
    }

    // ── 폭포 (입자 + 반투명 띠) ───────────────────────────────────
    const fallN = 900
    const fallGeo = new THREE.BufferGeometry()
    const fallPos = new Float32Array(fallN * 3)
    const fallVel = new Float32Array(fallN * 3)
    fallGeo.setAttribute('position', new THREE.BufferAttribute(fallPos, 3))
    const fallPts = new THREE.Points(fallGeo, new THREE.PointsMaterial({ color: '#eaf8ff', size: 0.06, transparent: true, opacity: 0.85, depthWrite: false }))
    block.add(fallPts)
    const lip = new THREE.Vector3(P.x1 + 0.02, P.top - 0.02, riverZ)
    const respawnFall = i => {
      fallPos[i * 3] = lip.x + Math.random() * 0.03
      fallPos[i * 3 + 1] = lip.y + Math.random() * 0.02
      fallPos[i * 3 + 2] = lip.z + (Math.random() - 0.5) * 0.26
      fallVel[i * 3] = 0.55 + Math.random() * 0.25
      fallVel[i * 3 + 1] = -0.05
      fallVel[i * 3 + 2] = (Math.random() - 0.5) * 0.08
    }
    for (let i = 0; i < fallN; i++) { respawnFall(i); fallPos[i * 3 + 1] -= Math.random() * P.top }
    const impact = new THREE.Vector3(lip.x + 0.42, 0, riverZ)
    // 물보라 안개
    const mist = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }))
    mist.position.set(impact.x, 0.1, impact.z); mist.scale.set(1, 0.45, 1); block.add(mist)

    // ── 범선 ─────────────────────────────────────────────────────
    const ship = new THREE.Group(); block.add(ship)
    const hullShape = new THREE.Shape()
    hullShape.moveTo(-0.32, 0.06); hullShape.lineTo(0.36, 0.06); hullShape.quadraticCurveTo(0.3, -0.08, 0.2, -0.1); hullShape.lineTo(-0.24, -0.1); hullShape.quadraticCurveTo(-0.32, -0.04, -0.32, 0.06)
    const hull = add(new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.16, bevelEnabled: false }), glossy('#4a78bf')), 0, 0.08, -0.08, ship)
    hull.userData.pick = 'ship'
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), mat('#6d5a4a')), 0, 0.42, 0, ship)
    const sail = add(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.32, 4, 4), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide })), 0.02, 0.42, 0, ship)
    sail.rotation.y = Math.PI / 2; sail.userData.pick = 'ship'
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ color: '#e7b84a', side: THREE.DoubleSide })), 0.06, 0.72, 0, ship).rotation.y = Math.PI / 2
    const shipPath = { cx: 1.35, cz: 1.25, r: 1.05 }

    // ── 별 ───────────────────────────────────────────────────────
    const starN = 260
    const starGeo = new THREE.BufferGeometry()
    const sp = new Float32Array(starN * 3)
    let seed = 20261019
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < starN; i++) {
      const th = rnd() * Math.PI * 2, ph = 0.15 + rnd() * 1.1, R = 34
      sp[i * 3] = R * Math.cos(th) * Math.cos(ph); sp[i * 3 + 1] = R * Math.sin(ph); sp[i * 3 + 2] = R * Math.sin(th) * Math.cos(ph)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0, depthWrite: false })
    scene.add(new THREE.Points(starGeo, starMat))

    // ── 불꽃놀이 ─────────────────────────────────────────────────
    const fireworks = []
    const FW_COLORS = ['#f4a9c0', '#b49ae8', '#8fb8f0', '#ffd27a', '#9be3c4']
    const fwLight = new THREE.PointLight('#ffffff', 0, 14, 1.5); scene.add(fwLight)
    function launch() {
      const tw = towers[Math.floor(Math.random() * towers.length)]
      const from = tw.top.clone().add(castle.position)
      const color = new THREE.Color(FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)])
      const n = 90
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) { pos[i * 3] = from.x; pos[i * 3 + 1] = from.y; pos[i * 3 + 2] = from.z }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const m = new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })
      const pts = new THREE.Points(geo, m); scene.add(pts)
      fireworks.push({ pts, pos, vel, n, color, phase: 'rise', t: 0, y: from.y, apex: from.y + 2.2 + Math.random() * 1.2, from })
    }

    // ── 물결 원천(폭포 + 누른 자리) ─────────────────────────────
    const ripples = [] // {x, z, t, a}
    const addRipple = (x, z, a = 0.08) => { ripples.push({ x, z, t: 0, a }); if (ripples.length > 10) ripples.shift() }
    const waveHeight = (x, z, time, damp, flowAmp) => {
      let h = Math.sin(x * 1.3 + time * 0.9) * 0.012 + Math.cos(z * 1.1 - time * 0.7) * 0.012
      // 폭포가 계속 두드리는 자리
      const dx = x - impact.x, dz = z - impact.z, d = Math.sqrt(dx * dx + dz * dz)
      h += flowAmp * Math.sin(d * 9 - time * 7) * Math.exp(-d * (1.2 + damp * 2))
      for (const r of ripples) {
        const rx = x - r.x, rz = z - r.z, rd = Math.sqrt(rx * rx + rz * rz)
        const front = r.t * 1.6
        h += r.a * Math.sin((rd - front) * 10) * Math.exp(-Math.abs(rd - front) * 4) * Math.exp(-r.t * (0.6 + damp * 2.4))
      }
      return h
    }

    // ── 누르기 · 끌기 ─────────────────────────────────────────────
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let dragging = false, lastRipple = 0, downAt = null
    const pickAt = (cx, cy) => {
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects(block.children, true)
      for (const h of hits) {
        let o = h.object
        while (o && !o.userData.pick && o.parent) o = o.parent
        if (o?.userData.pick) return { kind: o.userData.pick, point: h.point }
      }
      return null
    }
    let jiggle = 0, jiggleV = 0
    const onDown = e => {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
      const hit = pickAt(e.clientX, e.clientY)
      if (hit?.kind === 'lake') {
        dragging = true; controls.enabled = false
        const p = block.worldToLocal(hit.point.clone()); addRipple(p.x, p.z, 0.1)
      }
    }
    const onMove = e => {
      if (!dragging) return
      const now = performance.now()
      if (now - lastRipple < 70) return
      lastRipple = now
      const hit = pickAt(e.clientX, e.clientY)
      if (hit?.kind === 'lake') { const p = block.worldToLocal(hit.point.clone()); addRipple(p.x, p.z, 0.06) }
    }
    const onUp = e => {
      const wasDrag = dragging
      dragging = false; controls.enabled = true
      if (!downAt) return
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
      const quick = performance.now() - downAt.t < 450
      downAt = null
      if (wasDrag || moved > 6 || !quick) return
      const hit = pickAt(e.clientX, e.clientY)
      if (!hit) return
      if (hit.kind === 'lake') return
      jiggleV += 0.6 // 누르면 블록이 출렁
      if (hit.kind === 'brazier') fireLight.intensity = 2.2
      if (hit.kind === 'ship') addRipple(ship.position.x, ship.position.z, 0.12)
      const rect = renderer.domElement.getBoundingClientRect()
      onPick?.(hit.kind, e.clientX - rect.left, e.clientY - rect.top)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    // 페이지에서 오는 명령(불꽃놀이·다리)
    let bridgeUp = false
    if (commandRef) commandRef.current = {
      fireworks: () => { for (let i = 0; i < 3; i++) setTimeout(launch, i * 260) },
      toggleBridge: () => { bridgeUp = !bridgeUp; return bridgeUp },
      tip: () => { jiggleV += 1.1 },
    }

    // ── 크기 ─────────────────────────────────────────────────────
    const onResize = () => {
      renderer.setSize(W(), H())
      camera.aspect = W() / H(); camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize); ro.observe(mount)

    // ── 고정 간격 물리 + 그리기 ──────────────────────────────────
    const STEP = 1 / 60
    let acc = 0, last = performance.now(), time = 0, raf = 0, nextAutoFw = 0, fallSpawn = 0
    let flavourNow = null
    const tmp = new THREE.Vector3()

    function stepPhysics(dt) {
      const s = settingsRef.current
      const firm = s.firmness, flow = s.flow, damp = s.damping ?? 0.5
      time += dt
      // 블록 출렁임(스프링 — 단단할수록 빨리, 덜 흔들린다)
      const k = 40 + firm * 160, c = 3 + firm * 9
      jiggleV += (-k * jiggle - c * jiggleV) * dt
      jiggle += jiggleV * dt
      // 폭포 입자
      const active = Math.floor(fallN * (0.15 + flow * 0.85))
      for (let i = 0; i < fallN; i++) {
        if (i >= active) { fallPos[i * 3 + 1] = -99; continue }
        if (fallPos[i * 3 + 1] < -50) { respawnFall(i); continue }
        fallVel[i * 3 + 1] -= 6.5 * dt
        fallPos[i * 3] += fallVel[i * 3] * dt
        fallPos[i * 3 + 1] += fallVel[i * 3 + 1] * dt
        fallPos[i * 3 + 2] += fallVel[i * 3 + 2] * dt
        if (fallPos[i * 3 + 1] < 0.02) {
          // 수면에 닿은 물 → 젤리 속 물줄기로
          if (Math.random() < 0.12 * (0.3 + flow)) {
            const j = Math.floor(Math.random() * plumeN)
            plumePos[j * 3] = fallPos[i * 3]; plumePos[j * 3 + 1] = -0.02; plumePos[j * 3 + 2] = fallPos[i * 3 + 2]
            plumeVel[j * 3] = 0.25 + Math.random() * 0.35; plumeVel[j * 3 + 1] = -0.25 - Math.random() * 0.2; plumeVel[j * 3 + 2] = (Math.random() - 0.5) * 0.3
            plumeLife[j] = 1.8 + Math.random()
          }
          respawnFall(i)
        }
      }
      fallSpawn += dt
      // 젤리 속 물줄기: 아래로 밀리다가 방울이 되어 떠오른다
      for (let j = 0; j < plumeN; j++) {
        if (plumeLife[j] <= 0) { plumePos[j * 3 + 1] = -99; continue }
        plumeLife[j] -= dt
        plumeVel[j * 3 + 1] += 0.32 * dt // 부력
        plumeVel[j * 3] *= 0.995
        plumePos[j * 3] += plumeVel[j * 3] * dt
        plumePos[j * 3 + 1] = Math.min(-0.02, Math.max(-JELLY_TOP + 0.02, plumePos[j * 3 + 1] + plumeVel[j * 3 + 1] * dt))
        plumePos[j * 3 + 2] += plumeVel[j * 3 + 2] * dt
        if (Math.abs(plumePos[j * 3]) > HALF - 0.05 || Math.abs(plumePos[j * 3 + 2]) > HALF - 0.05) plumeLife[j] = 0
      }
      // 물결 원천 나이
      for (const r of ripples) r.t += dt
      while (ripples.length && ripples[0].t > 5) ripples.shift()
      // 수면 높이장
      const arr = lakeGeo.attributes.position.array
      const flowAmp = 0.012 + flow * 0.03
      for (let i = 0; i < arr.length; i += 3) {
        const x = lakeBase[i], z = lakeBase[i + 2]
        const inPlateau = x < P.x1 && z < P.z1
        arr[i + 1] = inPlateau ? -0.05 : waveHeight(x, z, time, damp, flowAmp)
      }
      // 범선 — 호수를 돈다
      const sa = time * 0.18
      const sx = shipPath.cx + Math.cos(sa) * shipPath.r, sz = shipPath.cz + Math.sin(sa) * shipPath.r
      ship.position.set(sx, waveHeight(sx, sz, time, damp, flowAmp), sz)
      ship.rotation.y = -sa
      ship.rotation.z = Math.sin(time * 1.6) * 0.06
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
              const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, sp2 = 1.4 + Math.random() * 0.6
              const rr = Math.sqrt(1 - u * u)
              fw.vel[i * 3] = rr * Math.cos(th) * sp2; fw.vel[i * 3 + 1] = u * sp2; fw.vel[i * 3 + 2] = rr * Math.sin(th) * sp2
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

    function applyLook() {
      const s = settingsRef.current
      const t = s.timeOfDay // 0 낮 · 0.5 노을 · 1 밤
      const ang = triN(t, 1.05, 0.28, -0.25)
      sun.position.set(Math.cos(ang) * 8 + 2, Math.sin(ang) * 10 + 1, 5)
      sun.color.copy(tri(t, '#ffffff', '#ffb27a', '#8ea0ff'))
      sun.intensity = triN(t, 2.2, 1.4, 0.25)
      hemi.color.copy(tri(t, '#ffffff', '#ffd2b0', '#3a3f7a'))
      hemi.groundColor.copy(tri(t, '#d9c9ae', '#c7a58e', '#1c1a2c'))
      hemi.intensity = triN(t, 1.1, 0.8, 0.35)
      starMat.opacity = Math.max(0, (t - 0.6) / 0.4)
      windowMat.emissiveIntensity = Math.max(0, (t - 0.35) / 0.65) * 1.6
      if (flavourNow !== s.flavour) {
        flavourNow = s.flavour
        const f = FLAVOURS[s.flavour] || FLAVOURS.glacier
        lakeMat.color.set(f.lake); lakeMat.emissive.set(f.lake); jellyMat.color.set(f.deep)
      }
      // 밤엔 자동 불꽃놀이
      if (t > 0.8 && time > nextAutoFw) { launch(); nextAutoFw = time + 2 + Math.random() * 2 }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      if (document.hidden) { last = now; return }
      acc += Math.min(0.1, (now - last) / 1000)
      last = now
      while (acc >= STEP) { stepPhysics(STEP); acc -= STEP }
      lakeGeo.attributes.position.needsUpdate = true
      lakeGeo.computeVertexNormals()
      fallGeo.attributes.position.needsUpdate = true
      plumeGeo.attributes.position.needsUpdate = true
      // 깃발 펄럭임
      for (const tw of towers) {
        const a = tw.flag.geometry.attributes.position.array
        for (let i = 0; i < a.length; i += 3) a[i + 2] = Math.sin(tw.flagBase[i] * 22 + time * 6) * 0.02 * (tw.flagBase[i] + 0.11) * 8
        tw.flag.geometry.attributes.position.needsUpdate = true
      }
      // 소나무 흔들림 + 블록 출렁
      block.children.forEach(o => { if (o.userData.sway !== undefined) o.rotation.z = Math.sin(time * 1.3 + o.userData.sway) * 0.04 + jiggle * 0.08 })
      block.scale.set(1 - jiggle * 0.03, 1 + jiggle * 0.06, 1 - jiggle * 0.03)
      flame.scale.y = 1 + Math.sin(time * 14) * 0.15
      mist.material.opacity = 0.15 + settingsRef.current.flow * 0.3
      applyLook()
      controls.update()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose()) })
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      if (commandRef) commandRef.current = null
    }
  }, [])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
}
