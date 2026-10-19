'use client'
// Castle Jelly — 3D 메인 장면 (개발 중 · /castle 관리자·미리보기 학생 전용)
//   1단계(2026-10-19): 젤리 블록·절벽·성·폭포·범선·시간대·불꽃놀이·누르면 들어가기 단추.
//   2단계(2026-10-19): 물결 = 얕은 물 높이장 계산(96×96, 고정 간격) · 물보라 · 예포 · 소원 동전 ·
//     젤리 공 · 블록 기울이기 · 소나무 휘기.
//   4단계(2026-10-19): 레퍼런스 수준으로 —
//     물 = 전용 셰이더(굴절 재질 대신): 프레넬 반사·햇빛 반짝임·잔물결 법선·빛 무늬(커스틱)·거품(배 물길·폭포 아래).
//       굴절(transmission)은 화면을 한 번 더 그려야 해 폰에서 가장 비쌌다 — 빼면서 더 맑아지고 더 가벼워졌다.
//     물 몸통 = 투명한 옆면(깊을수록 진하게) + 바닥 빛 무늬 → 블록 옆에서 물속이 들여다보인다.
//     지층·절벽·잔디·모래 = 그려 만든 질감(물결진 경계·점박이) · 주변광 반사(환경맵) · 바닥 = 그림자만.
//     성 = 흰 벽·종 모양 지붕 탑 10개 · 소나무 = 3단 원뿔(인스턴스) · 덤불 · 범선 = 돛대 둘·돛 넷.
//
// 설계 규칙:
//  · 조절 값은 settingsRef 로 읽는다 — 슬라이더를 움직여도 장면을 다시 만들지 않는다.
//  · 물리는 고정 간격(1/60s) — 화면 주사율과 무관하게 같은 움직임.
//  · 탑·성문·배·화로를 누르면 onPick(종류, 화면 x, y) — 페이지가 그 자리에 「들어가기」 단추를 띄운다.
//  · 모든 계산은 블록 좌표계(block.worldToLocal) — 블록을 기울이거나 출렁여도 물·동전이 같이 간다.
//  · 품질 단계(level 3 → 0): 해상도 → 가벼운 물(빛 무늬 끔)·그림자 1024 → 그림자 끔. 느린 기기는 1에서 시작.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const FLAVOURS = {
  glacier: { lake: '#62cfe8', deep: '#1a88c2', label: '빙하' },
  rose:    { lake: '#f2a3bd', deep: '#c45a83', label: '로즈' },
  lilac:   { lake: '#bba8f0', deep: '#7457c9', label: '라일락' },
}

// 맛별 지층(위 → 아래). dots = 점박이 수
const PALETTES = {
  glacier: {
    block: [{ h: 0.16, c: '#ece4d4' }, { h: 0.09, c: '#cdd6da' }, { h: 0.26, c: '#e2cca6' }, { h: 0.2, c: '#f1e9db' }, { h: 0.3, c: '#b98f68', dots: 220 }, { h: 0.44, c: '#86634a', dots: 420 }],
    cliff: [{ h: 0.24, c: '#e7b7b6' }, { h: 0.2, c: '#dcc29b' }, { h: 0.14, c: '#c3ced4' }, { h: 0.22, c: '#efe3cf' }, { h: 0.3, c: '#dfb1aa' }, { h: 0.3, c: '#cdb48f' }, { h: 0.6, c: '#e8d9c0' }],
    sand: '#ece2cd', grass: '#8cc46a',
  },
  rose: {
    block: [{ h: 0.16, c: '#f7e3e6' }, { h: 0.09, c: '#e8cbd8' }, { h: 0.26, c: '#f3c3cf' }, { h: 0.2, c: '#fcf1e8' }, { h: 0.3, c: '#d996aa', dots: 220 }, { h: 0.44, c: '#a96a83', dots: 420 }],
    cliff: [{ h: 0.24, c: '#f2bcc9' }, { h: 0.2, c: '#f8dfd2' }, { h: 0.14, c: '#e6c6dc' }, { h: 0.22, c: '#fcefe6' }, { h: 0.3, c: '#eba7b9' }, { h: 0.3, c: '#e9c6b6' }, { h: 0.6, c: '#f5dfe0' }],
    sand: '#f8e6e4', grass: '#93c87a',
  },
  lilac: {
    block: [{ h: 0.16, c: '#eee8f6' }, { h: 0.09, c: '#d7d3ee' }, { h: 0.26, c: '#d8c8ef' }, { h: 0.2, c: '#f5f0f8' }, { h: 0.3, c: '#a993d4', dots: 220 }, { h: 0.44, c: '#7a679f', dots: 420 }],
    cliff: [{ h: 0.24, c: '#d9c6f0' }, { h: 0.2, c: '#f0e3ef' }, { h: 0.14, c: '#c6d0ee' }, { h: 0.22, c: '#f7f1f7' }, { h: 0.3, c: '#c7b1e6' }, { h: 0.3, c: '#e3d2e6' }, { h: 0.6, c: '#ece2f3' }],
    sand: '#f0eaf5', grass: '#8fc47a',
  },
}

const JELLY_TOP = 0.8 // 호수 물 깊이(투명 몸통) — 그 아래가 호수 바닥
const FLOOR_Y = -JELLY_TOP
const BLOCK_H = 1.45  // 호수 바닥 아래 지층 두께
const HALF = 3
const PLATEAU = { x0: -HALF, x1: -0.25, z0: -HALF, z1: -0.15, top: 1.3 }
const GRASS_T = 0.1
const CLIFF_H = PLATEAU.top - GRASS_T - FLOOR_Y
// 고원 바닥 윤곽(블록 좌표 xz) — 뒤쪽 두 변은 블록 벽에 붙고, 물 쪽 두 변은 살짝 물결지며 모서리는 둥글다
function plateauOutline(grow = 0) {
  const { x0, x1, z0, z1 } = PLATEAU
  const R = 0.55, pts = [], wob = (t, ph) => (Math.sin(t * 9 + ph) * 0.035 + Math.sin(t * 23 + ph * 2) * 0.012)
  pts.push([x0 + 0.005, z0 + 0.005], [x1 + grow, z0 + 0.005])
  for (let i = 1; i <= 14; i++) { const t = i / 14; pts.push([x1 + grow + wob(t, 1.3) * (t < 0.95 ? 1 : 0), z0 + (z1 - R - z0) * t]) }
  for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; pts.push([x1 - R + (R + grow) * Math.cos(a), z1 - R + (R + grow) * Math.sin(a)]) }
  for (let i = 1; i <= 14; i++) { const t = i / 14; pts.push([x1 - R - (x1 - R - x0 - 0.005) * t, z1 + grow + wob(t, 2.7) * (t < 0.95 ? 1 : 0)]) }
  return pts
}
const OUTLINE = plateauOutline(0)
function inPlateau(x, z) {
  let inside = false
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, zi] = OUTLINE[i], [xj, zj] = OUTLINE[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
function plateauGeo(depth, grow, bevel) {
  const sh = new THREE.Shape(plateauOutline(grow).map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ExtrudeGeometry(sh, { depth, steps: 1, curveSegments: 4, bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 })
  g.rotateX(-Math.PI / 2)
  return g
}
const N = 96            // 물 높이장 격자(정점과 1:1)
const CELL = (HALF * 2) / (N - 1)

function lerpColor(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t) }
function tri(t, a, b, c) { return t < 0.5 ? lerpColor(a, b, t * 2) : lerpColor(b, c, (t - 0.5) * 2) }
function triN(t, a, b, c) { return t < 0.5 ? a + (b - a) * t * 2 : b + (c - b) * (t - 0.5) * 2 }
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
function mixHex(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const A = p(a), B = p(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  draw(cv.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
// 지층 질감: 위 → 아래 띠, 경계는 물결, 띠 안에 가는 결·점박이, 경계에 밝은 선
function strataTexture(bands, seed, W = 1024, Hh = 256) {
  return canvasTex(W, Hh, g => {
    const R = rng(seed), total = bands.reduce((a, b) => a + b.h, 0)
    const phase = bands.map(() => R() * 6.28).concat([R() * 6.28])
    const ys = [0]; let acc = 0
    for (const b of bands) { acc += b.h; ys.push((acc / total) * Hh) }
    const edge = k => x => ys[k] + Math.sin(x * 0.011 + phase[k]) * Hh * 0.014 + Math.sin(x * 0.037 + phase[k] * 2) * Hh * 0.006
    bands.forEach((b, k) => {
      const top = k === 0 ? () => -2 : edge(k), bot = k === bands.length - 1 ? () => Hh + 2 : edge(k + 1)
      g.beginPath(); g.moveTo(0, top(0))
      for (let x = 0; x <= W; x += 6) g.lineTo(x, top(x))
      for (let x = W; x >= 0; x -= 6) g.lineTo(x, bot(x))
      g.closePath()
      const gr = g.createLinearGradient(0, ys[k], 0, ys[k + 1])
      gr.addColorStop(0, mixHex(b.c, '#ffffff', 0.14)); gr.addColorStop(1, mixHex(b.c, '#000000', 0.05))
      g.fillStyle = gr; g.fill()
      g.save(); g.clip()
      g.globalAlpha = 0.12; g.strokeStyle = mixHex(b.c, '#000000', 0.3); g.lineWidth = 1
      for (let i = 0; i < 6; i++) {
        const yy = ys[k] + R() * (ys[k + 1] - ys[k])
        g.beginPath()
        for (let x = 0; x <= W; x += 8) { const yv = yy + Math.sin(x * 0.02 + i * 1.7) * 1.4; x ? g.lineTo(x, yv) : g.moveTo(x, yv) }
        g.stroke()
      }
      g.globalAlpha = 1
      if (b.dots) {
        g.fillStyle = 'rgba(255,246,230,0.8)'
        for (let i = 0; i < b.dots; i++) { g.beginPath(); g.arc(R() * W, ys[k] + R() * (ys[k + 1] - ys[k]), 0.7 + R() * 1.5, 0, 6.29); g.fill() }
      }
      g.restore()
      if (k > 0) {
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.2; g.beginPath()
        for (let x = 0; x <= W; x += 6) { const yv = top(x); x ? g.lineTo(x, yv) : g.moveTo(x, yv) }
        g.stroke()
      }
    })
  })
}
function speckleTexture(base, spots, seed, size = 256, n = 1400) {
  const t = canvasTex(size, size, (g, w, h) => {
    const R = rng(seed)
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.25 + R() * 0.45
      g.fillStyle = spots[Math.floor(R() * spots.length)]
      g.beginPath(); g.arc(R() * w, R() * h, 0.8 + R() * 2.6, 0, 6.29); g.fill()
    }
    g.globalAlpha = 1
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// 물 빛 무늬(커스틱) — 반복 왜곡 합(가볍다: 반복 4번, 텍스처 0)
const CAUSTIC_GLSL = /* glsl */`
float caustic(vec2 p, float t) {
  vec2 q = mod(p * 6.2831, 6.2831) - 250.0;
  vec2 i = q; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}`

const SURFACE_VS = /* glsl */`
attribute float wet;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vWet;
void main() {
  vUv = uv; vWet = wet;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const SURFACE_FS = /* glsl */`
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform float uTime; uniform float uLight; uniform float uCaustic; uniform sampler2D uFoam;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vWet;
${CAUSTIC_GLSL}
void main() {
  if (vWet < 0.5) discard;
  vec2 q = vW.xz;
  // 잔물결 법선(높이장보다 잘게)
  float a = q.x * 9.0 + uTime * 1.7, b = q.y * 7.0 - uTime * 1.3;
  vec2 dn = vec2(cos(a) * cos(b), -sin(a) * sin(b)) * 0.035
          + vec2(sin(q.y * 13.0 + uTime * 2.1), cos(q.x * 11.0 - uTime * 1.9)) * 0.02;
  vec3 n = normalize(normalize(vN) + vec3(dn.x, 0.0, dn.y));
  vec3 V = normalize(cameraPosition - vW);
  float ndv = max(dot(n, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 col = mix(uShallow, uDeep, 0.42);
#ifndef LITE
  float c = caustic(q * 0.9, uTime * 0.45);
  col += vec3(0.9, 0.98, 1.0) * c * 0.9 * uCaustic;
#else
  float c = 0.0;
#endif
  col = mix(col, uSky, clamp(fres * 0.55, 0.0, 0.6));
  vec3 R = reflect(-uSunDir, n);
  float rv = max(dot(R, V), 0.0);
  float spec = pow(rv, 220.0) * 3.0 + pow(rv, 30.0) * 0.18;
  // 물결 마루(기울기가 큰 곳)를 밝게 — 퍼져 나가는 동심원이 눈에 보인다
  float slope = 1.0 - clamp(normalize(vN).y, 0.0, 1.0);
  col += vec3(1.0) * smoothstep(0.012, 0.09, slope) * 0.32;
  col = col * uLight + uSunCol * spec;
  float foam = texture2D(uFoam, vUv).r;
  foam = smoothstep(0.12, 0.6, foam * (0.75 + 0.5 * c + 0.25 * sin(q.x * 40.0 + q.y * 31.0)));
  col = mix(col, vec3(0.98) * max(uLight, 0.35), foam);
  float alpha = clamp(0.58 + c * 0.25 + fres * 0.4 + foam * 0.7 + spec, 0.0, 0.97);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// 물 몸통 옆면 — 위는 맑고 아래로 진하게, 빛 무늬가 일렁인다, 수면 선은 밝게
const VOLUME_VS = /* glsl */`
varying vec3 vP; varying vec3 vLN; varying vec3 vW;
void main() {
  vP = position; vLN = normal;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const VOLUME_FS = /* glsl */`
uniform vec3 uShallow; uniform vec3 uDeep; uniform float uTime; uniform float uLight; uniform float uCaustic; uniform float uDepth;
varying vec3 vP; varying vec3 vLN; varying vec3 vW;
${CAUSTIC_GLSL}
void main() {
  if (abs(vLN.y) > 0.5) discard; // 위·아래 면은 그리지 않는다(위 = 수면 셰이더)
  float t = clamp((vP.y + uDepth) / uDepth, 0.0, 1.0); // 0 = 바닥, 1 = 수면(물결 따라 오르내린다)
  vec3 col = mix(uDeep, uShallow, pow(t, 0.8));
#ifndef LITE
  vec2 q = vec2(vP.x + vP.z, vP.y * 1.8);
  float c = caustic(q * 0.9 + vec2(0.0, uTime * 0.05), uTime * 0.4);
  col += vec3(0.85, 0.97, 1.0) * c * 0.55 * uCaustic * (0.35 + 0.65 * t);
#endif
  float rim = smoothstep(0.9, 1.02, t);
  col = col * uLight + vec3(1.0) * rim * 0.55 * max(uLight, 0.3);
  float alpha = 0.42 + (1.0 - t) * 0.3 + rim * 0.4;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

// 폭포 물줄기 리본 — 아래로 흐르는 줄무늬
const FALL_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FALL_FS = /* glsl */`
uniform float uTime; uniform float uFlow; uniform float uLight;
varying vec2 vUv;
void main() {
  float s = sin(vUv.x * 41.0 + sin(vUv.x * 7.0) * 2.0) * 0.5 + 0.5;
  float flowLines = sin((vUv.y + uTime * 1.6) * 18.0 + vUv.x * 9.0) * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float a = edge * (0.62 + 0.38 * s * flowLines) * (0.3 + 0.7 * uFlow);
  vec3 col = mix(vec3(0.72, 0.9, 0.98), vec3(1.0), 0.55 + 0.45 * flowLines) * max(uLight, 0.35);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export default function CastleJellyScene({ settingsRef, onPick, commandRef, onReady, onFallback, lite = false }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = () => mount.clientWidth, H = () => mount.clientHeight
    const narrow = () => W() < 760

    // ── 느린 기기 대비 ───────────────────────────────────────────
    // ① 3D 를 못 그리는 기기 = 바로 대체 화면(조용히 빈 화면 금지)
    {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2') || probe.getContext('webgl')
      if (!gl) { onFallback?.('nowebgl'); return }
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    // ② 처음부터 가벼운 품질: 사용자가 「가벼운 모드」를 골랐거나, 메모리·코어가 적은 기기
    const nav = typeof navigator !== 'undefined' ? navigator : {}
    const weak = lite || (nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4)

    // ── 렌더러 · 카메라 ──────────────────────────────────────────
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !weak, alpha: true, powerPreference: weak ? 'low-power' : 'high-performance' })
    } catch { onFallback?.('nowebgl'); return }
    const dpr = window.devicePixelRatio || 1
    let pr = weak ? 1 : Math.min(narrow() ? 1.5 : 2, dpr)
    renderer.setPixelRatio(pr)
    renderer.setSize(W(), H())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping // ACES 는 밝은 하늘색을 우유빛으로 바랜다 — 채도를 지키는 쪽
    renderer.toneMappingExposure = 0.95
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // 주변광 반사(환경맵) — 한 번만 굽는다
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    scene.environment = envTex

    const camera = new THREE.PerspectiveCamera(32, W() / H(), 0.1, 100)
    const placeCamera = () => {
      const d = narrow() ? 26 : 18.5
      camera.position.set(d * 0.6, d * 0.5, d * 0.75)
      camera.lookAt(0, 0.35, 0)
    }
    placeCamera()
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.35, 0)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 10; controls.maxDistance = 30
    controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.25
    controls.update()

    // ── 빛 ───────────────────────────────────────────────────────
    const hemi = new THREE.HemisphereLight('#ffffff', '#d9c9ae', 0.6)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight('#ffffff', 2.4)
    sun.castShadow = true
    sun.shadow.mapSize.set(weak ? 1024 : 2048, weak ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 40 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.02
    sun.shadow.radius = 4
    scene.add(sun, sun.target)

    const textures = [envTex]
    const keepTex = t => { textures.push(t); return t }
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, ...o })
    const glossy = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 })
    const gold = new THREE.MeshStandardMaterial({ color: '#e7b84a', metalness: 0.85, roughness: 0.25 })
    const add = (m, x, y, z, parent) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }

    // ── 탁자 = 그림자만 받는 바닥(배경은 페이지 색) ───────────────
    const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }))
    table.rotation.x = -Math.PI / 2
    table.position.y = FLOOR_Y - BLOCK_H - 0.01
    table.receiveShadow = true
    scene.add(table)

    // ── 블록 ─────────────────────────────────────────────────────
    const block = new THREE.Group()
    scene.add(block)
    const texCache = {}
    const paletteTex = key => {
      if (texCache[key]) return texCache[key]
      const p = PALETTES[key] || PALETTES.glacier
      const t = {
        block: keepTex(strataTexture(p.block, 11, 1024, 256)),
        cliff: keepTex(strataTexture(p.cliff, 23, 512, 512)),
        sand: keepTex(speckleTexture(p.sand, ['#ffffff', '#d8ccb4', '#cbbfa6'], 5, 256, 1600)),
        grass: keepTex(speckleTexture(p.grass, ['#7cb75c', '#a2d27a', '#6aa451', '#b5dc8a'], 7, 256, 1800)),
      }
      t.grass.repeat.set(0.8, 0.8)
      // 둥근 절벽 옆면: u = 둘레(월드 단위), v = 높이(바닥 0 → 위 1)
      t.cliff.wrapS = THREE.RepeatWrapping
      t.cliff.repeat.set(1 / 2.6, -1 / CLIFF_H); t.cliff.offset.set(0, 1 / CLIFF_H)
      return (texCache[key] = t)
    }
    let tex = paletteTex('glacier')

    // 지층 블록(호수 바닥 아래) — 옆 네 면 = 지층 질감
    const strataSide = mat('#ffffff', { map: tex.block, roughness: 0.85 })
    const strataCap = mat('#7d5d46', { roughness: 0.9 })
    const strata = add(new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, BLOCK_H - 0.006, HALF * 2), [strataSide, strataSide, strataCap, strataCap, strataSide, strataSide]), 0, FLOOR_Y - 0.006 - (BLOCK_H - 0.006) / 2, 0, block) // 윗면이 호수 바닥과 겹치면 줄무늬로 깜빡인다
    strata.userData.pick = 'block'

    // 호수 바닥 — 모래 질감 + 빛 무늬(셰이더 주입: 절차 무늬 + 물결이 모으는 빛)
    const causticData = new Uint8Array(N * N * 4)
    const causticTex = new THREE.DataTexture(causticData, N, N, THREE.RGBAFormat)
    causticTex.magFilter = THREE.LinearFilter; causticTex.minFilter = THREE.LinearFilter
    causticTex.needsUpdate = true
    const shared = { uTime: { value: 0 }, uCaustic: { value: 1 }, uLight: { value: 1 } }
    const floorMat = mat('#ffffff', { map: tex.sand, roughness: 0.92 })
    floorMat.onBeforeCompile = sh => {
      sh.uniforms.uTime = shared.uTime; sh.uniforms.uCaustic = shared.uCaustic; sh.uniforms.uDyn = { value: causticTex }
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uCaustic; uniform sampler2D uDyn;\n' + CAUSTIC_GLSL)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { vec2 q = vec2(vMapUv.x - 0.5, 0.5 - vMapUv.y) * 6.0;
            float cc = caustic(q * 0.9, uTime * 0.45);
            totalEmissiveRadiance += vec3(0.85, 0.96, 1.0) * (cc * 0.75 + texture2D(uDyn, vMapUv).a * 0.8) * uCaustic; }`)
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = FLOOR_Y
    floor.receiveShadow = true
    floor.userData.pick = 'block'
    block.add(floor)

    // 물 몸통 옆면
    const flavourColors = f => ({ s: new THREE.Color(f.lake), d: new THREE.Color(f.deep) })
    let fc = flavourColors(FLAVOURS.glacier)
    const volumeMat = new THREE.ShaderMaterial({
      vertexShader: VOLUME_VS, fragmentShader: VOLUME_FS, transparent: true, depthWrite: false,
      uniforms: { uShallow: { value: fc.s }, uDeep: { value: fc.d }, uTime: shared.uTime, uLight: shared.uLight, uCaustic: shared.uCaustic, uDepth: { value: JELLY_TOP } },
    })
    // 물 몸통 = 네 옆벽 띠. 윗변 정점이 가장자리 물 높이를 따라 오르내린다(물결이 벽에 닿으면 수면선이 출렁인다)
    const wallTop = [] // [정점 번호, 높이장 칸]
    const volumeGeo = (() => {
      const pos = [], nor = [], idx = []
      const sides = [
        { n: [0, 0, 1], at: k => [-HALF + k * CELL, HALF], cell: k => (N - 1) * N + k, flip: false },
        { n: [0, 0, -1], at: k => [-HALF + k * CELL, -HALF], cell: k => k, flip: true },
        { n: [1, 0, 0], at: k => [HALF, -HALF + k * CELL], cell: k => k * N + N - 1, flip: true },
        { n: [-1, 0, 0], at: k => [-HALF, -HALF + k * CELL], cell: k => k * N, flip: false },
      ]
      for (const sd of sides) {
        const base = pos.length / 3
        for (let k = 0; k < N; k++) {
          const [x, z] = sd.at(k)
          pos.push(x, FLOOR_Y, z, x, 0, z); nor.push(...sd.n, ...sd.n)
          wallTop.push(base + k * 2 + 1, sd.cell(k))
        }
        for (let k = 0; k < N - 1; k++) {
          const a = base + k * 2
          if (sd.flip) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx)
      return g
    })()
    const volume = new THREE.Mesh(volumeGeo, volumeMat)
    volume.frustumCulled = false
    volume.renderOrder = 1
    volume.userData.pick = 'block'
    block.add(volume)

    // 수면 — 정점 = 높이장 격자(N×N), 절벽 칸은 wet 0 → 그리지 않는다
    const lakeGeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N - 1, N - 1)
    lakeGeo.rotateX(-Math.PI / 2) // 행 0 = z -3, 열 0 = x -3
    const wetAttr = new Float32Array(N * N)
    lakeGeo.setAttribute('wet', new THREE.BufferAttribute(wetAttr, 1))
    const foam = new Float32Array(N * N)
    const foamData = new Uint8Array(N * N * 4)
    const foamTex = new THREE.DataTexture(foamData, N, N, THREE.RGBAFormat)
    foamTex.magFilter = THREE.LinearFilter; foamTex.minFilter = THREE.LinearFilter
    foamTex.needsUpdate = true
    const sunDirU = new THREE.Vector3(0.5, 0.8, 0.3).normalize()
    const lakeMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VS, fragmentShader: SURFACE_FS, transparent: true, depthWrite: false,
      uniforms: {
        uShallow: { value: fc.s }, uDeep: { value: fc.d }, uSky: { value: new THREE.Color('#eef6ff') },
        uSunDir: { value: sunDirU }, uSunCol: { value: new THREE.Color('#ffffff') },
        uTime: shared.uTime, uLight: shared.uLight, uCaustic: shared.uCaustic, uFoam: { value: foamTex },
      },
    })
    const lake = new THREE.Mesh(lakeGeo, lakeMat)
    lake.renderOrder = 2
    lake.userData.pick = 'lake'
    block.add(lake)
    const setLite = on => {
      for (const m of [lakeMat, volumeMat]) {
        if (on) m.defines = { LITE: 1 }; else m.defines = {}
        m.needsUpdate = true
      }
    }

    // ── 물 높이장 ────────────────────────────────────────────────
    const h = new Float32Array(N * N), v = new Float32Array(N * N)
    const solid = new Uint8Array(N * N)
    const gx = x => Math.round((x + HALF) / CELL), gz = z => Math.round((z + HALF) / CELL)
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = -HALF + c * CELL, z = -HALF + r * CELL
      const i = r * N + c
      if (inPlateau(x, z)) solid[i] = 1
      wetAttr[i] = solid[i] ? 0 : 1
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
    // 거품 찍기(배 물길·폭포 아래·물보라)
    const addFoam = (x, z, amt, rad = 1.4) => {
      const cc = gx(x), rr = gz(z), R = Math.ceil(rad * 1.8)
      for (let r = rr - R; r <= rr + R; r++) for (let c = cc - R; c <= cc + R; c++) {
        if (r < 0 || c < 0 || r >= N || c >= N) continue
        const i = r * N + c
        if (solid[i]) continue
        const d2 = ((r - rr) ** 2 + (c - cc) ** 2) / (rad * rad)
        foam[i] = Math.min(1, foam[i] + amt * Math.exp(-d2))
      }
    }
    const sampleH = (x, z) => {
      const fc2 = Math.min(N - 1.001, Math.max(0, (x + HALF) / CELL)), fr = Math.min(N - 1.001, Math.max(0, (z + HALF) / CELL))
      const c = Math.floor(fc2), r = Math.floor(fr), tx = fc2 - c, tz = fr - r
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

    // 물방울 모양(둥글고 가장자리가 흐린 점)
    const dropTex = keepTex(canvasTex(64, 64, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr; g.fillRect(0, 0, w, w)
    }))
    // 젤리 속 물줄기 방울
    const plumeN = 220
    const plumeGeo = new THREE.BufferGeometry()
    const plumePos = new Float32Array(plumeN * 3).fill(-99)
    const plumeVel = new Float32Array(plumeN * 3)
    const plumeLife = new Float32Array(plumeN)
    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3))
    block.add(new THREE.Points(plumeGeo, new THREE.PointsMaterial({ color: '#ffffff', map: dropTex, size: 0.06, transparent: true, opacity: 0.6, depthWrite: false })))

    // 물보라 · 물기둥(공용 입자)
    const sprayN = weak ? 500 : 900
    const sprayGeo = new THREE.BufferGeometry()
    const sprayPos = new Float32Array(sprayN * 3).fill(-99)
    const sprayVel = new Float32Array(sprayN * 3)
    const sprayLife = new Float32Array(sprayN)
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3))
    block.add(new THREE.Points(sprayGeo, new THREE.PointsMaterial({ color: '#ffffff', map: dropTex, size: 0.11, transparent: true, opacity: 0.95, depthWrite: false })))
    let sprayHead = 0
    const spray = (x, z, n, up = 1.6, spreadV = 0.6) => {
      for (let k = 0; k < n; k++) {
        const j = sprayHead++ % sprayN
        sprayPos[j * 3] = x + (Math.random() - 0.5) * 0.1; sprayPos[j * 3 + 1] = 0.02; sprayPos[j * 3 + 2] = z + (Math.random() - 0.5) * 0.1
        const a = Math.random() * Math.PI * 2, s = Math.random() * spreadV
        sprayVel[j * 3] = Math.cos(a) * s; sprayVel[j * 3 + 1] = up * (0.5 + Math.random() * 0.7); sprayVel[j * 3 + 2] = Math.sin(a) * s
        sprayLife[j] = 0.6 + Math.random() * 0.6
      }
      addFoam(x, z, Math.min(0.6, n * 0.02), 1.6)
    }

    // ── 절벽 고원 ────────────────────────────────────────────────
    const P = PLATEAU
    const pw = P.x1 - P.x0, pd = P.z1 - P.z0, pcx = (P.x0 + P.x1) / 2, pcz = (P.z0 + P.z1) / 2
    const cliffSide = mat('#ffffff', { map: tex.cliff, roughness: 0.85 })
    const cliffTop = mat('#c9b48f', { roughness: 0.9 })
    // 둥근 윤곽으로 밀어 올린 절벽(옆면 = 지층 질감) + 그 위 잔디판(가장자리를 둥글게 깎는다)
    add(new THREE.Mesh(plateauGeo(CLIFF_H, 0, 0), [cliffTop, cliffSide]), 0, FLOOR_Y, 0, block).userData.pick = 'block'
    const grassMat = mat('#ffffff', { map: tex.grass, roughness: 0.95 })
    const grassSide = mat('#6fa954', { roughness: 0.9 })
    const grass = add(new THREE.Mesh(plateauGeo(GRASS_T - 0.06, -0.01, 0.03), [grassMat, grassSide]), 0, P.top - GRASS_T + 0.03, 0, block)
    grass.userData.pick = 'block'
    // 물가 바위(물속에 반쯤)
    // 호수 바닥 바위(물속에 잠겨 보인다)
    const rockMat = mat('#7f8a8c', { roughness: 0.85 })
    ;[[0.15, -0.9, 0.2], [0.2, -2.3, 0.16], [-1.3, 0.2, 0.18], [-2.4, 0.15, 0.14], [2.1, 2.3, 0.22], [-1.9, 1.7, 0.16], [2.4, -0.4, 0.15]].forEach(([x, z, r], i) => {
      const m = add(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), rockMat), x, FLOOR_Y + r * 0.3, z, block)
      m.scale.set(1, 0.6, 0.85); m.rotation.y = i * 1.1
    })
    // 물풀
    {
      const parts = []
      for (let i = 0; i < 18; i++) {
        const x = 1.2 + (i % 6) * 0.13 + Math.sin(i * 2.3) * 0.08, z = -2.5 + Math.floor(i / 6) * 0.18
        parts.push(new THREE.CylinderGeometry(0.006, 0.01, 0.55, 4).translate(x, FLOOR_Y + 0.27, z))
      }
      add(new THREE.Mesh(mergeGeometries(parts), mat('#5f8f4a')), 0, 0, 0, block).castShadow = false
      parts.forEach(g => g.dispose())
    }

    // 강 · 샘
    const riverZ = -0.6
    const riverMat = new THREE.MeshPhysicalMaterial({ color: '#9fdcef', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 })
    add(new THREE.Mesh(new THREE.BoxGeometry(pw - 0.25, 0.02, 0.24), riverMat), (P.x0 + 0.25 + P.x1) / 2, P.top + 0.006, riverZ, block)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24), riverMat), P.x0 + 0.32, P.top + 0.01, riverZ, block)

    // ── 성 ───────────────────────────────────────────────────────
    const castle = new THREE.Group()
    castle.position.set(-1.75, P.top, -1.95)
    block.add(castle)
    const wallMat = mat('#fbf6ec', { roughness: 0.7 })
    const towerMat = mat('#fffaf2', { roughness: 0.65 })
    const trimMat = mat('#efe6d6', { roughness: 0.7 })
    const windowMat = new THREE.MeshStandardMaterial({ color: '#3b3550', emissive: '#ffcf7a', emissiveIntensity: 0 })
    const S = 0.9
    const wallH = 0.42
    {
      // 성벽 4면 + 총안(한 덩어리로 합쳐 그리기 횟수를 줄인다)
      const parts = []
      ;[[0, -S, 2 * S, 0.12], [0, S, 2 * S, 0.12], [-S, 0, 0.12, 2 * S], [S, 0, 0.12, 2 * S]].forEach(([x, z, w, d]) => {
        parts.push(new THREE.BoxGeometry(w, wallH, d).translate(x, wallH / 2, z))
        for (let i = 0; i < 9; i++) {
          const t = -1 + (2 * i + 1) / 9
          parts.push(new THREE.BoxGeometry(w > d ? 0.09 : 0.15, 0.09, w > d ? 0.15 : 0.09).translate(w > d ? x + t * (w / 2) : x, wallH + 0.045, w > d ? z : z + t * (d / 2)))
        }
      })
      add(new THREE.Mesh(mergeGeometries(parts), wallMat), 0, 0, 0, castle)
      parts.forEach(g => g.dispose())
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 0.6), towerMat), -0.05, 0.35, -0.15, castle)
    const hallRoof = add(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.48, 4), glossy('#a9c4f2')), -0.05, 0.94, -0.15, castle)
    hallRoof.rotation.y = Math.PI / 4; hallRoof.scale.set(1, 1, 0.75)
    const winGeo = new THREE.PlaneGeometry(0.07, 0.13)
    const addWin = (x, yy, z, parent, ry = 0) => { const w = new THREE.Mesh(winGeo, windowMat); w.position.set(x, yy, z); w.rotation.y = ry; parent.add(w) }
    ;[-0.3, -0.05, 0.2].forEach(x => { addWin(x, 0.42, 0.152, castle); addWin(x, 0.2, 0.152, castle) })
    // 종 모양 지붕(아래가 살짝 퍼진다)
    const roofCache = {}
    const roofGeo = (r, ht) => {
      const key = `${r}_${ht}`
      if (roofCache[key]) return roofCache[key]
      const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 1.2, 0), new THREE.Vector2(r * 1.18, ht * 0.04)]
      for (let i = 1; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.max(0.002, r * 1.12 * Math.pow(1 - t, 1.35)), ht * (0.04 + 0.96 * t))) }
      return (roofCache[key] = new THREE.LatheGeometry(pts, 28))
    }
    const towers = []
    ;[
      [-S, S, 0.2, 0.9, '#f2a7c3'], [S, S, 0.2, 0.95, '#a9c4f2'],
      [-S, -S, 0.2, 1.0, '#c8b3ef'], [S, -S, 0.2, 0.95, '#f2a7c3'],
      [0, -S, 0.16, 1.2, '#a9c4f2'], [-S, 0, 0.15, 1.05, '#c8b3ef'],
      [0.32, -0.32, 0.17, 1.75, '#c8b3ef'], [-0.38, -0.48, 0.18, 1.5, '#f2a7c3'],
      [0.05, 0.12, 0.15, 1.3, '#a9c4f2'], [0.5, 0.38, 0.13, 1.08, '#f2a7c3'],
    ].forEach(([x, z, r, ht, roof]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); castle.add(g)
      const body = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, ht, 28), towerMat), 0, ht / 2, 0, g)
      add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.05, 28), trimMat), 0, ht - 0.02, 0, g)
      const roofH = r * 3.6
      const cone = add(new THREE.Mesh(roofGeo(r, roofH), glossy(roof)), 0, ht, 0, g)
      add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), gold), 0, ht + roofH + 0.02, 0, g)
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09, 6, 1), new THREE.MeshStandardMaterial({ color: roof, side: THREE.DoubleSide }))
      flag.position.set(0.11, ht + roofH + 0.15, 0); g.add(flag)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), mat('#c99a35')); pole.position.set(0, ht + roofH + 0.11, 0); g.add(pole)
      addWin(0, ht * 0.62, r + 0.002, g)
      if (ht > 1.2) addWin(0, ht * 0.35, r + 0.002, g)
      body.userData.pick = 'tower'; cone.userData.pick = 'tower'; body.userData.towerIdx = towers.length; cone.userData.towerIdx = towers.length
      towers.push({ g, flag, flagBase: flag.geometry.attributes.position.array.slice(), top: new THREE.Vector3(x, ht + roofH, z), wob: 0, wobV: 0 })
    })
    const gate = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.06), mat('#7a5a3e')), 0, 0.17, S + 0.04, castle)
    gate.userData.pick = 'gate'
    const gateArch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20, 1, false, 0, Math.PI), mat('#7a5a3e')), 0, 0.34, S + 0.04, castle)
    gateArch.rotation.x = Math.PI / 2; gateArch.rotation.y = Math.PI / 2; gateArch.userData.pick = 'gate'
    const bridgeHinge = new THREE.Group(); bridgeHinge.position.set(0, 0.02, S + 0.07); castle.add(bridgeHinge)
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.62), mat('#b98b5e')), 0, 0, 0.31, bridgeHinge).userData.pick = 'gate'
    const brazier = new THREE.Group(); brazier.position.set(0.55, 0, S + 0.35); castle.add(brazier)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.14, 12), mat('#4d4040')), 0, 0.07, 0, brazier).userData.pick = 'brazier'
    const flame = add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#ff9d4d', emissive: '#ff7a1a', emissiveIntensity: 1.5 })), 0, 0.2, 0, brazier)
    flame.castShadow = false; flame.userData.pick = 'brazier'
    const fireLight = new THREE.PointLight('#ffaa55', 0.6, 3, 1.6); fireLight.position.set(0, 0.35, 0); brazier.add(fireLight)

    // 냥밭 고양이 — 학생이 고른 농부냥이 성 마당에 나와 있다(누르면 냥밭)
    const catSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
    catSprite.scale.set(0.42, 0.54, 1)
    const CAT_X = -1.15, CAT_Z = -0.32
    catSprite.position.set(CAT_X, P.top + 0.27, CAT_Z)
    catSprite.userData.pick = 'cat'
    catSprite.visible = false
    block.add(catSprite)
    let catUrl = null
    const texLoader = new THREE.TextureLoader()
    const loadCat = url => {
      catUrl = url
      if (!url) { catSprite.visible = false; return }
      texLoader.load(url, t => {
        if (catUrl !== url) { t.dispose(); return }
        t.colorSpace = THREE.SRGBColorSpace
        catSprite.material.map?.dispose()
        catSprite.material.map = t; catSprite.material.needsUpdate = true
        const a = t.image.width / t.image.height
        catSprite.scale.set(0.54 * a, 0.54, 1)
        catSprite.visible = true
      })
    }
    let catHop = 0

    // ── 나무 · 덤불 ──────────────────────────────────────────────
    // 소나무 = 3단 원뿔(합친 하나) + 줄기. 끌어서 휘는 다섯 그루는 따로, 나머지는 인스턴스.
    const pineGeo = (() => {
      const parts = [
        new THREE.ConeGeometry(0.17, 0.3, 10).translate(0, 0.2, 0),
        new THREE.ConeGeometry(0.14, 0.26, 10).translate(0, 0.36, 0),
        new THREE.ConeGeometry(0.1, 0.22, 10).translate(0, 0.5, 0),
      ]
      const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g
    })()
    const trunkGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.12, 6).translate(0, 0.06, 0)
    const pineMat = mat('#3e8a55', { roughness: 0.75 })
    const trunkMat = mat('#7a5a3e')
    const pines = []
    ;[[-0.45, -0.95, 1.05], [-2.88, -0.32, 0.95], [-0.42, -2.6, 1.1], [-2.86, -2.05, 1.0], [-1.6, -0.28, 0.9]].forEach(([x, z, s], i) => {
      const pivot = new THREE.Group(); pivot.position.set(x, P.top, z); pivot.scale.setScalar(s); block.add(pivot)
      const t = add(new THREE.Mesh(pineGeo, pineMat), 0, 0, 0, pivot)
      add(new THREE.Mesh(trunkGeo, trunkMat), 0, 0, 0, pivot)
      t.userData.pick = 'pine'; t.userData.pineIdx = i
      pines.push({ pivot, bx: 0, bz: 0, vx: 0, vz: 0, held: false, i })
    })
    const deco = [[-0.48, -1.35, 0.85], [-0.4, -1.85, 0.95], [-0.5, -2.95, 0.8], [-2.9, -1.3, 0.9], [-2.88, -2.85, 0.85],
      [-2.35, -0.25, 0.8], [-2.05, -0.95, 0.7], [-1.95, -0.28, 0.7], [-2.9, -0.85, 0.75], [-1.05, -0.95, 0.65], [-0.6, -2.25, 0.7]]
    const decoPine = new THREE.InstancedMesh(pineGeo, pineMat, deco.length)
    const decoTrunk = new THREE.InstancedMesh(trunkGeo, trunkMat, deco.length)
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3()
    deco.forEach(([x, z, s], i) => {
      m4.compose(new THREE.Vector3(x, P.top, z), q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.3), s4.setScalar(s))
      decoPine.setMatrixAt(i, m4); decoTrunk.setMatrixAt(i, m4)
    })
    for (const im of [decoPine, decoTrunk]) { im.castShadow = true; im.receiveShadow = true; block.add(im) }
    // 덤불(강가·성벽 앞)
    const bushPos = []
    { const R = rng(31)
      for (let i = 0; i < 26; i++) {
        const side = i % 3
        const x = side === 0 ? -2.7 + R() * 2.3 : side === 1 ? -2.7 + R() * 2.3 : -0.6 + R() * 0.3
        const z = side === 0 ? -0.43 + R() * 0.08 : side === 1 ? -0.8 - R() * 0.1 : -1.1 - R() * 1.7
        if (Math.hypot(x - CAT_X, z - CAT_Z) < 0.25) continue
        bushPos.push([x, z, 0.6 + R() * 0.7])
      } }
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 1), mat('#ffffff', { roughness: 0.8 }), bushPos.length)
    const bushCol = ['#6fb26a', '#82c070', '#5ea35c', '#f2b6cb']
    bushPos.forEach(([x, z, s], i) => {
      m4.compose(new THREE.Vector3(x, P.top + 0.04 * s, z), q4.identity(), s4.set(s, s * 0.8, s))
      bushes.setMatrixAt(i, m4)
      bushes.setColorAt(i, new THREE.Color(bushCol[i % 7 === 0 ? 3 : i % 3]))
    })
    bushes.castShadow = true; bushes.receiveShadow = true
    block.add(bushes)

    // ── 폭포 ─────────────────────────────────────────────────────
    const lip = new THREE.Vector3(P.x1 + 0.02, P.top - 0.02, riverZ)
    const FALL_VX = 0.62, G = 6.5
    const fallT = Math.sqrt((2 * lip.y) / G)
    const impact = new THREE.Vector3(lip.x + FALL_VX * fallT, 0, riverZ)
    // 물줄기 리본(포물선)
    {
      const segs = 24, wid = 0.24
      const pos = new Float32Array((segs + 1) * 2 * 3), uv = new Float32Array((segs + 1) * 2 * 2), idx = []
      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * fallT
        const x = lip.x + FALL_VX * t, yy = lip.y - 0.5 * G * t * t
        for (let s = 0; s < 2; s++) {
          const k = i * 2 + s
          pos[k * 3] = x; pos[k * 3 + 1] = yy; pos[k * 3 + 2] = riverZ + (s - 0.5) * wid * (1 + i / segs * 0.4)
          uv[k * 2] = s; uv[k * 2 + 1] = i / segs
        }
        if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx)
      var fallMat = new THREE.ShaderMaterial({ vertexShader: FALL_VS, fragmentShader: FALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: shared.uTime, uFlow: { value: 0.6 }, uLight: shared.uLight } })
      const ribbon = new THREE.Mesh(g, fallMat); ribbon.renderOrder = 3; block.add(ribbon)
    }
    const fallN = weak ? 160 : 320
    const fallGeo = new THREE.BufferGeometry()
    const fallPos = new Float32Array(fallN * 3), fallVel = new Float32Array(fallN * 3)
    fallGeo.setAttribute('position', new THREE.BufferAttribute(fallPos, 3))
    block.add(new THREE.Points(fallGeo, new THREE.PointsMaterial({ color: '#f2fbff', map: dropTex, size: 0.07, transparent: true, opacity: 0.75, depthWrite: false })))
    const respawnFall = i => {
      fallPos[i * 3] = lip.x + Math.random() * 0.03
      fallPos[i * 3 + 1] = lip.y + Math.random() * 0.02
      fallPos[i * 3 + 2] = lip.z + (Math.random() - 0.5) * 0.28
      fallVel[i * 3] = FALL_VX * (0.85 + Math.random() * 0.3); fallVel[i * 3 + 1] = -0.05; fallVel[i * 3 + 2] = (Math.random() - 0.5) * 0.12
    }
    for (let i = 0; i < fallN; i++) { respawnFall(i); fallPos[i * 3 + 1] -= Math.random() * P.top }
    const mist = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }))
    mist.position.set(impact.x, 0.08, impact.z); mist.scale.set(1, 0.4, 1); block.add(mist)

    // ── 범선 ─────────────────────────────────────────────────────
    const ship = new THREE.Group(); block.add(ship)
    const shipParts = new THREE.Group(); shipParts.scale.setScalar(1.15); ship.add(shipParts)
    const shipAdd = (m, x, y, z) => { add(m, x, y, z, shipParts); m.userData.pick = 'ship'; return m }
    {
      const hs = new THREE.Shape()
      hs.moveTo(-0.34, 0.1); hs.lineTo(-0.3, 0.06); hs.lineTo(0.3, 0.06); hs.quadraticCurveTo(0.42, 0.08, 0.44, 0.13)
      hs.quadraticCurveTo(0.34, -0.06, 0.2, -0.09); hs.lineTo(-0.22, -0.09); hs.quadraticCurveTo(-0.32, -0.06, -0.34, 0.1)
      const hullGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 8 })
      hullGeo.translate(0, 0, -0.09)
      shipAdd(new THREE.Mesh(hullGeo, mat('#8b5a3c', { roughness: 0.55 })), 0, 0.06, 0)
      shipAdd(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.025, 0.215), mat('#3f6fb8', { roughness: 0.4 })), 0.01, 0.13, 0)
      shipAdd(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.18), mat('#d9c09a')), 0.0, 0.135, 0)
      shipAdd(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.19), mat('#8b5a3c')), -0.26, 0.18, 0) // 선미 갑판
    }
    const woodParts = [new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6).rotateZ(-1.15).translate(0.5, 0.2, 0)] // 돛대·활대·뱃머리 막대 = 한 덩어리
    const sailMat = new THREE.MeshStandardMaterial({ color: '#f5ecda', side: THREE.DoubleSide, roughness: 0.8 })
    const sails = []
    ;[[-0.08, 0.68], [0.16, 0.56]].forEach(([mx, mh]) => {
      woodParts.push(new THREE.CylinderGeometry(0.01, 0.012, mh, 6).translate(mx, 0.14 + mh / 2, 0))
      ;[[0.32, 0.24, 0.13 + mh * 0.38], [0.26, 0.18, 0.13 + mh * 0.75]].forEach(([w, hh, yy]) => {
        const g = new THREE.PlaneGeometry(w, hh, 6, 4)
        const a = g.attributes.position.array
        for (let i = 0; i < a.length; i += 3) a[i + 2] = 0.045 * Math.cos((a[i] / w) * Math.PI) * Math.cos((a[i + 1] / hh) * Math.PI * 0.6)
        g.computeVertexNormals()
        const s = shipAdd(new THREE.Mesh(g, sailMat), mx + 0.012, yy, 0)
        s.rotation.y = Math.PI / 2
        sails.push(s)
        woodParts.push(new THREE.CylinderGeometry(0.005, 0.005, w + 0.04, 5).rotateX(Math.PI / 2).translate(mx + 0.012, yy + hh / 2, 0))
      })
    })
    shipAdd(new THREE.Mesh(mergeGeometries(woodParts), mat('#5b4030')), 0, 0, 0)
    woodParts.forEach(g => g.dispose())
    const shipFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07, 4, 1), new THREE.MeshStandardMaterial({ color: '#3f6fb8', side: THREE.DoubleSide }))
    shipFlag.position.set(-0.02, 0.86, 0); shipFlag.rotation.y = Math.PI / 2; shipParts.add(shipFlag)
    const shipPath = { cx: 1.3, cz: 1.2, r: 1.15 }

    // ── 별 ───────────────────────────────────────────────────────
    const starN = 260
    const sp = new Float32Array(starN * 3)
    const rnd = rng(20261019)
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
    const shipFwd = () => new THREE.Vector3(Math.cos(ship.rotation.y), 0, -Math.sin(ship.rotation.y)) // 배가 보는 쪽(+x 로컬)
    function salute() {
      const fwd = shipFwd()
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x)
      // 호수 가운데 쪽으로 쏜다
      const toCenter = new THREE.Vector3(0.6, 0, 0.4).sub(ship.position)
      if (side.dot(toCenter) < 0) side.negate()
      for (let k = 0; k < 2; k++) {
        const o = ship.position.clone().add(fwd.clone().multiplyScalar(k ? 0.12 : -0.1)).add(new THREE.Vector3(0, 0.16, 0))
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
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshPhysicalMaterial({ color: BALL_COLORS[balls.length % 5], roughness: 0.2, clearcoat: 1 }))
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
        if (!o?.userData.pick) continue
        // 수면의 절벽 칸(그리지 않는 자리)은 건너뛴다
        if (o.userData.pick === 'lake') { const p = block.worldToLocal(hit.point.clone()); if (inPlateau(p.x, p.z)) continue }
        return { kind: o.userData.pick, point: hit.point, obj: o }
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
        if (hit?.kind === 'lake') { const p = block.worldToLocal(hit.point.clone()); bump(p.x, p.z, -0.035, 2); addFoam(p.x, p.z, 0.08, 1) }
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

    // 작은 장식(창문·깃대·돛 활대·꽃 등)은 그림자를 드리우지 않는다 — 그림자 그리기 횟수를 줄인다(폰)
    block.updateMatrixWorld(true)
    block.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.castShadow) return
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
      const sc = o.getWorldScale(new THREE.Vector3())
      if (o.geometry.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) < 0.07) o.castShadow = false
    })

    // ── 품질 단계 ────────────────────────────────────────────────
    // 3 = 최고 · 2 = 해상도 1배 · 1 = 가벼운 물(빛 무늬 끔)·그림자 1024 · 0 = 그림자 끔
    let level = 3
    const setLevel = L => {
      level = L
      if (L <= 2 && pr !== 1) { pr = 1; renderer.setPixelRatio(pr); renderer.setSize(W(), H()) }
      if (L <= 1) {
        setLite(true)
        if (sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null }
      }
      if (L === 0 && renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false
        scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true }) })
      }
    }
    if (weak) setLevel(1)

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
    const perf = { frames: 0, ms: 0, worst: 0 }
    if (process.env.NODE_ENV === 'development') window.__castle = {
      cmd: commandRef?.current,
      counts: () => ({ coins: coins.length, balls: balls.length, shots: shots.length, restCoins: coins.filter(c => c.state === 'rest').length, ballY: balls.map(b => +b.m.position.y.toFixed(2)), level, pr }),
      info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length, level, pr, avgFrameMs: +(perf.ms / Math.max(1, perf.frames)).toFixed(2), worstFrameMs: +perf.worst.toFixed(2) }),
      resetPerf: () => { perf.frames = 0; perf.ms = 0; perf.worst = 0 },
      setLevel,
      // 큰 해상도로 한 장 굽기(확인용) — 배율을 잠깐 올려 그리고 바로 읽는다
      snap: (scale = 2) => { const old = renderer.getPixelRatio(); renderer.setPixelRatio(scale); renderer.setSize(W(), H()); renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png'); renderer.setPixelRatio(old); renderer.setSize(W(), H()); return url },
    }

    const ro = new ResizeObserver(() => {
      renderer.setSize(W(), H())
      camera.aspect = W() / H(); camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    // ── 고정 간격 물리 ───────────────────────────────────────────
    const STEP = 1 / 60
    let acc = 0, last = performance.now(), time = 0, raf = 0, nextAutoFw = 0
    // 자동 품질: 프레임 속도를 보고 느리면 한 단계씩 내린다
    let fpsFrames = 0, fpsT0 = 0, settled = false
    // ③ 그리다가 GPU 가 끊기면(메모리 부족 등) 대체 화면으로
    const onLost = e => { e.preventDefault(); cancelAnimationFrame(raf); onFallback?.('lost') }
    renderer.domElement.addEventListener('webglcontextlost', onLost)
    let slowStreak = 0
    let pulseT = 0
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
      // 일정한 박자로 크게 한 번씩 — 동심원이 호수로 퍼져 나간다
      pulseT -= dt
      if (pulseT <= 0 && flow > 0.05) { pulseT = 0.55 - flow * 0.25; bump(impact.x + 0.1, impact.z, -(0.02 + flow * 0.035), 2.2) }
      addFoam(impact.x + 0.05 + Math.random() * 0.45, impact.z + (Math.random() - 0.5) * 0.6, 0.012 + flow * 0.03, 1.2)
      // 범선: 뱃전 물결 + 뒤로 남는 물길(거품)
      if (Math.random() < 0.25) bump(ship.position.x, ship.position.z, -0.006, 1.5)
      {
        const fwd = shipFwd()
        const sx = ship.position.x - fwd.x * 0.38, sz = ship.position.z - fwd.z * 0.38
        addFoam(sx, sz, 0.12, 1.3)
        addFoam(ship.position.x + fwd.z * 0.1, ship.position.z - fwd.x * 0.1, 0.025, 0.9)
        addFoam(ship.position.x - fwd.z * 0.1, ship.position.z + fwd.x * 0.1, 0.025, 0.9)
      }
      for (let i = 0; i < N * N; i++) if (foam[i] > 0.002) foam[i] *= 0.9965; else foam[i] = 0
      simStep(damp)
      // 폭포 입자(물줄기 리본 위 흩날림)
      const active = Math.floor(fallN * (0.1 + flow * 0.9))
      for (let i = 0; i < fallN; i++) {
        if (i >= active) { fallPos[i * 3 + 1] = -99; continue }
        if (fallPos[i * 3 + 1] < -50) { respawnFall(i); continue }
        fallVel[i * 3 + 1] -= G * dt
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
      // 범선 — 원을 따라 앞으로(뱃머리 = 진행 방향)
      const sa = time * (st.reducedMotion ? 0.06 : 0.14)
      const sx = shipPath.cx + Math.cos(sa) * shipPath.r, sz = shipPath.cz + Math.sin(sa) * shipPath.r
      ship.position.set(sx, sampleH(sx, sz) - 0.02, sz)
      ship.rotation.y = -sa - Math.PI / 2
      ship.rotation.z = Math.sin(time * 1.6) * 0.04 + (sampleH(sx + 0.15, sz) - sampleH(sx - 0.15, sz)) * 2
      // 포탄 → 물기둥
      for (let s2 = shots.length - 1; s2 >= 0; s2--) {
        const sh = shots[s2]
        sh.vel.y -= 6.5 * dt
        sh.m.position.addScaledVector(sh.vel, dt)
        if (sh.m.position.y < 0) {
          const { x, z } = sh.m.position
          if (Math.abs(x) < HALF && Math.abs(z) < HALF && !inPlateau(x, z)) { bump(x, z, -0.12, 2.8); spray(x, z, 110, 3.4, 0.35); spray(x, z, 50, 1.4, 0.9); addFoam(x, z, 0.9, 3) }
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
          b.vel.multiplyScalar(0.94) // 물속 저항 — 깊어진 호수에서 아래위로 크게 튀지 않게
          if (b.vel.y < -1.2) { bump(p.x, p.z, -0.08, 2.2); spray(p.x, p.z, 40, 2.2, 0.5); jiggleV += 0.2 }
          if (Math.random() < 0.05) bump(p.x, p.z, -0.004, 1.2)
        }
        p.addScaledVector(b.vel, dt)
        if (p.y < FLOOR_Y + 0.11) { p.y = FLOOR_Y + 0.11; b.vel.y = Math.abs(b.vel.y) * 0.3 } // 호수 바닥
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
    function updateWaterVisuals() {
      const arr = lakeGeo.attributes.position.array
      for (let i = 0, p = 0; i < N * N; i++, p += 3) arr[p + 1] = solid[i] ? -0.02 : h[i]
      lakeGeo.attributes.position.needsUpdate = true
      lakeGeo.computeVertexNormals()
      const wp = volumeGeo.attributes.position.array
      for (let k = 0; k < wallTop.length; k += 2) wp[wallTop[k] * 3 + 1] = solid[wallTop[k + 1]] ? 0 : h[wallTop[k + 1]]
      volumeGeo.attributes.position.needsUpdate = true
      // 물결이 모으는 빛(볼록 = 밝게) + 거품 — 텍스처 행은 아래 → 위
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const i = r * N + c, o = (((N - 1 - r) * N) + c) * 4
        foamData[o] = Math.round(foam[i] * 255)
        if (r === 0 || c === 0 || r === N - 1 || c === N - 1 || solid[i]) { causticData[o + 3] = 0; continue }
        const lap = h[i - 1] + h[i + 1] + h[i - N] + h[i + N] - 4 * h[i]
        causticData[o] = 255; causticData[o + 1] = 255; causticData[o + 2] = 255
        causticData[o + 3] = Math.round(Math.max(0, Math.min(1, -lap * 55)) * 200)
      }
      causticTex.needsUpdate = true
      foamTex.needsUpdate = true
    }

    function applyLook() {
      const st = settingsRef.current
      const t = st.timeOfDay
      const ang = triN(t, 1.05, 0.28, -0.25)
      sun.position.set(Math.cos(ang) * 8 + 2, Math.sin(ang) * 10 + 1, 5)
      sun.color.copy(tri(t, '#fffaf2', '#ffb27a', '#8ea0ff'))
      sun.intensity = triN(t, 2.4, 1.5, 0.25)
      hemi.color.copy(tri(t, '#ffffff', '#ffd2b0', '#3a3f7a'))
      hemi.groundColor.copy(tri(t, '#d9c9ae', '#c7a58e', '#1c1a2c'))
      hemi.intensity = triN(t, 0.6, 0.5, 0.3)
      scene.environmentIntensity = triN(t, 0.75, 0.5, 0.12)
      // 물 셰이더
      sunDirU.copy(sun.position).normalize()
      lakeMat.uniforms.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity * 0.45)
      lakeMat.uniforms.uSky.value.copy(tri(t, '#eef7ff', '#ffd9c2', '#2a2f5a'))
      shared.uLight.value = triN(t, 1, 0.8, 0.32)
      shared.uCaustic.value = triN(t, 1, 0.6, 0.12)
      fallMat.uniforms.uFlow.value = st.flow
      starMat.opacity = Math.max(0, (t - 0.6) / 0.4)
      windowMat.emissiveIntensity = Math.max(0, (t - 0.35) / 0.65) * 1.6
      if (flavourNow !== st.flavour) {
        flavourNow = FLAVOURS[st.flavour] ? st.flavour : 'glacier'
        const f = FLAVOURS[flavourNow]
        lakeMat.uniforms.uShallow.value.set(f.lake); lakeMat.uniforms.uDeep.value.set(f.deep)
        tex = paletteTex(flavourNow)
        floorMat.color.set('#ffffff').lerp(new THREE.Color(f.lake), 0.6) // 물속 바닥은 물빛을 띤다
        strataSide.map = tex.block; cliffSide.map = tex.cliff; floorMat.map = tex.sand; grassMat.map = tex.grass
      }
      if (t > 0.8 && !st.reducedMotion && time > nextAutoFw) { launch(); nextAutoFw = time + 2 + Math.random() * 2 }
      if ((st.catImg || null) !== catUrl) loadCat(st.catImg || null)
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      if (document.hidden) { last = now; return }
      const t0 = performance.now()
      const dtReal = (now - last) / 1000
      acc += Math.min(0.25, dtReal)
      last = now
      let steps = 0
      while (acc >= STEP && steps < 12) { stepPhysics(STEP); acc -= STEP; steps++ }
      if (steps >= 12) acc = 0
      if (!fpsT0) fpsT0 = now
      fpsFrames++
      if (!settled && now - fpsT0 > 1500) {
        const fps = fpsFrames / ((now - fpsT0) / 1000)
        if (fps < 42 && level > 0) setLevel(level - 1)
        else settled = true // 충분히 빠르거나 더 내릴 곳이 없으면 그대로 둔다
        fpsFrames = 0; fpsT0 = now
      } else if (settled && now - fpsT0 > 3000) {
        const fps = fpsFrames / ((now - fpsT0) / 1000)
        slowStreak = level === 0 && fps < 18 ? slowStreak + 1 : 0
        if (slowStreak === 3) onFallback?.('slow') // 가장 가벼운 품질로도 9초 내내 느림 → 예전 홈 권유(한 번)
        fpsFrames = 0; fpsT0 = now
      }
      shared.uTime.value = time
      applyLook()
      updateWaterVisuals()
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
      for (const s of sails) s.scale.z = 1 + Math.sin(time * 2.2) * 0.12
      block.rotation.x = tiltX; block.rotation.z = tiltZ
      block.scale.set(1 - jiggle * 0.03, 1 + jiggle * 0.06, 1 - jiggle * 0.03)
      flame.scale.y = 1 + Math.sin(time * 14) * 0.15
      // 고양이: 숨 쉬듯 살짝 · 누르면 폴짝
      catHop = Math.max(0, catHop - 0.045)
      catSprite.position.y = P.top + 0.27 + Math.sin(time * 2.2) * 0.008 + Math.sin(catHop * Math.PI) * 0.25
      mist.material.opacity = 0.12 + settingsRef.current.flow * 0.28
      controls.update()
      renderer.render(scene, camera)
      const ms = performance.now() - t0
      perf.frames++; perf.ms += ms; perf.worst = Math.max(perf.worst, ms)
    }
    let disposed = false
    const start = () => { if (disposed) return; raf = requestAnimationFrame(t => { frame(t); onReady?.() }) }
    // 셰이더를 미리 컴파일한다 — 첫 프레임에서 몇 초씩 멈추던 것을 로딩 화면 뒤로 숨긴다.
    // ⚠️ compileAsync 는 쓰지 않는다: 준비 중에 장면이 정리되면(개발 모드 이중 마운트·빠른 화면 이동) three 내부
    //    폴링이 사라진 프로그램을 읽어 「isReady of undefined」로 터진다. 로딩 화면이 먼저 그려지게 한 박자 뒤 동기 컴파일.
    const compileTimer = setTimeout(() => {
      if (disposed) return
      try { renderer.compile(scene, camera) } catch {}
      start()
    }, 60)

    return () => {
      disposed = true
      clearTimeout(compileTimer)
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => m.dispose()) })
      causticTex.dispose(); foamTex.dispose()
      textures.forEach(t => t.dispose())
      catSprite.material.map?.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      if (commandRef) commandRef.current = null
    }
  }, [])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
}
