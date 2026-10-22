'use client'
// Castle Jelly — 학생 3D 홈 장면(/castle · 관리자·미리보기 학생 전용)
//   2026-10-19: 원본 프롬프트 그대로 만든 시연판(public/castle-study · ~/Desktop/castle-jelly)을 옮겨 왔다 —
//   화질·효과는 시연판과 같고, 인터페이스(수업·달력·메뉴·한국어)는 페이지(app/castle/page.js)가 그대로 맡는다.
//   WebGPU(three 0.178 WebGPURenderer) — 지원 안 하는 기기는 자동으로 WebGL 2 로 그린다.
//   SDF 절벽(서피스 넷) · 젤리 굴절(transmission) · 빛 무늬 · 폭포가 젤리 속으로 이어지는 물줄기·거품·바닥 물줄기 실 ·
//   얕은 물 물결 · 범선·예포·소원 동전·공 · 시간대·맛. 옛 장면(CastleJellyScene.jsx)은 되돌릴 때를 위해 남겨 둔다.
//
// 페이지와의 약속(옛 장면과 같다):
//   settingsRef.current = { timeOfDay, flow, firmness, damping, flavour, catImg, reducedMotion }
//   commandRef.current  = { fireworks, toggleBridge(→ 올라갔으면 true), tip, salute, coin, ball }
//   onPick(종류, x, y) — tower·gate·ship·brazier·cat · onReady() 첫 프레임 · onFallback('nowebgl'|'lost'|'slow') · lite = 가벼운 모드
//   catAnchorRef — 냥이 머리 위 화면 좌표를 매 프레임 쓴다(냥이 말풍선 자리, lib/catAnchor)

import { useEffect, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { writeCatAnchor } from '../../lib/catAnchor'
import { buildBeach, palmGeometries } from './beach'

async function build(mount, { settingsRef, onPick, commandRef, onReady, onFallback, lite, catAnchorRef }, bag) {


    // ───────────────────────── constants ─────────────────────────
    // 해변 시범판(?beach=1 — components/castle/beach.js): 성 대신 넓은 백사장·파도·사람들, 물빛 = 아쿠아. 틀도 넓다(반폭 4)
    const BEACH = !!settingsRef.current?.beach
    const HALF = BEACH ? 4 : 3      // block half size
    const WATER = 0.85             // jelly lake depth (surface y = 0)
    const FLOOR_Y = -WATER
    const BASE_H = 1.25            // candy strata under the lake
    const TOP = 1.35               // plateau lawn height
    const N = 112                  // shallow-water grid
    const CELL = (HALF * 2) / (N - 1)
    const STEP = 1 / 60
    const RIVER_Z = -0.72
    const SPRING = new THREE.Vector3(-2.62, TOP, RIVER_Z)

    const FLAVOURS = {
      glacier: { tint: '#bdf0fa', deep: '#46b8e2', strata: ['#f4dfe5', '#fbf1df', '#d6cff2', '#cdeee0', '#f2c9d6', '#fbe9cf', '#c9b7ee', '#efa5be'] },
      rose:    { tint: '#fcd0de', deep: '#e57fa4', strata: ['#fde7ec', '#fff3e6', '#f6c3d3', '#fbe1d6', '#ee9fb8', '#fde9df', '#e7b6d0', '#d67b9b'] },
      // 해변 물빛(시범판) — 아쿠아·에메랄드·코발트·핑크 라군
      emerald: { tint: '#a3f2cf', deep: '#14b38c', strata: ['#f6e7c8', '#fff4dc', '#f3d9a8', '#e3f6ee', '#f7cfa6', '#fdebd0', '#bfe8d6', '#e8b98a'] },
      cobalt:  { tint: '#a6d6ff', deep: '#1f70d8', strata: ['#f6e7c8', '#fff4dc', '#f3d9a8', '#e3eef8', '#f7cfa6', '#fdebd0', '#bfd6f0', '#e8b98a'] },
      pinkLagoon: { tint: '#ffd6e6', deep: '#ee7fae', strata: ['#f6e7c8', '#fff4dc', '#f3d9a8', '#fbe6ee', '#f7cfa6', '#fdebd0', '#f2c9da', '#e8b98a'] },
      lagoon:  { tint: '#8ff5ea', deep: '#11c6cf', strata: ['#f6e7c8', '#fff4dc', '#f3d9a8', '#e3f6f2', '#f7cfa6', '#fdebd0', '#bfe8e4', '#e8b98a'] },
      lilac:   { tint: '#ddd2fb', deep: '#9b80e2', strata: ['#efeafb', '#fbf5f2', '#d8cdf5', '#e5f0f7', '#c4b0ee', '#f6eef5', '#b3a2e6', '#8f78cf'] },
    }
    const ROOF = ['#f39fbe', '#b7a0ef', '#93b8f2']
    const BEACH_WATER = ['lagoon', 'emerald', 'cobalt', 'pinkLagoon']
    const rng = (seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296))(9917)

    // ───────────────────────── state ─────────────────────────
    const st = () => settingsRef.current || {}
    const S = {
      get firm() { return st().firmness ?? 0.45 }, get flow() { return BEACH ? 0 : st().flow ?? 0.6 }, get damp() { return st().damping ?? 0.5 },
      get time() { return st().timeOfDay ?? 0.15 }, get flavour() { const f = st().flavour; return BEACH ? (BEACH_WATER.includes(f) ? f : 'lagoon') : FLAVOURS[f] ? f : 'glacier' }, get calm() { return !!st().reducedMotion },
      paused: false,
    }
    const counts = { fw: 0, salute: 0, wish: 0 }
    const W = () => mount.clientWidth || 1, H = () => mount.clientHeight || 1
    const narrow = () => W() < 760

    // ───────────────────────── renderer ─────────────────────────
    const renderer = new THREE.WebGPURenderer({ antialias: !lite, alpha: true, powerPreference: lite ? 'low-power' : 'high-performance' })
    let pr = lite ? 1 : Math.min(2, devicePixelRatio || 1)
    renderer.setPixelRatio(pr)
    renderer.setSize(W(), H())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 0.92
    renderer.domElement.style.touchAction = 'none'
    mount.appendChild(renderer.domElement)
    bag.renderer = renderer
    await renderer.init()
    if (bag.disposed) return

    const scene = new THREE.Scene()
    bag.scene = scene
    try {
      const pmrem = new THREE.PMREMGenerator(renderer)
      const env = await pmrem.fromSceneAsync(new RoomEnvironment(), 0.04)
      scene.environment = env.texture
      scene.environmentIntensity = 0.7
    } catch (e) { console.warn('env map skipped', e) }
    if (bag.disposed) return

    const camera = new THREE.PerspectiveCamera(30, W() / H(), 0.1, 200)
    const CAM0 = () => (narrow() ? new THREE.Vector3(17.5, 16.5, 21) : new THREE.Vector3(14.6, 11.9, 16.6)).multiplyScalar(BEACH ? (narrow() ? 1.75 : 1.45) : 1) // 해변 = 판이 커서 조금 멀리(폰 세로 화면에 다 들어오게)
    camera.position.copy(CAM0())
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.25, 0)
    controls.enableDamping = true; controls.enablePan = false
    controls.minDistance = 9; controls.maxDistance = BEACH ? 64 : 34 // 해변은 시작 거리가 34 를 넘는다(안 늘리면 잘려서 다시 가까워진다)
    controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.32
    controls.update()

    // ───────────────────────── light ─────────────────────────
    const hemi = new THREE.HemisphereLight('#ffffff', '#cfc5b5', 0.55)
    const sun = new THREE.DirectionalLight('#fff8ee', 2.6)
    sun.castShadow = true
    sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 })
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5
    scene.add(hemi, sun, sun.target)
    const fwLight = new THREE.PointLight('#ffffff', 0, 16, 1.4); scene.add(fwLight)

    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, ...o })
    const glossy = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 })
    const gold = new THREE.MeshStandardMaterial({ color: '#e8b84a', metalness: 0.9, roughness: 0.22 })
    const put = (m, x, y, z, parent, shadow = true) => { m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m }

    // ───────────────────────── paper studio table ─────────────────────────
    const paperTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 512
      const g = c.getContext('2d'); g.fillStyle = '#efede8'; g.fillRect(0, 0, 512, 512)
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '120,110,95'},${0.03 + rng() * 0.05})`; g.fillRect(rng() * 512, rng() * 512, 1 + rng() * 2, 1 + rng() * 2) }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; return t
    })()
    const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.12 }))
    table.rotation.x = -Math.PI / 2; table.position.y = FLOOR_Y - BASE_H - 0.005; table.receiveShadow = true
    scene.add(table)

    const block = new THREE.Group(); scene.add(block)

    // ───────────────────────── candy strata (cut faces) ─────────────────────────
    function strataTexture(cols, seed, w = 1024, h = 256) {
      const R = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d')
      const n = cols.length, ys = [0]
      for (let i = 0; i < n; i++) ys.push(ys[i] + (0.6 + R() * 0.8))
      const tot = ys[n]; for (let i = 0; i <= n; i++) ys[i] = ys[i] / tot * h
      const ph = Array.from({ length: n + 1 }, () => R() * 6.28)
      const edge = k => x => ys[k] + Math.sin(x * 0.012 + ph[k]) * h * 0.015 + Math.sin(x * 0.04 + ph[k] * 3) * h * 0.006
      for (let k = 0; k < n; k++) {
        const top = k === 0 ? () => -2 : edge(k), bot = k === n - 1 ? () => h + 2 : edge(k + 1)
        g.beginPath(); g.moveTo(0, top(0)); for (let x = 0; x <= w; x += 6) g.lineTo(x, top(x)); for (let x = w; x >= 0; x -= 6) g.lineTo(x, bot(x)); g.closePath()
        const gr = g.createLinearGradient(0, ys[k], 0, ys[k + 1]); gr.addColorStop(0, cols[k]); gr.addColorStop(1, cols[k])
        g.fillStyle = gr; g.fill()
        g.save(); g.clip()
        // sugar sparkle + gloss band
        for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + R() * 0.35})`; g.beginPath(); g.arc(R() * w, ys[k] + R() * (ys[k + 1] - ys[k]), 0.6 + R() * 1.2, 0, 6.29); g.fill() }
        const gl = g.createLinearGradient(0, ys[k], 0, ys[k + 1]); gl.addColorStop(0, 'rgba(255,255,255,0.35)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.06)')
        g.fillStyle = gl; g.fillRect(0, ys[k] - 6, w, ys[k + 1] - ys[k] + 12)
        g.restore()
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
    }
    const baseSide = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25 })
    const baseCap = std('#e9c7d4', { roughness: 0.5 })
    // 해변: 바다 쪽 두 단면(+x · +z)은 사탕 지층 대신 물로 — 위는 물빛, 아래로 갈수록 깊은 색 + 물결 빛 줄(2026-10-22 사용자 지시)
    function seaSideTexture(tint, deep, w = 512, h = 256) {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d'), top = new THREE.Color(tint).lerp(new THREE.Color(deep), 0.35), bot = new THREE.Color(deep).multiplyScalar(0.55)
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(1, '#' + bot.getHexString())
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      const R = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(11)
      for (let i = 0; i < 26; i++) { // 물속 빛 줄 — 위쪽일수록 밝고 촘촘하게
        const y = Math.pow(R(), 1.6) * h, a = 0.05 + (1 - y / h) * 0.16, ph = R() * 6.28, amp = 2 + R() * 4
        g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1 + R() * 2.2; g.beginPath()
        for (let x = 0; x <= w; x += 8) { const yy = y + Math.sin(x * 0.03 + ph) * amp; if (x) g.lineTo(x, yy); else g.moveTo(x, yy) }
        g.stroke()
      }
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.12 + R() * 0.25})`; g.beginPath(); g.arc(R() * w, R() * h, 0.6 + R() * 1.6, 0, 6.29); g.fill() } // 작은 물방울
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
    }
    const seaSide = BEACH ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#ffffff', emissiveIntensity: 0.08 }) : null
    const base = put(new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, BASE_H - 0.01, HALF * 2), [seaSide || baseSide, baseSide, baseCap, baseCap, seaSide || baseSide, baseSide]), 0, FLOOR_Y - 0.01 - (BASE_H - 0.01) / 2, 0, block)
    base.userData.pick = 'block'

    // ───────────────────────── plateau: SDF → surface nets ─────────────────────────
    const P = { x1: -0.3, z1: -0.12, r: 0.62 }
    const hash3 = (x, y, z) => Math.sin(x * 4.7 + z * 2.3) * Math.sin(y * 5.9 + x * 1.7) * 0.5 + Math.sin(z * 8.1 + y * 3.3 + x * 0.7) * 0.28 + Math.sin(x * 13.3 - z * 11.7) * 0.12
    function sdRound2(x, z) { // rounded rectangle extending far to the back-left
      const cx = (P.x1 - 5) / 2, cz = (P.z1 - 5) / 2, bx = (P.x1 + 5) / 2, bz = (P.z1 + 5) / 2
      const qx = Math.abs(x - cx) - bx + P.r, qz = Math.abs(z - cz) - bz + P.r
      return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - P.r
    }
    function plateauSDF(x, y, z) {
      const talus = y < -0.15 ? (-0.15 - y) * 0.42 : 0      // scree slope under the lake
      const ledge = Math.sin(y * 9.0 + x * 0.6) * 0.018       // layered ledges on the wall
      const dxz = sdRound2(x, z) - talus + hash3(x, y, z) * 0.045 + ledge
      const dy = y - TOP
      const rr = 0.06 // rounded lip
      return Math.hypot(Math.max(dxz + rr, 0), Math.max(dy + rr, 0)) + Math.min(Math.max(dxz + rr, dy + rr), 0) - rr
    }
    function surfaceNets(f, min, max, h) {
      const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1
      const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k)
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h)
      const V = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1), cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k)
      const pos = [], E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
      const cv = new Float32Array(8)
      for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        let neg = 0
        for (let c = 0; c < 8; c++) { cv[c] = F[id(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; if (cv[c] < 0) neg++ }
        if (neg === 0 || neg === 8) continue
        let sx = 0, sy = 0, sz = 0, cnt = 0
        for (const [a, b] of E) {
          if ((cv[a] < 0) === (cv[b] < 0)) continue
          const t = cv[a] / (cv[a] - cv[b])
          sx += (a & 1) + (((b & 1) - (a & 1)) * t); sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t); sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t); cnt++
        }
        V[cid(i, j, k)] = pos.length / 3
        pos.push(min[0] + (i + sx / cnt) * h, min[1] + (j + sy / cnt) * h, min[2] + (k + sz / cnt) * h)
      }
      const idx = []
      const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d) }
      for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { // x edges
        const s0 = F[id(i, j, k)] < 0, s1 = F[id(i + 1, j, k)] < 0; if (s0 === s1) continue
        quad(V[cid(i, j - 1, k - 1)], V[cid(i, j, k - 1)], V[cid(i, j, k)], V[cid(i, j - 1, k)], s0)
      }
      for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // y edges
        const s0 = F[id(i, j, k)] < 0, s1 = F[id(i, j + 1, k)] < 0; if (s0 === s1) continue
        quad(V[cid(i - 1, j, k - 1)], V[cid(i - 1, j, k)], V[cid(i, j, k)], V[cid(i, j, k - 1)], s0)
      }
      for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { // z edges
        const s0 = F[id(i, j, k)] < 0, s1 = F[id(i, j, k + 1)] < 0; if (s0 === s1) continue
        quad(V[cid(i - 1, j - 1, k)], V[cid(i, j - 1, k)], V[cid(i, j, k)], V[cid(i - 1, j, k)], s0)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx)
      return g
    }
    const plateauGeo = surfaceNets(plateauSDF, [-HALF + 0.001, FLOOR_Y - 0.01, -HALF + 0.001], [0.4, TOP + 0.12, 0.4], 0.055)
    { // normals from the SDF gradient + colours: candy strata on the wall, moss where it faces up, lawn on top
      const p = plateauGeo.attributes.position.array, n = new Float32Array(p.length), col = new Float32Array(p.length)
      const e = 0.01, c = new THREE.Color()
      let cols = FLAVOURS.glacier.strata
      const moss = new THREE.Color(BEACH ? '#9ccf78' : '#7cbf62'), lawn = new THREE.Color(BEACH ? '#f1dcab' : '#8fcd6a'), lawn2 = new THREE.Color(BEACH ? '#9fd27a' : '#79b958')
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i], y = p[i + 1], z = p[i + 2]
        let nx = plateauSDF(x + e, y, z) - plateauSDF(x - e, y, z), ny = plateauSDF(x, y + e, z) - plateauSDF(x, y - e, z), nz = plateauSDF(x, y, z + e) - plateauSDF(x, y, z - e)
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l
        n[i] = nx; n[i + 1] = ny; n[i + 2] = nz
        if (y > TOP - 0.05 && ny > 0.55) c.copy(lawn).lerp(lawn2, 0.5 + 0.5 * Math.sin(x * 7 + z * 5) * Math.sin(z * 3 - x * 4))
        else if (ny > 0.62 && y > -0.1) c.copy(moss)
        else {
          const band = (y - FLOOR_Y + Math.sin(x * 3.1 + z * 2.3) * 0.05 + hash3(x, 0, z) * 0.03) / 0.21
          const b = Math.floor(band), fr = band - b
          c.set(cols[((b % cols.length) + cols.length) % cols.length])
          if (fr < 0.08) c.lerp(new THREE.Color('#ffffff'), 0.35) // sugar seam
          if (ny > 0.35 && y > -0.1) c.lerp(moss, (ny - 0.35) * 1.5)
        }
        col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b
      }
      plateauGeo.setAttribute('normal', new THREE.BufferAttribute(n, 3))
      plateauGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      // face winding: make every triangle face outward (along the SDF gradient)
      const ix = plateauGeo.index.array
      for (let t = 0; t < ix.length; t += 3) {
        const a = ix[t] * 3, b = ix[t + 1] * 3, c2 = ix[t + 2] * 3
        const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c2] - p[a], vy = p[c2 + 1] - p[a + 1], vz = p[c2 + 2] - p[a + 2]
        const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx
        if (fx * (n[a] + n[b] + n[c2]) + fy * (n[a + 1] + n[b + 1] + n[c2 + 1]) + fz * (n[a + 2] + n[b + 2] + n[c2 + 2]) < 0) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k }
      }
    }
    const plateauMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.3 })
    const plateau = put(new THREE.Mesh(plateauGeo, plateauMat), 0, 0, 0, block)
    if (BEACH) block.remove(plateau) // 해변: 고원(고양이 섬)·강·폭포·배 없음 — 블록 전체가 백사장과 바다
    // recolour the candy strata when the flavour changes (lawn and moss stay)
    function plateauRecolour(cols) {
      const p = plateauGeo.attributes.position.array, n = plateauGeo.attributes.normal.array, col = plateauGeo.attributes.color.array
      const c = new THREE.Color(), moss = new THREE.Color('#7cbf62'), white = new THREE.Color('#ffffff')
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i], y = p[i + 1], z = p[i + 2], ny = n[i + 1]
        if ((y > TOP - 0.05 && ny > 0.55) || (ny > 0.62 && y > -0.1)) continue
        const band = (y - FLOOR_Y + Math.sin(x * 3.1 + z * 2.3) * 0.05 + hash3(x, 0, z) * 0.03) / 0.21
        const b = Math.floor(band), fr = band - b
        c.set(cols[((b % cols.length) + cols.length) % cols.length])
        if (fr < 0.08) c.lerp(white, 0.35)
        if (ny > 0.35 && y > -0.1) c.lerp(moss, (ny - 0.35) * 1.5)
        col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b
      }
      plateauGeo.attributes.color.needsUpdate = true
    }
    plateau.userData.pick = 'block'
    const inPlateau = (x, z) => !BEACH && plateauSDF(x, 0.0, z) < 0 // 해변 = 고원 없음
    const onLawn = (x, z) => plateauSDF(x, TOP - 0.04, z) < -0.08
    // waterfall lip: where the river meets the edge
    let LIP_X = -0.6
    for (let x = -1.2; x < 0.4; x += 0.005) if (plateauSDF(x, TOP - 0.03, RIVER_Z) > 0) { LIP_X = x; break }

    // ───────────────────────── lake floor (caustics) ─────────────────────────
    const CN = lite ? 64 : 128
    const causticData = new Uint8Array(CN * CN * 4)
    const causticTex = new THREE.DataTexture(causticData, CN, CN, THREE.RGBAFormat)
    causticTex.magFilter = THREE.LinearFilter; causticTex.minFilter = THREE.LinearFilter; causticTex.wrapS = causticTex.wrapT = THREE.RepeatWrapping
    causticTex.colorSpace = THREE.SRGBColorSpace; causticTex.needsUpdate = true
    function caustic(px, py, t) { // classic tileable water caustic
      let qx = (px * 6.2831853) % 6.2831853 - 250, qy = (py * 6.2831853) % 6.2831853 - 250
      let ix = qx, iy = qy, c = 1
      for (let n = 0; n < 4; n++) {
        const tt = t * (1 - 3.5 / (n + 1))
        const nx = qx + Math.cos(tt - ix) + Math.sin(tt + iy), ny = qy + Math.sin(tt - iy) + Math.cos(tt + ix)
        ix = nx; iy = ny
        c += 1 / Math.hypot(qx / (Math.sin(ix + tt) / 0.005), qy / (Math.cos(iy + tt) / 0.005))
      }
      c = 1.17 - Math.pow(c / 4, 1.4)
      return Math.min(1, Math.pow(Math.abs(c), 8))
    }
    const sandTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 512
      const g = c.getContext('2d'); g.fillStyle = '#f3e8d8'; g.fillRect(0, 0, 512, 512)
      for (let i = 0; i < 5000; i++) { g.fillStyle = ['#e9d9c2', '#fff8ee', '#e7d3d8', '#d9e6ee'][i % 4]; g.globalAlpha = 0.5; g.beginPath(); g.arc(rng() * 512, rng() * 512, 0.8 + rng() * 2.2, 0, 6.29); g.fill() }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
    })()
    const floorMat = std('#9cc6d2', { map: sandTex, roughness: 0.85, emissive: '#ffffff', emissiveMap: causticTex, emissiveIntensity: 1.4 })
    const floor = put(new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), floorMat), 0, FLOOR_Y, 0, block, false)
    floor.rotation.x = -Math.PI / 2; floor.userData.pick = 'block'

    // pebbles and reeds on the lake floor
    {
      const pebMat = std('#9aa3a6', { roughness: 0.8 })
      ;[[1.6, 2.2, 0.2], [-1.2, 1.9, 0.15], [2.3, -0.6, 0.17], [0.4, 0.9, 0.12], [-2.2, 1.0, 0.13], [1.0, -2.3, 0.15], [2.5, 1.2, 0.1]].forEach(([x, z, r], i) => {
        const m = put(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), pebMat), x, FLOOR_Y + r * 0.35, z, block); m.scale.set(1, 0.55, 0.85); m.rotation.y = i
      })
      const reeds = []
      for (let i = 0; i < 26; i++) {
        const x = 1.75 + (i % 7) * 0.1 + Math.sin(i * 2.1) * 0.06, z = -2.55 + Math.floor(i / 7) * 0.13, hh = 0.75 + (i % 3) * 0.18
        reeds.push(new THREE.CylinderGeometry(0.006, 0.012, hh, 4).translate(x, FLOOR_Y + hh / 2, z))
      }
      if (!BEACH) put(new THREE.Mesh(mergeGeometries(reeds), std('#6f9b4f')), 0, 0, 0, block, false)
    }

    // ───────────────────────── jelly lake (refraction) ─────────────────────────
    const h = new Float32Array(N * N), v = new Float32Array(N * N), solid = new Uint8Array(N * N), foam = new Float32Array(N * N), wakeFoam = new Float32Array(N * N) // 배 뒤 물보라 = 따로, 빨리 사라진다
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) solid[r * N + c] = inPlateau(-HALF + c * CELL, -HALF + r * CELL) ? 1 : 0
    const jellyMat = new THREE.MeshPhysicalMaterial({
      color: FLAVOURS.glacier.tint, transmission: 1, thickness: 1.1, ior: 1.33, roughness: 0.05,
      attenuationColor: new THREE.Color(FLAVOURS.glacier.deep), attenuationDistance: 2.4,
      clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 1, envMapIntensity: 1.2,
    })
    // top surface (grid follows the height field)
    const topGeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N - 1, N - 1); topGeo.rotateX(-Math.PI / 2)
    const lakeTop = new THREE.Mesh(topGeo, jellyMat); lakeTop.userData.pick = 'lake'; lakeTop.receiveShadow = true; block.add(lakeTop)
    // four cut faces whose top edge rides the waves
    const wallTop = []
    const wallGeo = (() => {
      const pos = [], nor = [], idx = []
      const sides = [
        { n: [0, 0, 1], at: k => [-HALF + k * CELL, HALF], cell: k => (N - 1) * N + k, flip: false },
        { n: [0, 0, -1], at: k => [-HALF + k * CELL, -HALF], cell: k => k, flip: true },
        { n: [1, 0, 0], at: k => [HALF, -HALF + k * CELL], cell: k => k * N + N - 1, flip: true },
        { n: [-1, 0, 0], at: k => [-HALF, -HALF + k * CELL], cell: k => k * N, flip: false },
      ]
      for (const sd of sides) {
        const b = pos.length / 3
        for (let k = 0; k < N; k++) { const [x, z] = sd.at(k); pos.push(x, FLOOR_Y, z, x, 0, z); nor.push(...sd.n, ...sd.n); wallTop.push(b + k * 2 + 1, sd.cell(k)) }
        for (let k = 0; k < N - 1; k++) { const a = b + k * 2; if (sd.flip) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g
    })()
    const lakeWalls = new THREE.Mesh(wallGeo, jellyMat); lakeWalls.userData.pick = 'block'; lakeWalls.frustumCulled = false; block.add(lakeWalls)
    // foam layer
    const foamData = new Uint8Array(N * N * 4)
    const foamTex = new THREE.DataTexture(foamData, N, N, THREE.RGBAFormat); foamTex.magFilter = THREE.LinearFilter; foamTex.minFilter = THREE.LinearFilter; foamTex.needsUpdate = true
    const foamGeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N - 1, N - 1); foamGeo.rotateX(-Math.PI / 2)
    const foamMesh = new THREE.Mesh(foamGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, transparent: true, alphaMap: foamTex, depthWrite: false }))
    foamMesh.renderOrder = 3; block.add(foamMesh)
    // surface glints (caustic net on the skin of the water)
    const glintMesh = new THREE.Mesh(topGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, alphaMap: causticTex, depthWrite: false, blending: THREE.AdditiveBlending }))
    glintMesh.renderOrder = 2; block.add(glintMesh)

    const gx = x => Math.round((x + HALF) / CELL), gz = z => Math.round((z + HALF) / CELL)
    function bump(x, z, amt, rad = 2.5) {
      const cc = gx(x), rr = gz(z), R = Math.ceil(rad * 1.6)
      for (let r = rr - R; r <= rr + R; r++) for (let c = cc - R; c <= cc + R; c++) {
        if (r < 1 || c < 1 || r >= N - 1 || c >= N - 1) continue
        const i = r * N + c; if (solid[i]) continue
        h[i] += amt * Math.exp(-((r - rr) ** 2 + (c - cc) ** 2) / (rad * rad))
      }
    }
    function addFoam(x, z, amt, rad = 1.5, buf = foam) {
      const cc = gx(x), rr = gz(z), R = Math.ceil(rad * 1.8)
      for (let r = rr - R; r <= rr + R; r++) for (let c = cc - R; c <= cc + R; c++) {
        if (r < 0 || c < 0 || r >= N || c >= N) continue
        const i = r * N + c; if (solid[i]) continue
        buf[i] = Math.min(1, buf[i] + amt * Math.exp(-((r - rr) ** 2 + (c - cc) ** 2) / (rad * rad)))
      }
    }
    function sampleH(x, z) {
      const fc = Math.min(N - 1.001, Math.max(0, (x + HALF) / CELL)), fr = Math.min(N - 1.001, Math.max(0, (z + HALF) / CELL))
      const c = Math.floor(fc), r = Math.floor(fr), tx = fc - c, tz = fr - r, i = r * N + c
      return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - tz) + (h[i + N] * (1 - tx) + h[i + N + 1] * tx) * tz
    }
    function simStep(damp) {
      for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) {
        const i = r * N + c; if (solid[i]) continue
        const a = (solid[i - 1] ? h[i] : h[i - 1]) + (solid[i + 1] ? h[i] : h[i + 1]) + (solid[i - N] ? h[i] : h[i - N]) + (solid[i + N] ? h[i] : h[i + N])
        v[i] = (v[i] + (a * 0.25 - h[i]) * 0.92) * damp
      }
      for (let i = 0; i < N * N; i++) h[i] = solid[i] ? 0 : h[i] + v[i]
      for (let k = 0; k < N; k++) { h[k] = h[k + N]; h[(N - 1) * N + k] = h[(N - 2) * N + k]; h[k * N] = h[k * N + 1]; h[k * N + N - 1] = h[k * N + N - 2] }
    }

    // ───────────────────────── particles (instanced — WebGPU draws points 1px) ─────────────────────────
    function pool(n, geo, mat) {
      const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = n
      const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n), size = new Float32Array(n).fill(1)
      pos.fill(-99)
      const M = new THREE.Matrix4()
      m.flush = () => { for (let i = 0; i < n; i++) { const s = life[i] > 0 ? size[i] : 0; M.makeScale(s, s, s).setPosition(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); m.setMatrixAt(i, M) } m.instanceMatrix.needsUpdate = true }
      return { m, pos, vel, life, size, n, head: 0 }
    }
    const dropGeo = new THREE.IcosahedronGeometry(0.016, 1)
    const spray = pool(lite ? 500 : 1100, dropGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, transparent: true, opacity: 0.9 }))
    block.add(spray.m)
    const fallP = pool(lite ? 260 : 520, dropGeo, new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.1, transparent: true, opacity: 0.85 }))
    if (!BEACH) block.add(fallP.m)
    // inside the jelly: opaque so they show through the refraction
    const plume = pool(lite ? 180 : 360, new THREE.IcosahedronGeometry(0.02, 1), new THREE.MeshStandardMaterial({ color: '#f6fdff', roughness: 0.05, emissive: '#cfefff', emissiveIntensity: 0.25 }))
    if (!BEACH) block.add(plume.m)
    function emit(P, x, y, z, n, up, spreadV, life = 1, size = 1) {
      for (let k = 0; k < n; k++) {
        const j = P.head++ % P.n, a = Math.random() * 6.283, s = Math.random() * spreadV
        P.pos[j * 3] = x + (Math.random() - 0.5) * 0.08; P.pos[j * 3 + 1] = y; P.pos[j * 3 + 2] = z + (Math.random() - 0.5) * 0.08
        P.vel[j * 3] = Math.cos(a) * s; P.vel[j * 3 + 1] = up * (0.45 + Math.random() * 0.75); P.vel[j * 3 + 2] = Math.sin(a) * s
        P.life[j] = life * (0.6 + Math.random() * 0.6); P.size[j] = size * (0.6 + Math.random() * 0.9)
      }
    }
    function splash(x, z, n, up, spreadV) { emit(spray, x, 0.02, z, n, up, spreadV, 1.1, 1.3); addFoam(x, z, Math.min(0.8, n * 0.012), 1.8) }

    // current threads streaming along the lake floor
    const threads = []
    for (let k = 0; k < 7; k++) {
      const g = new THREE.BufferGeometry(); const pts = new Float32Array(30 * 3)
      g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#e9fbff' })); line.frustumCulled = false
      if (!BEACH) block.add(line); threads.push({ g, pts, line, ph: k * 1.37, sp: (k - 3) * 0.12 })
    }

    // ───────────────────────── castle ─────────────────────────
    const castle = new THREE.Group(); castle.position.set(-1.75, TOP, -2.0); block.add(castle)
    const creamWall = std('#fbf3e3', { roughness: 0.7 }), creamTower = std('#fff8ec', { roughness: 0.62 }), trim = std('#efe2cb')
    const glass = new THREE.MeshStandardMaterial({ color: '#2f3448', roughness: 0.12, metalness: 0.3, emissive: '#ffcc7a', emissiveIntensity: 0 })
    const W2 = 0.88, WALL_H = 0.42
    {
      const parts = []
      ;[[0, -W2, 2 * W2, 0.12], [0, W2, 2 * W2, 0.12], [-W2, 0, 0.12, 2 * W2], [W2, 0, 0.12, 2 * W2]].forEach(([x, z, w, d]) => {
        if (z === W2) { // front wall split around the gatehouse
          parts.push(new THREE.BoxGeometry(W2 - 0.2, WALL_H, d).translate(-W2 / 2 - 0.1, WALL_H / 2, z), new THREE.BoxGeometry(W2 - 0.2, WALL_H, d).translate(W2 / 2 + 0.1, WALL_H / 2, z))
        } else parts.push(new THREE.BoxGeometry(w, WALL_H, d).translate(x, WALL_H / 2, z))
        for (let i = 0; i < 9; i++) { const t = -1 + (2 * i + 1) / 9; if (z === W2 && Math.abs(t) < 0.25) continue; parts.push(new THREE.BoxGeometry(w > d ? 0.09 : 0.15, 0.09, w > d ? 0.15 : 0.09).translate(w > d ? x + t * w / 2 : x, WALL_H + 0.045, w > d ? z : z + t * d / 2)) }
      })
      put(new THREE.Mesh(mergeGeometries(parts), creamWall), 0, 0, 0, castle)
    }
    // great hall
    put(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 0.62), creamTower), -0.05, 0.36, -0.2, castle)
    const hallRoof = put(new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.5, 4), glossy(ROOF[2])), -0.05, 0.97, -0.2, castle); hallRoof.rotation.y = Math.PI / 4; hallRoof.scale.set(1, 1, 0.74)
    // arched windows
    const archGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.035, 0); s.lineTo(0.035, 0); s.lineTo(0.035, 0.08); s.absarc(0, 0.08, 0.035, 0, Math.PI, false); s.lineTo(-0.035, 0); return new THREE.ShapeGeometry(s, 8) })()
    const windows = []
    const addWin = (x, y, z, parent, ry = 0) => { const w = new THREE.Mesh(archGeo, glass); w.position.set(x, y, z); w.rotation.y = ry; parent.add(w); windows.push(w) }
    ;[-0.32, -0.05, 0.22].forEach(x => { addWin(x, 0.38, 0.112, castle); addWin(x, 0.12, 0.112, castle) })
    const roofGeo = (r, ht) => {
      const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 1.22, 0), new THREE.Vector2(r * 1.2, ht * 0.04)]
      for (let i = 1; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(Math.max(0.002, r * 1.13 * Math.pow(1 - t, 1.35)), ht * (0.04 + 0.96 * t))) }
      return new THREE.LatheGeometry(pts, 32)
    }
    const towers = []
    ;[
      [-W2, W2, 0.2, 0.92, 0], [W2, W2, 0.2, 0.96, 2], [-W2, -W2, 0.2, 1.02, 1], [W2, -W2, 0.2, 0.96, 0],
      [0, -W2, 0.16, 1.22, 2], [-W2, 0, 0.15, 1.06, 1], [W2, 0, 0.14, 1.0, 1],
      [0.34, -0.36, 0.18, 1.8, 1], [-0.4, -0.52, 0.18, 1.55, 0], [0.06, 0.08, 0.15, 1.32, 2],
      [-0.2, W2 + 0.02, 0.12, 0.72, 0], [0.2, W2 + 0.02, 0.12, 0.72, 2], // gatehouse
    ].forEach(([x, z, r, ht, ri]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); castle.add(g)
      const body = put(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, ht, 32), creamTower), 0, ht / 2, 0, g)
      put(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.05, 32), trim), 0, ht - 0.02, 0, g)
      const rh = r * 3.7
      const cone = put(new THREE.Mesh(roofGeo(r, rh), glossy(ROOF[ri])), 0, ht, 0, g)
      put(new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), gold), 0, ht + rh + 0.02, 0, g)
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 6), gold), 0, ht + rh + 0.13, 0, g, false)
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09, 8, 1), new THREE.MeshStandardMaterial({ color: ROOF[(ri + 1) % 3], side: THREE.DoubleSide }))
      flag.position.set(0.115, ht + rh + 0.19, 0); g.add(flag)
      addWin(0, ht * 0.55, r + 0.003, g)
      body.userData.pick = cone.userData.pick = 'tower'; body.userData.tower = cone.userData.tower = towers.length
      towers.push({ g, flag, base: flag.geometry.attributes.position.array.slice(), top: new THREE.Vector3(x, ht + rh, z), wob: 0, wobV: 0 })
    })
    // gate + drawbridge
    const wood = std('#8a613f', { roughness: 0.7 })
    const gate = put(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.05), std('#5b4330')), 0, 0.15, W2 + 0.05, castle); gate.userData.pick = 'gate'
    const arch = put(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 20, 1, false, 0, Math.PI), std('#5b4330')), 0, 0.3, W2 + 0.05, castle)
    arch.rotation.x = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.userData.pick = 'gate'
    const bridgeHinge = new THREE.Group(); bridgeHinge.position.set(0, 0.03, W2 + 0.08); castle.add(bridgeHinge)
    const planks = []
    for (let i = 0; i < 9; i++) planks.push(new THREE.BoxGeometry(0.28, 0.025, 0.065).translate(0, 0, 0.04 + i * 0.07))
    const bridge = put(new THREE.Mesh(mergeGeometries(planks), wood), 0, 0, 0, bridgeHinge); bridge.userData.pick = 'gate'
    // 해변: 성은 장면에서 뺀다(눌림 목록은 아래에서 block 을 훑어 만드니 같이 빠진다). 성 자리에 바다를 보는 벤치 둘
    if (BEACH) {
      block.remove(castle)
    }
    let bridgeDown = true
    // brazier
    const brazier = new THREE.Group(); brazier.position.set(0.5, 0, W2 + 0.3); castle.add(brazier)
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.14, 14), std('#4a3c3c', { metalness: 0.4, roughness: 0.5 })), 0, 0.07, 0, brazier).userData.pick = 'brazier'
    const flame = put(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 12), new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ff7a1a', emissiveIntensity: 2.2 })), 0, 0.21, 0, brazier, false)
    flame.userData.pick = 'brazier'
    const fireLight = new THREE.PointLight('#ffa552', 0.8, 3.2, 1.6); fireLight.position.set(0, 0.35, 0); brazier.add(fireLight)
    let stoke = 0

    // the student's farm cat comes out onto the lawn (tap = farm)
    const catSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
    const CAT_POS = new THREE.Vector3(-1.2, TOP + 0.27, RIVER_Z + 0.32)
    catSprite.position.copy(CAT_POS); catSprite.scale.set(0.42, 0.54, 1); catSprite.visible = false
    catSprite.userData.pick = 'cat'; if (!BEACH) block.add(catSprite)
    let catUrl = null, catHop = 0
    const CAT_HEAD = new THREE.Vector3(0, 0.5, 0), catTmp = new THREE.Vector3() // 말풍선 자리 = 머리 끝
    const texLoader = new THREE.TextureLoader()
    function loadCat(url) {
      catUrl = url
      if (!url) { catSprite.visible = false; return }
      texLoader.load(url, t => {
        if (catUrl !== url || bag.disposed) { t.dispose(); return }
        t.colorSpace = THREE.SRGBColorSpace
        catSprite.material.map?.dispose(); catSprite.material.map = t; catSprite.material.needsUpdate = true
        catSprite.scale.set(0.54 * t.image.width / t.image.height, 0.54, 1); catSprite.visible = true
      })
    }

    // ───────────────────────── river + spring ─────────────────────────
    const riverMat = new THREE.MeshPhysicalMaterial({ color: FLAVOURS.glacier.tint, roughness: 0.04, transmission: 0.6, thickness: 0.05, clearcoat: 1 })
    if (!BEACH) {
      const len = LIP_X - SPRING.x
      const rg = new THREE.PlaneGeometry(len, 0.24, 40, 1); rg.rotateX(-Math.PI / 2)
      put(new THREE.Mesh(rg, riverMat), SPRING.x + len / 2, TOP + 0.012, RIVER_Z, block, false)
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 28), riverMat), SPRING.x, TOP + 0.014, RIVER_Z, block, false)
      const ring = []; for (let a = 0; a < 10; a++) ring.push(new THREE.DodecahedronGeometry(0.05, 0).translate(SPRING.x + Math.cos(a / 10 * 6.283) * 0.27, TOP + 0.02, RIVER_Z + Math.sin(a / 10 * 6.283) * 0.27))
      put(new THREE.Mesh(mergeGeometries(ring), std('#c9c3bd')), 0, 0, 0, block)
    }
    const riverGlints = pool(80, new THREE.PlaneGeometry(0.06, 0.012).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }))
    if (!BEACH) block.add(riverGlints.m)

    // waterfall ribbon (parabola)
    const FALL_VX = 0.62, G = 6.5
    const fallT = Math.sqrt((2 * (TOP - 0.02)) / G)
    const IMPACT = new THREE.Vector3(LIP_X + FALL_VX * fallT, 0, RIVER_Z)
    const fallTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 256
      const g = c.getContext('2d')
      for (let x = 0; x < 64; x++) { const a = 0.35 + 0.65 * Math.abs(Math.sin(x * 0.9) * Math.sin(x * 0.37)); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, 0, 1, 256) }
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${rng() * 0.7})`; g.fillRect(rng() * 64, rng() * 256, 1, 6 + rng() * 20) }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t
    })()
    const fallMat = new THREE.MeshStandardMaterial({ color: '#f2fbff', roughness: 0.1, transparent: true, alphaMap: fallTex, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, emissive: '#ffffff', emissiveIntensity: 0.15 })
    {
      const seg = 28, pos = [], uv = [], idx = []
      for (let i = 0; i <= seg; i++) {
        const t = i / seg * fallT, x = LIP_X + FALL_VX * t, y = TOP - 0.02 - 0.5 * G * t * t, w = 0.12 * (1 + i / seg * 0.5)
        pos.push(x, y, RIVER_Z - w, x, y, RIVER_Z + w); uv.push(0, 1 - i / seg, 1, 1 - i / seg)
        if (i < seg) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
      const ribbon = new THREE.Mesh(g, fallMat); ribbon.renderOrder = 4; if (!BEACH) block.add(ribbon)
    }
    const mist = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }))
    mist.position.set(IMPACT.x, 0.1, IMPACT.z); mist.scale.set(1.1, 0.4, 1); if (!BEACH) block.add(mist)

    // ───────────────────────── lawn: gummy pines, flowering bushes ─────────────────────────
    const pineGeo = (() => { const p = [new THREE.ConeGeometry(0.17, 0.3, 12).translate(0, 0.2, 0), new THREE.ConeGeometry(0.14, 0.26, 12).translate(0, 0.36, 0), new THREE.ConeGeometry(0.1, 0.22, 12).translate(0, 0.5, 0)]; return mergeGeometries(p) })()
    const trunkGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6).translate(0, 0.06, 0)
    const gummy = new THREE.MeshPhysicalMaterial({ color: '#3f9a5f', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2, sheen: 0.4 })
    const pines = []
    const palmTrunk = std('#a97c55', { roughness: 0.8 }), palmNut = std('#6b4a2c')
    const palmLeaf = new THREE.MeshPhysicalMaterial({ color: '#3fa565', roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide })
    const lawnSpots = []
    for (let i = 0; i < (BEACH ? 0 : 400) && lawnSpots.length < 34; i++) { // 해변 = 고원이 없으니 잔디 나무도 없다
      const x = -(HALF - 0.05) + rng() * (HALF - 0.3), z = -(HALF - 0.05) + rng() * (HALF - 0.15)
      // 해변: 고원 윗면 안쪽(가장자리에서 0.15 이상) — onLawn 은 윗면 높이에선 늘 거짓이라 조금 아래에서 잰다
      if (BEACH ? !(plateauSDF(x, TOP - 0.25, z) < -0.15) : !onLawn(x, z)) continue
      if (!BEACH && x > -2.75 && x < -0.75 && z > -3.0 && z < -0.95) continue // castle
      if (BEACH && (Math.hypot(x + 1.55, z + 1.45) < 0.45 || Math.hypot(x + 0.95, z + 2.05) < 0.45)) continue // 벤치
      if (Math.abs(z - RIVER_Z) < 0.22) continue // river
      if (Math.hypot(x - CAT_POS.x, z - CAT_POS.z) < 0.28) continue // farm cat
      if (lawnSpots.some(([a, b]) => Math.hypot(a - x, b - z) < (BEACH ? 0.42 : 0.2))) continue
      lawnSpots.push([x, z])
    }
    lawnSpots.forEach(([x, z], i) => {
      if (BEACH && i < 11) { // 야자수 — 젤리 소나무처럼 끌면 휘청인다
        const piv = new THREE.Group(); piv.position.set(x, TOP, z); piv.scale.setScalar(0.85 + rng() * 0.4); piv.rotation.y = rng() * 6; block.add(piv)
        const pg = palmGeometries(THREE, mergeGeometries, i)
        put(new THREE.Mesh(pg.trunk, palmTrunk), 0, 0, 0, piv); put(new THREE.Mesh(pg.nuts, palmNut), 0, 0, 0, piv)
        const t = put(new THREE.Mesh(pg.leaves, palmLeaf), 0, 0, 0, piv)
        t.userData.pick = 'pine'; t.userData.pine = pines.length
        pines.push({ piv, bx: 0, bz: 0, vx: 0, vz: 0, held: false, i })
      } else if (!BEACH && i < 18) {
        const piv = new THREE.Group(); piv.position.set(x, TOP, z); piv.scale.setScalar(0.75 + rng() * 0.45); block.add(piv)
        const t = put(new THREE.Mesh(pineGeo, gummy), 0, 0, 0, piv); put(new THREE.Mesh(trunkGeo, wood), 0, 0, 0, piv)
        t.userData.pick = 'pine'; t.userData.pine = pines.length
        pines.push({ piv, bx: 0, bz: 0, vx: 0, vz: 0, held: false, i })
      }
    })
    {
      const n = 40, bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 2), new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.5 }), n)
      const M = new THREE.Matrix4(); let k = 0
      for (let i = 0; i < 600 && k < n; i++) {
        const x = -2.95 + rng() * 2.7, z = -2.95 + rng() * 2.85
        if (!onLawn(x, z) || (x > -2.72 && x < -0.78 && z > -2.95 && z < -0.98) || Math.abs(z - RIVER_Z) < 0.17 || Math.hypot(x - CAT_POS.x, z - CAT_POS.z) < 0.22) continue
        const s = 0.6 + rng() * 0.7
        M.compose(new THREE.Vector3(x, TOP + 0.04 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.8, s)); bush.setMatrixAt(k, M)
        bush.setColorAt(k, new THREE.Color(k % 4 === 0 ? '#f6b2cb' : k % 4 === 1 ? '#fde3a0' : ['#68ad62', '#7cbf6c'][k % 2])); k++
      }
      bush.count = k; bush.castShadow = bush.receiveShadow = true; if (!BEACH) block.add(bush)
    }

    // ───────────────────────── royal galleon ─────────────────────────
    const ship = new THREE.Group(); if (!BEACH) block.add(ship)
    const hull = new THREE.Group(); hull.scale.setScalar(1.25); ship.add(hull)
    const sh = (m, x, y, z) => { put(m, x, y, z, hull); m.userData.pick = 'ship'; return m }
    {
      const s = new THREE.Shape()
      s.moveTo(-0.34, 0.12); s.lineTo(-0.3, 0.06); s.lineTo(0.3, 0.06); s.quadraticCurveTo(0.42, 0.08, 0.45, 0.14); s.quadraticCurveTo(0.34, -0.06, 0.2, -0.09); s.lineTo(-0.22, -0.09); s.quadraticCurveTo(-0.33, -0.05, -0.34, 0.12)
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.19, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.095)
      sh(new THREE.Mesh(g, glossy('#2f5fb3')), 0, 0.06, 0)
      sh(new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.022, 0.225), gold), 0.02, 0.135, 0)
      sh(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.19), std('#d8bf96')), 0, 0.14, 0)
      sh(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.2), glossy('#2f5fb3')), -0.26, 0.19, 0)
      const woodBits = [new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6).rotateZ(-1.15).translate(0.5, 0.21, 0)]
      const sailMat = new THREE.MeshStandardMaterial({ color: '#fbf7ee', side: THREE.DoubleSide, roughness: 0.75 })
      ;[[-0.09, 0.7], [0.16, 0.58]].forEach(([mx, mh]) => {
        woodBits.push(new THREE.CylinderGeometry(0.01, 0.012, mh, 6).translate(mx, 0.14 + mh / 2, 0))
        ;[[0.34, 0.25, 0.14 + mh * 0.38], [0.27, 0.19, 0.14 + mh * 0.76]].forEach(([w, hh, yy]) => {
          const g2 = new THREE.PlaneGeometry(w, hh, 8, 5), a = g2.attributes.position.array
          for (let i = 0; i < a.length; i += 3) a[i + 2] = 0.05 * Math.cos(a[i] / w * Math.PI) * Math.cos(a[i + 1] / hh * Math.PI * 0.6)
          g2.computeVertexNormals()
          const sl = sh(new THREE.Mesh(g2, sailMat), mx + 0.013, yy, 0); sl.rotation.y = Math.PI / 2
          woodBits.push(new THREE.CylinderGeometry(0.005, 0.005, w + 0.04, 5).rotateX(Math.PI / 2).translate(mx + 0.013, yy + hh / 2, 0))
        })
      })
      sh(new THREE.Mesh(mergeGeometries(woodBits), std('#5b4030')), 0, 0, 0)
      // crown standard
      const std2 = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.08, 4, 1), new THREE.MeshStandardMaterial({ color: '#2f5fb3', side: THREE.DoubleSide }))
      std2.position.set(-0.02, 0.9, 0.0); std2.rotation.y = Math.PI / 2; hull.add(std2)
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 6, 10), gold); crown.position.set(-0.02, 0.9, 0.006); crown.rotation.y = Math.PI / 2; hull.add(crown)
    }
    const SHIP_PATH = BEACH ? { cx: 1.6, cz: -2.1, r: 1.2 } : { cx: 1.15, cz: 1.15, r: 1.25 } // 해변 = 오른쪽 뒤 넓은 바다를 돈다
    // 배 — 평소엔 스스로 호수를 돈다(lap). 손가락으로 끌면 따라오고(drag), 놓으면 미끄러지다 멈추고(free),
    // 한동안 가만두면 제 길로 돌아가(back) 다시 돈다. **물 위에서만** — 땅·성벽·가장자리에 닿으면 그 앞에서 멈춘다.
    const SHIP_CLEAR = 0.3  // 배 반 폭 — 땅에서 이만큼 떨어진 물만 다닌다
    const shipClear = (x, z) => Math.abs(x) < HALF - SHIP_CLEAR && Math.abs(z) < HALF - SHIP_CLEAR && plateauSDF(x, 0, z) > SHIP_CLEAR && !(beach && beach.onBeach(x, z))
    // 해변: 백사장·소품·꽃게·조개·문어·갈매기(눌림 목록을 만들기 전에 — 꽃게·조개·문어도 눌린다)
    const beach = BEACH ? buildBeach({ THREE, block, std, mergeGeometries, sandTex, floorMat, HALF, rng, calm: S.calm, bump }) : null
    const shipVel = new THREE.Vector3(), shipTarget = new THREE.Vector3()
    let shipMode = 'lap', lapA = 0, shipIdle = 0, shipYaw = -Math.PI / 2, shipTurn = 0

    // ───────────────────────── stars, fireworks, coins, balls, shots ─────────────────────────
    const stars = pool(320, new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }))
    for (let i = 0; i < stars.n; i++) { const th = rng() * 6.283, ph = 0.12 + rng() * 1.1, R = 40; stars.pos[i * 3] = R * Math.cos(th) * Math.cos(ph); stars.pos[i * 3 + 1] = R * Math.sin(ph); stars.pos[i * 3 + 2] = R * Math.sin(th) * Math.cos(ph); stars.life[i] = 1; stars.size[i] = 0.5 + rng() * 1.3 }
    stars.m.flush(); scene.add(stars.m)

    const fwGeo = new THREE.IcosahedronGeometry(0.035, 0)
    const fireworks = []
    const FW_COLS = ['#ff8fb8', '#b49aff', '#7fc2ff', '#ffd37a', '#8ff0c6']
    function launch(tIdx) {
      const tw = towers[tIdx ?? Math.floor(Math.random() * 10)]
      const from = block.localToWorld(tw.top.clone().add(castle.position))
      const col = new THREE.Color(FW_COLS[Math.floor(Math.random() * FW_COLS.length)])
      const P2 = pool(110, fwGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
      for (let i = 0; i < P2.n; i++) { P2.pos[i * 3] = from.x; P2.pos[i * 3 + 1] = from.y; P2.pos[i * 3 + 2] = from.z; P2.life[i] = 1; P2.size[i] = i === 0 ? 1.6 : 0 }
      scene.add(P2.m)
      fireworks.push({ P: P2, col, phase: 'rise', t: 0, y: from.y, apex: from.y + 2.4 + Math.random() * 1.4, from })
      counts.fw++; ui()
    }
    const shots = [], smokes = [], coins = [], balls = []
    const ballMat = std('#2a2733', { roughness: 0.35, metalness: 0.4 })
    const fwd = () => new THREE.Vector3(Math.cos(ship.rotation.y), 0, -Math.sin(ship.rotation.y))
    function salute() {
      const f = fwd(), side = new THREE.Vector3(-f.z, 0, f.x)
      if (side.dot(new THREE.Vector3(0.5, 0, 0.4).sub(ship.position)) < 0) side.negate()
      for (let k = 0; k < 2; k++) {
        const o = ship.position.clone().add(f.clone().multiplyScalar(k ? 0.14 : -0.12)).add(new THREE.Vector3(0, 0.2, 0))
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), ballMat); m.position.copy(o); block.add(m)
        setTimeout(() => shots.push({ m, vel: side.clone().multiplyScalar(1.7 + Math.random() * 0.4).add(new THREE.Vector3(0, 1.5, 0)) }), k * 240)
        const sm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: '#f4f1ec', transparent: true, opacity: 0.85, depthWrite: false }))
        sm.position.copy(o).add(side.clone().multiplyScalar(0.14)); block.add(sm); smokes.push({ m: sm, t: -k * 0.24 })
      }
      jiggleV += 0.2; counts.salute++; ui()
    }
    const coinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 22)
    const camLocal = () => block.worldToLocal(camera.position.clone())
    function throwCoin() {
      const from = camLocal().lerp(new THREE.Vector3(0, 0.5, 0), 0.55)
      const tgt = new THREE.Vector3(IMPACT.x + 0.2 + (Math.random() - 0.3) * 0.5, 0, IMPACT.z + 0.3 + (Math.random() - 0.5) * 0.5), T = 0.9
      const vel = tgt.clone().sub(from).divideScalar(T); vel.y += 0.5 * G * T
      const m = new THREE.Mesh(coinGeo, gold); m.position.copy(from); m.castShadow = true; block.add(m)
      coins.push({ m, vel, state: 'air', spin: 6 + Math.random() * 6, t: 0 })
      if (coins.length > 60) block.remove(coins.shift().m)
      counts.wish++; ui()
    }
    function throwBall() {
      const from = camLocal().lerp(new THREE.Vector3(0, 0.5, 0), 0.5)
      const tgt = new THREE.Vector3(0.3 + Math.random() * 1.9, 0, 0.1 + Math.random() * 2.2), T = 1
      const vel = tgt.clone().sub(from).divideScalar(T); vel.y += 0.5 * G * T
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshPhysicalMaterial({ color: FW_COLS[balls.length % 5], roughness: 0.15, clearcoat: 1 }))
      m.position.copy(from); m.castShadow = true; block.add(m); balls.push({ m, vel })
      if (balls.length > 6) block.remove(balls.shift().m)
    }

    // ───────────────────────── input ─────────────────────────
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    let mode = null, downAt = null, dragStart = null, heldPine = null, lastRipple = 0
    const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), invBlock = new THREE.Matrix4(), localRay = new THREE.Ray()
    // 화면 점 → 호수 수면(y = 0, 섬 기준 좌표) 위의 점. 섬이 기울어 있어도 맞다.
    function waterPointAt(cx, cy) {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1)
      ray.setFromCamera(ndc, camera)
      invBlock.copy(block.matrixWorld).invert()
      localRay.copy(ray.ray).applyMatrix4(invBlock)
      return localRay.intersectPlane(waterPlane, new THREE.Vector3())
    }
    // 배를 끌 때의 목표 — 손가락이 땅 위로 가면 배에서 손가락 쪽으로 가다가 마지막 물 자리에서 멈춘다
    function shipAim(p) {
      if (shipClear(p.x, p.z)) return shipTarget.set(p.x, 0, p.z)
      const sx = ship.position.x, sz = ship.position.z
      let bx = sx, bz = sz
      for (let k = 1; k <= 24; k++) { const t = k / 24, x = sx + (p.x - sx) * t, z = sz + (p.z - sz) * t; if (!shipClear(x, z)) break; bx = x; bz = z }
      shipTarget.set(bx, 0, bz)
    }
    let tiltX = 0, tiltZ = 0, tiltVX = 0, tiltVZ = 0, tiltTX = 0, tiltTZ = 0, jiggle = 0, jiggleV = 0
    const pickables = []
    block.traverse(o => { if ((o.isMesh && !o.isInstancedMesh) || o.isSprite) pickables.push(o) })
    function pickAt(cx, cy) {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1)
      ray.setFromCamera(ndc, camera)
      for (const hit of ray.intersectObjects(pickables, false)) {
        let o = hit.object; while (o && !o.userData.pick && o.parent) o = o.parent
        if (!o?.userData.pick) continue
        if (o.userData.pick === 'lake') { const p = block.worldToLocal(hit.point.clone()); if (inPlateau(p.x, p.z)) continue }
        return { kind: o.userData.pick, point: hit.point, obj: o }
      }
      return null
    }
    const cvs = renderer.domElement
    const sfx = (n, o) => window.JellySfx?.play(n, o) // 반응 소리(public/jelly-sfx.js — 없으면 조용히)
    cvs.addEventListener('pointerdown', e => {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
      const hit = pickAt(e.clientX, e.clientY)
      if (hit?.kind === 'lake') { mode = 'lake'; controls.enabled = false; const p = block.worldToLocal(hit.point.clone()); bump(p.x, p.z, -0.06); sfx('splash', { s: 0.7 }) }
      else if (hit?.kind === 'block') { mode = 'tilt'; controls.enabled = false; dragStart = { x: e.clientX, y: e.clientY }; sfx('squish', { s: 0.7 }) }
      else if (hit?.kind === 'pine') { mode = 'pine'; controls.enabled = false; heldPine = pines[hit.obj.userData.pine]; heldPine.held = true; dragStart = { x: e.clientX, y: e.clientY } }
      else if (hit?.kind === 'ship') { mode = 'ship'; controls.enabled = false; dragStart = { x: e.clientX, y: e.clientY } }
    })
    const onMove = e => {
      if (mode === 'lake') {
        const now = performance.now(); if (now - lastRipple < 35) return; lastRipple = now
        const hit = pickAt(e.clientX, e.clientY)
        if (hit?.kind === 'lake') { const p = block.worldToLocal(hit.point.clone()); bump(p.x, p.z, -0.045, 2.2); addFoam(p.x, p.z, 0.1, 1.1); if (Math.random() < 0.45) sfx('drip', { s: 0.8 }) }
      } else if (mode === 'tilt') {
        tiltTZ = Math.max(-0.25, Math.min(0.25, -(e.clientX - dragStart.x) / 800)); tiltTX = Math.max(-0.25, Math.min(0.25, (e.clientY - dragStart.y) / 800)); sfx('stretch', { s: Math.min(1, Math.hypot(tiltTX, tiltTZ) * 4) })
      } else if (mode === 'ship') {
        // 살짝 누른 건 그냥 누르기(라운지 안내) — 4px 넘게 움직여야 끌기
        if (shipMode !== 'drag' && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) < 4) return
        const p = waterPointAt(e.clientX, e.clientY)
        if (p) { if (shipMode !== 'drag') { shipMode = 'drag'; shipVel.set(0, 0, 0) } shipAim(p) }
      } else if (mode === 'pine' && heldPine) {
        heldPine.bz = Math.max(-0.8, Math.min(0.8, -(e.clientX - dragStart.x) / 160)); heldPine.bx = Math.max(-0.8, Math.min(0.8, (e.clientY - dragStart.y) / 160)); sfx('stretch', { s: Math.min(1, Math.hypot(heldPine.bx, heldPine.bz)) })
      }
    }
    addEventListener('pointermove', onMove)
    const onUp = e => {
      const was = mode; mode = null; controls.enabled = true; tiltTX = tiltTZ = 0
      if (was === 'ship' && shipMode === 'drag') { shipMode = 'free'; shipIdle = 0 }
      if (was === 'tilt') sfx('boing', { s: 0.8, pitch: 0.8 })
      if (heldPine) { heldPine.held = false; heldPine = null; sfx('boing', { s: 0.7, pitch: 1.25 }) }
      if (!downAt) return
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y), quick = performance.now() - downAt.t < 450
      downAt = null
      if (was === 'lake' || moved > 6 || !quick) return
      const hit = pickAt(e.clientX, e.clientY); if (!hit) return
      if (hit.kind === 'block' || hit.kind === 'lake' || hit.kind === 'pine') return
      jiggleV += 0.4
      if (hit.kind === 'ship') sfx('boing', { s: 0.6, pitch: 0.9 }); else if (hit.kind === 'brazier') sfx('pop', { pitch: 0.8 }); else sfx('chime')
      if (hit.kind === 'tower') { const t = towers[hit.obj.userData.tower]; t.wobV += 3 }
      else if (hit.kind === 'brazier') { stoke = 1; emit(spray, ...brazierWorld(), 14, 1.2, 0.2, 0.7, 0.6) }
      else if (hit.kind === 'ship') bump(ship.position.x, ship.position.z, -0.07)
      else if (hit.kind === 'cat') catHop = 1
      else if (beach && ['crab', 'octopus', 'clam', 'person', 'sand'].includes(hit.kind)) beach.tap(hit.kind, hit.obj, hit.point)
      const r = cvs.getBoundingClientRect()
      onPick?.(hit.kind, e.clientX - r.left, e.clientY - r.top)
    }
    addEventListener('pointerup', onUp)
    bag.cleanup.push(() => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp) })
    function brazierWorld() { const p = block.worldToLocal(brazier.localToWorld(new THREE.Vector3(0, 0.25, 0))); return [p.x, p.y, p.z] }
    function toggleBridge() { bridgeDown = !bridgeDown; return !bridgeDown }

    // ───────────────────────── commands for the page ─────────────────────────
    function ui() {}
    if (commandRef) commandRef.current = {
      fireworks: () => { for (let i = 0; i < 3; i++) setTimeout(() => launch(), i * 280) },
      toggleBridge, salute, ball: throwBall,
      tip: () => { tiltVZ += 1.4; jiggleV += 0.8 },
      coin: () => { for (let i = 0; i < 3; i++) setTimeout(throwCoin, i * 150) },
      // 해변 놀거리(시범판)
      bigWave: () => { beach?.bigWave(); sfx('boing', { s: 0.5, pitch: 0.6 }) },
      dolphins: () => { beach?.dolphins(); sfx('chime', { pitch: 1.3 }) },
      surf: () => { beach?.surf(); sfx('chime', { pitch: 1.1 }) },
    }
    let flavourNow = null
    function applyFlavour() {
      const f = FLAVOURS[S.flavour]
      jellyMat.color.set(f.tint); jellyMat.attenuationColor.set(f.deep); riverMat.color.set(f.tint)
      floorMat.color.set(f.deep).lerp(new THREE.Color('#ffffff'), 0.45) // the lake floor takes the water's colour
      baseSide.map?.dispose(); baseSide.map = strataTexture(f.strata, 7); baseSide.needsUpdate = true
      if (seaSide) { seaSide.map?.dispose(); seaSide.map = seaSideTexture(f.tint, f.deep); seaSide.emissiveMap = seaSide.map; seaSide.needsUpdate = true }
      plateauRecolour(f.strata)
      beach?.setWater(f.deep)
    }

    // ───────────────────────── ship motion + wake ─────────────────────────
    const lapPoint = a => [SHIP_PATH.cx + Math.cos(a) * SHIP_PATH.r, SHIP_PATH.cz + Math.sin(a) * SHIP_PATH.r]
    function shipStep(dt) {
      const px = ship.position.x, pz = ship.position.z
      let nx, nz
      if (shipMode === 'lap') {
        lapA += dt * (S.calm ? 0.06 : 0.15)
        ;[nx, nz] = lapPoint(lapA)
        shipVel.set((nx - px) / dt, 0, (nz - pz) / dt)
        if (shipVel.length() > 3) shipVel.set(0, 0, 0) // 첫 프레임(제자리에서 출발) 튐 방지
      } else {
        // drag = 손가락 쪽으로 감쇠 용수철 · free = 놓은 자리까지 미끄러져 멈춤 · back = 제 길 가장 가까운 점으로 천천히
        let K = 0, D = 1.6, vmax = 2.4
        if (shipMode === 'drag') { K = 110; D = 19; vmax = 5 }
        else if (shipMode === 'free') {
          // 손을 뗀 자리까지 미끄러져 가서 멈춘다. 멈춘 뒤 7초 가만두면 제 길로
          K = 7; D = 4.5
          const near = Math.hypot(shipTarget.x - px, shipTarget.z - pz) < 0.08 && shipVel.length() < 0.08
          shipIdle = near ? shipIdle + dt : 0
          if (shipIdle > 7) shipMode = 'back'
        }
        if (shipMode === 'back') {
          const a = Math.atan2(pz - SHIP_PATH.cz, px - SHIP_PATH.cx), [tx, tz] = lapPoint(a)
          shipTarget.set(tx, 0, tz); K = 3; D = 3.2; vmax = 0.45
          if (Math.hypot(tx - px, tz - pz) < 0.05 && shipVel.length() < 0.3) { lapA = a; shipMode = 'lap' }
        }
        if (K) shipVel.add(new THREE.Vector3((shipTarget.x - px) * K, 0, (shipTarget.z - pz) * K).multiplyScalar(dt))
        shipVel.multiplyScalar(Math.max(0, 1 - D * dt))
        if (shipVel.length() > vmax) shipVel.setLength(vmax)
        nx = px + shipVel.x * dt; nz = pz + shipVel.z * dt
        // 물 밖으로는 못 간다 — 한 축만이라도 되면 기슭을 따라 미끄러지고, 둘 다 막히면 멈춘다(부딪힌 물결 하나)
        if (!shipClear(nx, nz)) {
          if (shipClear(nx, pz)) { nz = pz; shipVel.z = 0 }
          else if (shipClear(px, nz)) { nx = px; shipVel.x = 0 }
          else { if (shipVel.length() > 0.4) bump(px, pz, -0.02 * shipVel.length(), 1.6); nx = px; nz = pz; shipVel.set(0, 0, 0) }
        }
      }
      ship.position.set(nx, sampleH(nx, nz) - 0.025, nz)
      const speed = shipVel.length()
      window.JellySfx?.wake(shipMode === 'lap' ? 0 : Math.min(1, speed / 2.4)) // 끌고 다닐 때만 물살 소리(혼자 도는 동안은 조용히)
      // 뱃머리는 가는 쪽으로(느릴 땐 그대로) — 가장 짧은 쪽으로 돌고, 도는 만큼 옆으로 기운다
      if (speed > 0.06) {
        let d = Math.atan2(-shipVel.z, shipVel.x) - shipYaw
        d = Math.atan2(Math.sin(d), Math.cos(d))
        const turn = d * Math.min(1, dt * (shipMode === 'lap' ? 6 : 5))
        shipYaw += turn; shipTurn += ((turn / Math.max(dt, 1e-3)) - shipTurn) * Math.min(1, dt * 4)
      } else shipTurn *= Math.max(0, 1 - dt * 3)
      ship.rotation.y = shipYaw
      ship.rotation.z = Math.sin(time * 1.5) * 0.035 + (sampleH(nx + 0.15, nz) - sampleH(nx - 0.15, nz)) * 2 - Math.max(-0.25, Math.min(0.25, shipTurn * speed * 0.18))
      ship.rotation.x = (sampleH(nx, nz + 0.15) - sampleH(nx, nz - 0.15)) * 1.5 - Math.min(0.08, speed * 0.03)
      // 물결 — 빠를수록 뱃머리 물결이 크고 촘촘하고, 뒤로 V 자 물결과 하얀 거품 꼬리가 길어진다
      const sp = Math.min(1, speed / 2.2)
      const f = fwd(), side = new THREE.Vector3(-f.z, 0, f.x)
      if (speed > 0.03) addFoam(nx - f.x * 0.45, nz - f.z * 0.45, 0.05 + sp * 0.35, 1.1 + sp * 0.6, wakeFoam)
      wakeT -= dt
      if (wakeT <= 0 && speed > 0.03) {
        wakeT = 0.1 - sp * 0.07
        // 입체 물결을 세게 — 뱃머리가 물을 들어 올리고 바로 뒤가 꺼진다
        bump(nx + f.x * 0.4, nz + f.z * 0.4, 0.014 + sp * 0.13, 1.5 + sp * 1.0)
        if (sp > 0.08) bump(nx - f.x * 0.35, nz - f.z * 0.35, -(0.01 + sp * 0.09), 1.6 + sp * 0.8)
        if (sp > 0.12) for (const sgn of [-1, 1]) {
          const bx = nx - f.x * 0.3 + side.x * sgn * (0.22 + sp * 0.12), bz = nz - f.z * 0.3 + side.z * sgn * (0.22 + sp * 0.12)
          bump(bx, bz, -0.075 * sp, 1.5); addFoam(bx, bz, 0.09 * sp, 0.9, wakeFoam)
        }
      }
    }

    // ───────────────────────── simulation ─────────────────────────
    let time = 0, pulse = 0, nextAutoFw = 0, wakeT = 0
    const tmpM = new THREE.Matrix4()
    function step(dt) {
      time += dt
      const firm = S.firm, flow = S.flow
      const k = 40 + firm * 170, c = 3 + firm * 10
      jiggleV += (-k * jiggle - c * jiggleV) * dt; jiggle += jiggleV * dt
      const tk = 28 + firm * 70, tc = 4 + firm * 7
      const pX = tiltX, pZ = tiltZ
      tiltVX += (-(tiltX - tiltTX) * tk - tiltVX * tc) * dt; tiltX += tiltVX * dt
      tiltVZ += (-(tiltZ - tiltTZ) * tk - tiltVZ * tc) * dt; tiltZ += tiltVZ * dt
      const dX = tiltX - pX, dZ = tiltZ - pZ
      if (Math.abs(dX) + Math.abs(dZ) > 1e-5) for (let r = 1; r < N - 1; r++) for (let cc = 1; cc < N - 1; cc++) { const i = r * N + cc; if (!solid[i]) v[i] += (dZ * (-HALF + cc * CELL) - dX * (-HALF + r * CELL)) * 0.07 }
      // the falls pound the surface: steady drumming + a beat that sends rings outward
      bump(IMPACT.x + (Math.random() - 0.5) * 0.12, IMPACT.z + (Math.random() - 0.5) * 0.18, -(0.004 + flow * 0.016) * (0.6 + Math.random() * 0.8), 1.6)
      pulse -= dt
      if (pulse <= 0 && flow > 0.03) { pulse = 0.5 - flow * 0.22; bump(IMPACT.x + 0.08, IMPACT.z, -(0.025 + flow * 0.045), 2.4) }
      if (Math.random() < flow * 0.9) emit(spray, IMPACT.x, 0.02, IMPACT.z, 2, 1.2 + flow * 1.4, 0.55, 0.9, 1)
      addFoam(IMPACT.x + 0.05 + Math.random() * 0.5, IMPACT.z + (Math.random() - 0.5) * 0.6, 0.015 + flow * 0.035, 1.3)
      // galleon — laps by itself, or follows a finger on the water; the wake grows with its speed
      if (!BEACH) shipStep(dt)
      const wk = Math.exp(-dt * 2.6) // 배 물보라 반감 ≈ 0.27초
      for (let i = 0; i < N * N; i++) { foam[i] = foam[i] > 0.003 ? foam[i] * 0.9965 : 0; wakeFoam[i] = wakeFoam[i] > 0.003 ? wakeFoam[i] * wk : 0 }
      simStep(0.996 - S.damp * 0.03)
      // falling water particles along the ribbon
      const active = Math.floor(fallP.n * (0.12 + flow * 0.88))
      for (let i = 0; i < fallP.n; i++) {
        if (i >= active) { fallP.life[i] = 0; continue }
        if (fallP.life[i] <= 0 || fallP.pos[i * 3 + 1] < 0.02) {
          if (fallP.life[i] > 0 && Math.random() < 0.18 * (0.3 + flow)) { // plunge into the jelly
            const j = plume.head++ % plume.n
            plume.pos[j * 3] = fallP.pos[i * 3]; plume.pos[j * 3 + 1] = -0.03; plume.pos[j * 3 + 2] = fallP.pos[i * 3 + 2]
            plume.vel[j * 3] = 0.25 + Math.random() * 0.35; plume.vel[j * 3 + 1] = -0.55 - Math.random() * 0.35; plume.vel[j * 3 + 2] = (Math.random() - 0.5) * 0.35
            plume.life[j] = 2.4 + Math.random() * 1.6; plume.size[j] = 0.6 + Math.random() * 1.2
          }
          fallP.pos[i * 3] = LIP_X + Math.random() * 0.02; fallP.pos[i * 3 + 1] = TOP - 0.02 - Math.random() * 0.4 * Math.random(); fallP.pos[i * 3 + 2] = RIVER_Z + (Math.random() - 0.5) * 0.26
          fallP.vel[i * 3] = FALL_VX * (0.85 + Math.random() * 0.3); fallP.vel[i * 3 + 1] = -Math.sqrt(2 * G * (TOP - fallP.pos[i * 3 + 1])); fallP.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.14
          fallP.life[i] = 1; fallP.size[i] = 0.7 + Math.random() * 0.8
        }
        fallP.vel[i * 3 + 1] -= G * dt
        for (let a = 0; a < 3; a++) fallP.pos[i * 3 + a] += fallP.vel[i * 3 + a] * dt
      }
      // plume: driven down, then the bubbles rise
      for (let j = 0; j < plume.n; j++) {
        if (plume.life[j] <= 0) continue
        plume.life[j] -= dt
        plume.vel[j * 3 + 1] += 0.55 * dt
        plume.vel[j * 3] *= 0.992; plume.vel[j * 3 + 2] *= 0.992
        for (let a = 0; a < 3; a++) plume.pos[j * 3 + a] += plume.vel[j * 3 + a] * dt
        plume.pos[j * 3 + 1] = Math.min(-0.03, Math.max(FLOOR_Y + 0.03, plume.pos[j * 3 + 1]))
        if (plume.pos[j * 3 + 1] >= -0.031 && plume.vel[j * 3 + 1] > 0) { plume.life[j] = 0; if (Math.random() < 0.3) bump(plume.pos[j * 3], plume.pos[j * 3 + 2], 0.002, 1) }
        if (Math.abs(plume.pos[j * 3]) > HALF - 0.05 || Math.abs(plume.pos[j * 3 + 2]) > HALF - 0.05 || inPlateau(plume.pos[j * 3], plume.pos[j * 3 + 2])) plume.life[j] = 0
      }
      for (let j = 0; j < spray.n; j++) {
        if (spray.life[j] <= 0) continue
        spray.life[j] -= dt; spray.vel[j * 3 + 1] -= 4.8 * dt
        for (let a = 0; a < 3; a++) spray.pos[j * 3 + a] += spray.vel[j * 3 + a] * dt
        if (spray.pos[j * 3 + 1] < 0 && !inPlateau(spray.pos[j * 3], spray.pos[j * 3 + 2])) spray.life[j] = 0
      }
      // river glints drifting to the lip
      for (let j = 0; j < riverGlints.n; j++) {
        if (riverGlints.life[j] <= 0 || riverGlints.pos[j * 3] > LIP_X) { riverGlints.pos[j * 3] = SPRING.x + 0.2 + Math.random() * 0.2; riverGlints.pos[j * 3 + 1] = TOP + 0.016; riverGlints.pos[j * 3 + 2] = RIVER_Z + (Math.random() - 0.5) * 0.18; riverGlints.vel[j * 3] = 0.25 + Math.random() * 0.35; riverGlints.life[j] = 1; riverGlints.size[j] = 0.5 + Math.random() }
        riverGlints.pos[j * 3] += riverGlints.vel[j * 3] * dt * (0.3 + flow)
      }
      // shots → water columns
      for (let s = shots.length - 1; s >= 0; s--) {
        const o = shots[s]; o.vel.y -= G * dt; o.m.position.addScaledVector(o.vel, dt)
        if (o.m.position.y < 0) { const { x, z } = o.m.position
          if (Math.abs(x) < HALF && Math.abs(z) < HALF && !inPlateau(x, z)) { bump(x, z, -0.14, 3); emit(spray, x, 0.02, z, 150, 3.6, 0.32, 1.3, 1.4); emit(spray, x, 0.02, z, 70, 1.4, 1.0, 1, 1.1); addFoam(x, z, 1, 3.2) }
          block.remove(o.m); shots.splice(s, 1) }
      }
      for (let s = smokes.length - 1; s >= 0; s--) {
        const sm = smokes[s]; sm.t += dt; sm.m.visible = sm.t >= 0; if (sm.t < 0) continue
        sm.m.scale.setScalar(1 + sm.t * 4); sm.m.position.y += dt * 0.3; sm.m.material.opacity = Math.max(0, 0.85 - sm.t * 0.7)
        if (sm.t > 1.3) { block.remove(sm.m); smokes.splice(s, 1) }
      }
      for (const cn of coins) {
        cn.t += dt
        if (cn.state === 'air') { cn.vel.y -= G * dt; cn.m.position.addScaledVector(cn.vel, dt); cn.m.rotation.x += cn.spin * dt
          if (cn.m.position.y < 0) { cn.state = 'water'; bump(cn.m.position.x, cn.m.position.z, -0.035, 1.5); emit(spray, cn.m.position.x, 0.02, cn.m.position.z, 12, 1.3, 0.3, 0.8, 0.8) } }
        else if (cn.state === 'water') { cn.m.position.y -= 0.2 * dt; cn.m.position.x += Math.sin(cn.t * 5 + cn.spin) * 0.08 * dt; cn.m.rotation.x += Math.sin(cn.t * 3) * dt * 2
          if (cn.m.position.y <= FLOOR_Y + 0.008) { cn.state = 'rest'; cn.m.position.y = FLOOR_Y + 0.008; cn.m.rotation.set(0, cn.spin, 0) } }
      }
      for (const b of balls) {
        const p = b.m.position; b.vel.y -= G * dt
        const w = sampleH(p.x, p.z)
        if (p.y - 0.12 < w) { const sub = Math.min(0.24, w - (p.y - 0.12)); b.vel.y += sub * 90 * dt; b.vel.multiplyScalar(0.94)
          if (b.vel.y < -1.2) { bump(p.x, p.z, -0.09, 2.3); emit(spray, p.x, 0.02, p.z, 45, 2.3, 0.5); jiggleV += 0.2; sfx('splash', { s: 0.9 }) } }
        p.addScaledVector(b.vel, dt)
        if (p.y < FLOOR_Y + 0.12) { p.y = FLOOR_Y + 0.12; b.vel.y = Math.abs(b.vel.y) * 0.3 }
        const lim = HALF - 0.13
        if (p.x > lim) { p.x = lim; b.vel.x *= -0.6 } if (p.x < -lim) { p.x = -lim; b.vel.x *= -0.6 }
        if (p.z > lim) { p.z = lim; b.vel.z *= -0.6 } if (p.z < -lim) { p.z = -lim; b.vel.z *= -0.6 }
        if (p.y < TOP && inPlateau(p.x, p.z)) { p.x += 0.02; p.z += 0.02; b.vel.x = Math.abs(b.vel.x) * 0.6; b.vel.z = Math.abs(b.vel.z) * 0.6 }
        b.m.rotation.x += b.vel.z * dt * 4; b.m.rotation.z -= b.vel.x * dt * 4
      }
      for (const pn of pines) if (!pn.held) { pn.vx += (-pn.bx * 60 - pn.vx * 5) * dt; pn.bx += pn.vx * dt; pn.vz += (-pn.bz * 60 - pn.vz * 5) * dt; pn.bz += pn.vz * dt }
      for (const t of towers) { t.wobV += (-t.wob * 120 - t.wobV * 8) * dt; t.wob += t.wobV * dt }
      bridgeHinge.rotation.x += ((bridgeDown ? 0 : -1.3) - bridgeHinge.rotation.x) * Math.min(1, dt * 2.5)
      for (let f = fireworks.length - 1; f >= 0; f--) {
        const fw = fireworks[f], P2 = fw.P; fw.t += dt
        if (fw.phase === 'rise') {
          fw.y += 4.6 * dt; P2.pos[1] = fw.y
          if (fw.y >= fw.apex) {
            fw.phase = 'burst'; fw.t = 0
            for (let i = 0; i < P2.n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = 1.4 + Math.random() * 0.7, rr = Math.sqrt(1 - u * u)
              P2.pos[i * 3] = fw.from.x; P2.pos[i * 3 + 1] = fw.y; P2.pos[i * 3 + 2] = fw.from.z; P2.vel[i * 3] = rr * Math.cos(th) * s; P2.vel[i * 3 + 1] = u * s; P2.vel[i * 3 + 2] = rr * Math.sin(th) * s; P2.size[i] = 0.8 + Math.random() * 0.6 }
            fwLight.color.copy(fw.col); fwLight.position.set(fw.from.x, fw.y, fw.from.z); fwLight.intensity = 14
          }
        } else {
          for (let i = 0; i < P2.n; i++) { P2.vel[i * 3 + 1] -= 1.2 * dt; for (let a = 0; a < 3; a++) { P2.vel[i * 3 + a] *= 0.985; P2.pos[i * 3 + a] += P2.vel[i * 3 + a] * dt } }
          P2.m.material.opacity = Math.max(0, 1 - fw.t / 1.7)
          if (fw.t > 1.8) { scene.remove(P2.m); P2.m.dispose(); fireworks.splice(f, 1) }
        }
      }
      fwLight.intensity *= Math.pow(0.05, dt)
      stoke = Math.max(0, stoke - dt * 0.6)
      fireLight.intensity = 0.8 + stoke * 3 + Math.sin(time * 11) * 0.12
      if (S.time > 0.8 && !S.calm && time > nextAutoFw) { launch(); nextAutoFw = time + 1.8 + Math.random() * 2 }
    }

    // ───────────────────────── per-frame visuals ─────────────────────────
    const lerpC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t)
    const tri = (t, a, b, c) => t < 0.5 ? lerpC(a, b, t * 2) : lerpC(b, c, (t - 0.5) * 2)
    const triN = (t, a, b, c) => t < 0.5 ? a + (b - a) * t * 2 : b + (c - b) * (t - 0.5) * 2
    function look() {
      const t = S.time, ang = triN(t, 1.0, 0.25, -0.2)
      sun.position.set(Math.cos(ang) * 8 + 3, Math.sin(ang) * 10 + 1.5, 6)
      sun.color.copy(tri(t, '#fff8ee', '#ffb07a', '#8fa0ff')); sun.intensity = triN(t, 2.6, 1.6, 0.25)
      hemi.color.copy(tri(t, '#ffffff', '#ffd5b8', '#3b4080')); hemi.groundColor.copy(tri(t, '#cfc5b5', '#c5a48e', '#1a1828')); hemi.intensity = triN(t, 0.55, 0.45, 0.3)
      scene.environmentIntensity = triN(t, 0.7, 0.45, 0.1)
      floorMat.emissiveIntensity = triN(t, 1.4, 0.8, 0.15)
      glintMesh.material.opacity = triN(t, 0.85, 0.5, 0.1)
      for (const th of threads) th.line.material.color.setScalar(triN(t, 1, 0.75, 0.3))
      glass.emissiveIntensity = Math.max(0, (t - 0.4) / 0.6) * 2.4
      stars.m.material.opacity = Math.max(0, (t - 0.62) / 0.38)
      if (flavourNow !== S.flavour) { flavourNow = S.flavour; applyFlavour() }
      if ((st().catImg || null) !== catUrl) loadCat(st().catImg || null)
      mist.material.opacity = 0.1 + S.flow * 0.28
      fallMat.opacity = 0.35 + S.flow * 0.6
    }
    const shift = { x: 0, y: 0 }
    function visuals() {
      // surface + foam + walls follow the heightfield
      const tp = topGeo.attributes.position.array, fp = foamGeo.attributes.position.array, wp = wallGeo.attributes.position.array
      for (let i = 0, p = 1; i < N * N; i++, p += 3) { const y = solid[i] ? -0.05 : h[i]; tp[p] = y; fp[p] = y + 0.006 }
      topGeo.attributes.position.needsUpdate = true; topGeo.computeVertexNormals()
      foamGeo.attributes.position.needsUpdate = true
      for (let k = 0; k < wallTop.length; k += 2) wp[wallTop[k] * 3 + 1] = solid[wallTop[k + 1]] ? 0 : h[wallTop[k + 1]]
      wallGeo.attributes.position.needsUpdate = true
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const i = r * N + c, o = ((N - 1 - r) * N + c) * 4, f = Math.round(Math.max(foam[i], wakeFoam[i]) * 255); foamData[o] = foamData[o + 1] = foamData[o + 2] = f; foamData[o + 3] = 255 }
      foamTex.needsUpdate = true
      // caustics: procedural net + light gathered by the wave lenses
      const tc = time * 0.5
      for (let y = 0; y < CN; y++) for (let x = 0; x < CN; x++) {
        const u = x / CN, w = y / CN
        let c = caustic(u * 2, w * 2, tc)
        const hc = Math.round(u * (N - 1)), hr = Math.round((1 - w) * (N - 1)), i = hr * N + hc
        if (hr > 0 && hc > 0 && hr < N - 1 && hc < N - 1 && !solid[i]) c += Math.max(0, -(h[i - 1] + h[i + 1] + h[i - N] + h[i + N] - 4 * h[i]) * 45)
        const o = (y * CN + x) * 4, b = Math.min(255, Math.round(c * 320))
        causticData[o] = b * 0.86; causticData[o + 1] = b * 0.97; causticData[o + 2] = b; causticData[o + 3] = 255
      }
      causticTex.needsUpdate = true
      // current threads along the floor
      for (const th of threads) {
        for (let k = 0; k < 30; k++) {
          const s = k / 29, x = IMPACT.x + s * 2.9, z = IMPACT.z + s * 1.8 + th.sp * (0.5 + s * 3.2) + Math.sin(s * 6 + time * 1.7 + th.ph) * 0.09
          th.pts[k * 3] = Math.min(HALF - 0.04, x); th.pts[k * 3 + 1] = FLOOR_Y + 0.025 + Math.sin(s * 9 + time * 3 + th.ph) * 0.01; th.pts[k * 3 + 2] = Math.min(HALF - 0.04, z)
        }
        th.g.attributes.position.needsUpdate = true
        th.g.setDrawRange(0, Math.max(2, Math.round(30 * (0.25 + S.flow * 0.75))))
      }
      spray.m.flush(); fallP.m.flush(); plume.m.flush(); riverGlints.m.flush()
      for (const fw of fireworks) fw.P.m.flush()
      for (const t of towers) {
        const a = t.flag.geometry.attributes.position.array
        for (let i = 0; i < a.length; i += 3) a[i + 2] = Math.sin(t.base[i] * 24 + time * 6.5) * 0.018 * (t.base[i] + 0.11) * 8
        t.flag.geometry.attributes.position.needsUpdate = true
        t.g.rotation.z = t.wob * 0.05; t.g.scale.y = 1 + t.wob * 0.03
      }
      for (const pn of pines) { pn.piv.rotation.x = pn.bx + Math.sin(time * 1.3 + pn.i) * 0.025; pn.piv.rotation.z = pn.bz + jiggle * 0.08 }
      block.rotation.x = tiltX; block.rotation.z = tiltZ
      block.scale.set(1 - jiggle * 0.03, 1 + jiggle * 0.06, 1 - jiggle * 0.03)
      flame.scale.set(1 + stoke * 0.6, 1 + Math.sin(time * 14) * 0.15 + stoke, 1 + stoke * 0.6)
      catHop = Math.max(0, catHop - 0.045)
      catSprite.position.y = CAT_POS.y + Math.sin(time * 2.2) * 0.008 + Math.sin(catHop * Math.PI) * 0.25
      fallTex.offset.y = -time * 1.4
    }

    // ───────────────────────── loop ─────────────────────────
    let acc = 0, last = performance.now()
    const perf = { frames: 0, ms: 0 }
    // automatic quality: watch the frame rate, step down (resolution → shadows), and offer the old home if it stays very slow
    let warmT0 = 0, fpsFrames = 0, fpsT0 = 0, level = lite ? 1 : 2, settled = false, slowStreak = 0, readySent = false
    function setLevel(L) {
      level = L
      if (L <= 1 && pr !== 1) { pr = 1; renderer.setPixelRatio(1); renderer.setSize(W(), H()) }
      if (L === 0 && renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; sun.castShadow = false }
    }
    if (lite) setLevel(1)
    renderer.setAnimationLoop(now => {
      if (document.hidden) { last = now; return }
      const t0 = performance.now()
      const dt = Math.min(0.25, (now - last) / 1000); last = now
      if (!S.paused) { acc += dt; let n = 0; while (acc >= STEP && n < 10) { step(STEP); acc -= STEP; n++ } if (n >= 10) acc = 0 }
      look(); visuals(); beach?.update(dt); controls.update()
      renderer.render(scene, camera)
      writeCatAnchor(catAnchorRef, { sprite: catSprite, camera, canvas: renderer.domElement, head: CAT_HEAD, tmp: catTmp })
      perf.frames++; perf.ms += performance.now() - t0
      if (!readySent) { readySent = true; onReady?.() }
      // 처음 3초(셰이더 준비·텍스처 올리기)는 재지 않는다 — 그 순간의 끊김으로 해상도를 떨어뜨리지 않게
      if (!warmT0) warmT0 = now
      if (now - warmT0 < 3000) return
      if (!fpsT0) fpsT0 = now
      fpsFrames++
      // 해상도는 그대로 두는 것이 기본 — 3초 내내 30fps 밑일 때만 한 단계씩 내린다
      if (!settled && now - fpsT0 > 3000) {
        const fps = fpsFrames / ((now - fpsT0) / 1000)
        if (fps < 30 && level > 0) setLevel(level - 1); else settled = true
        fpsFrames = 0; fpsT0 = now
      } else if (settled && now - fpsT0 > 3000) {
        const fps = fpsFrames / ((now - fpsT0) / 1000)
        slowStreak = level === 0 && fps < 18 ? slowStreak + 1 : 0
        if (slowStreak === 3) onFallback?.('slow')
        fpsFrames = 0; fpsT0 = now
      }
    })
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix() })
    ro.observe(mount)
    bag.cleanup.push(() => ro.disconnect())
    if (renderer.backend?.device?.lost) renderer.backend.device.lost.then(info => { if (!bag.disposed && info?.reason !== 'destroyed') onFallback?.('lost') })
    renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); onFallback?.('lost') })
    bag.scene = scene
    if (process.env.NODE_ENV === 'development') window.__castle = {
      cmd: commandRef?.current, setLevel, pick: (x, y) => { const h = pickAt(x, y); return h && { kind: h.kind, name: h.obj.type } },
      counts: () => ({ pines: pines.length, coins: coins.length, balls: balls.length, shots: shots.length, restCoins: coins.filter(c => c.state === 'rest').length, level, pr, backend: renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2' }),
      info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, avgFrameMs: +(perf.ms / Math.max(1, perf.frames)).toFixed(2), level, pr }),
      resetPerf: () => { perf.frames = 0; perf.ms = 0 },
    }
}

export default function CastleStudyScene({ settingsRef, onPick, commandRef, onReady, onFallback, lite = false, catAnchorRef = null }) {
  const mountRef = useRef(null)
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const hasGPU = typeof navigator !== 'undefined' && !!navigator.gpu
    const probe = document.createElement('canvas')
    const gl2 = probe.getContext('webgl2')
    gl2?.getExtension('WEBGL_lose_context')?.loseContext()
    if (!hasGPU && !gl2) { onFallback?.('nowebgl'); return }
    const bag = { disposed: false, cleanup: [], renderer: null, scene: null }
    build(mount, { settingsRef, onPick, commandRef, onReady, onFallback, lite, catAnchorRef }, bag).catch(err => {
      console.error('Castle scene failed', err)
      if (!bag.disposed) onFallback?.('nowebgl')
    })
    return () => {
      bag.disposed = true
      bag.cleanup.forEach(f => { try { f() } catch {} })
      const r = bag.renderer
      if (r) {
        try { r.setAnimationLoop(null) } catch {}
        bag.scene?.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose?.() }) })
        try { r.dispose() } catch {}
        r.domElement.remove()
      }
      if (commandRef) commandRef.current = null
    }
  }, [])
  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
}
