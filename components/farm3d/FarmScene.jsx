'use client'
// 3D 냥밭 장면 — 떠 있는 젤리 섬 위의 밭. **그림만 그린다**: 작물 단계·잡초·농부냥은 부모가 실제 냥밭 데이터로 넘기고,
// 누르기는 onPick 으로 돌려준다(수확·뽑기 규칙은 부모 = lib/farmProgress — 기존 냥밭과 한 규칙).
//
// props
//   plots   [{ stage }] × 4 — 앞칸(0)부터. stage 0 = 빈 칸, 4 = 완숙(맨 앞칸만 수확)
//   crop    'tomato' | 'corn' | 'carrot' — 지금 농부냥의 작물
//   catImg  농부냥 그림(학생이 직접 고른 냥이)
//   weeds   [{ id, stage, removable, x, y }] — x·y = 기존 냥밭의 % 좌표(같은 상태를 그대로 섬 위 자리로 옮긴다)
//   night   밤 장면
//   rainKey 바뀔 때마다 비(꾸밈 — 작물 성장은 출석으로만)
//   onPick(kind, data, clientX, clientY) — kind = 'plot' | 'weed' | 'cat' | 'shed' | 'cloud' | 'sun'
//     손님들(critters.js): 'bird'({landed}) · 'bird-shoo'(냥이가 쫓아냄) · 'mole'({caught}) · 'worm'
//   onFail() — 3D 를 그릴 수 없는 기기
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { writeCatAnchor } from '../../lib/catAnchor'
import { makeCritters } from './critters'

const CROPS = {
  tomato: { fruit: 0xe5484d, leaf: 0x58b56a },
  corn:   { fruit: 0xf2c94c, leaf: 0x6cbf5a },
  carrot: { fruit: 0xf08a3c, leaf: 0x5fbf63 },
}
// 작물 칸 자리 — 앞칸(0)이 기본 카메라(+x,+z)에 가장 가깝다
const PLOT_POS = [[0.55, 0.55], [-0.6, 0.55], [0.55, -0.6], [-0.6, -0.6]]
const POND = { x: -2.05, z: 2.05, r: 1.15 }
const SHED = { x: 1.9, z: -1.9, r: 1.1 }

// 기존 냥밭의 % 좌표(x 8~88 · y 60~90) → 섬 위 자리. 밭·연못·헛간 자리는 피해 바깥으로 민다.
export function weedSpot(x, y) {
  const u = Math.max(0, Math.min(1, (x - 8) / 80)), v = Math.max(0, Math.min(1, (y - 60) / 30))
  let X = -2.7 + u * 5.4, Z = -2.7 + v * 5.4
  const m = Math.max(Math.abs(X), Math.abs(Z))
  if (m < 1.45) { const k = 1.45 / Math.max(m, 0.01); X *= k; Z *= k }
  for (const o of [POND, SHED]) {
    const dx = X - o.x, dz = Z - o.z, d = Math.hypot(dx, dz)
    if (d < o.r) { const k = o.r / Math.max(d, 0.01); X = o.x + dx * k; Z = o.z + dz * k }
  }
  return [Math.max(-2.75, Math.min(2.75, X)), Math.max(-2.75, Math.min(2.75, Z))]
}

export default function FarmScene(props) {
  const hostRef = useRef(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const apiRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      propsRef.current.onFail?.()
      return
    }
    const reduce = !!propsRef.current.reducedMotion
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.NeutralToneMapping
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    camera.position.set(11, 9.5, 12)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enablePan = false
    controls.minDistance = 11; controls.maxDistance = 24
    controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.25
    controls.target.set(0, -0.4, 0)
    controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35

    const hemi = new THREE.HemisphereLight(0xfff6ec, 0xb9a6d8, 1.5); scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xffffff, 2.3)
    sun.position.set(6, 11, 5); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 })
    scene.add(sun)
    // 밤 = 헛간 등불
    const lamp = new THREE.PointLight(0xffc979, 0, 6, 1.6); lamp.position.set(1.9, 1.0, -1.1); scene.add(lamp)

    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, ...o })
    const pickables = []
    const pickable = (m, kind, data = {}) => { m.userData = { ...m.userData, kind, ...data }; pickables.push(m); return m }
    const unpick = (m) => { const i = pickables.indexOf(m); if (i >= 0) pickables.splice(i, 1) }

    // ── 섬: 잔디 윗면 + 젤리 지층(성 절벽과 같은 색 띠) ──
    const island = new THREE.Group(); scene.add(island)
    const SIZE = 6.4
    const top = new THREE.Mesh(new RoundedBoxGeometry(SIZE, 0.36, SIZE, 4, 0.14), mat(0x93d39a))
    top.position.y = -0.18; top.receiveShadow = true; island.add(top)
    let y = -0.36
    for (const [c, h] of [[0xf3e3c4, 0.5], [0xf6c3d4, 0.42], [0xd9cbf6, 0.46], [0xb9a3ec, 0.36]]) {
      const s = new THREE.Mesh(new RoundedBoxGeometry(SIZE - 0.08, h, SIZE - 0.08, 3, 0.12),
        new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }))
      s.position.y = y - h / 2; y -= h; island.add(s)
    }
    const pond = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.3, 1.7, 4, 0.12),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe8f6, transmission: 0.92, thickness: 0.6, roughness: 0.08, ior: 1.3, clearcoat: 1 }))
    pond.position.set(POND.x, 0.02, POND.z); island.add(pond)
    const lily = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 18), mat(0x6fbf73))
    lily.position.set(-1.8, 0.19, 1.85); island.add(lily)

    // 울타리
    const fenceMat = mat(0xf5ead6)
    for (let i = 0; i < 13; i++) {
      const t = -2.9 + i * 0.483
      for (const [x, z] of [[t, -2.95], [2.95, t]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), fenceMat)
        p.position.set(x, 0.21, z); p.castShadow = true; island.add(p)
      }
    }
    for (const [x, z, w, d] of [[0, -2.95, 5.9, 0.05], [2.95, 0, 0.05, 5.9]]) for (const h of [0.15, 0.32]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), fenceMat); r.position.set(x, h, z); island.add(r)
    }

    // 헛간(미니게임)
    const shed = new THREE.Group()
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.95, 1.1, 3, 0.06), mat(0xf4b6cb)); body.position.y = 0.48
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.62, 4), mat(0x8e6fd8)); roof.position.y = 1.26; roof.rotation.y = Math.PI / 4
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.04), mat(0xfff3e4)); door.position.set(0, 0.29, 0.56)
    const signMat = mat(0xffd27a, { emissive: 0xffb84a, emissiveIntensity: 0 })
    const sign = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), signMat); sign.position.set(0, 0.76, 0.565)
    for (const m of [body, roof, door, sign]) { m.castShadow = true; shed.add(m); pickable(m, 'shed') }
    shed.position.set(SHED.x, 0, SHED.z); shed.rotation.y = -0.35; island.add(shed)

    // 나무 둘
    for (const [x, z, s] of [[-2.35, -2.25, 1], [2.35, 1.4, 0.8]]) {
      const t = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 8), mat(0xb08a6e)); trunk.position.y = 0.25
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), mat(0x7cc68a)); crown.position.y = 0.72; crown.scale.y = 1.15
      const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat(0x9bd9a4)); crown2.position.set(0.18, 0.95, 0.1)
      for (const m of [trunk, crown, crown2]) { m.castShadow = true; t.add(m) }
      t.position.set(x, 0, z); t.scale.setScalar(s); island.add(t)
    }

    // ── 작물 4칸 ──
    const soilColor = new THREE.Color(0x9b6b52), wetColor = new THREE.Color(0x5e3d2e)
    const plots = PLOT_POS.map(([x, z], i) => {
      const soil = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.12, 1.0, 2, 0.04), mat(0x9b6b52, { roughness: 0.9 }))
      soil.position.set(x, 0.05, z); soil.receiveShadow = true; island.add(soil)
      const plant = new THREE.Group(); plant.position.set(x, 0.11, z); island.add(plant)
      const p = { i, soil, plant, x, z, shown: null, wet: 0 }
      pickable(soil, 'plot', { plot: i })
      return p
    })
    const leafGeo = new THREE.SphereGeometry(0.1, 10, 8)
    function clearGroup(g) {
      for (const c of [...g.children]) {
        unpick(c); g.remove(c)
        if (c.geometry && c.geometry !== leafGeo) c.geometry.dispose()
        if (c.material) c.material.dispose()
      }
    }
    function buildPlant(p, st, crop) {
      const key = `${st}:${crop}`
      if (p.shown === key) return
      p.shown = key
      clearGroup(p.plant)
      const C = CROPS[crop] || CROPS.tomato, leafMat = mat(C.leaf), fruitMat = mat(C.fruit, { roughness: 0.35 })
      const add = (m) => { m.castShadow = true; p.plant.add(m); pickable(m, 'plot', { plot: p.i }) }
      if (st === 0) return // 빈 칸 = 흙만(출석하면 자라요)
      if (st === 1) { const s = new THREE.Mesh(leafGeo, leafMat); s.scale.set(0.55, 0.38, 0.55); add(s); return }
      const h = [0, 0.18, 0.34, 0.5, 0.58][st] * (crop === 'corn' ? 1.6 : crop === 'carrot' ? 0.6 : 1)
      const n = crop === 'carrot' ? 4 : 2
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + 0.6
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, h, 6), leafMat)
        stem.position.set(Math.cos(a) * 0.1, h / 2, Math.sin(a) * 0.1); stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); add(stem)
        const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.set(Math.cos(a) * 0.17, h * 0.85, Math.sin(a) * 0.17); lf.scale.set(1, 0.45, 0.7); add(lf)
      }
      if (st >= 3) {
        if (crop === 'tomato') for (let k = 0; k < (st === 4 ? 4 : 2); k++) {
          const f = new THREE.Mesh(new THREE.SphereGeometry(st === 4 ? 0.1 : 0.06, 14, 10), st === 4 ? fruitMat : mat(0x9fd27a))
          const a = k * 1.7; f.position.set(Math.cos(a) * 0.16, h * 0.55 + (k % 2) * 0.12, Math.sin(a) * 0.16); add(f)
        }
        if (crop === 'corn') for (const s of [-1, 1]) {
          const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, st === 4 ? 0.18 : 0.1, 4, 10), st === 4 ? fruitMat : mat(0xc9e08a))
          f.position.set(0.09 * s, h * 0.6, 0.03); f.rotation.z = -0.4 * s; add(f)
        }
        if (crop === 'carrot') {
          const f = new THREE.Mesh(new THREE.ConeGeometry(st === 4 ? 0.1 : 0.06, 0.18, 12), fruitMat)
          f.rotation.x = Math.PI; f.position.y = 0.02; add(f)
        }
      }
      // 맨 앞칸 완숙 = 수확 가능 표시(빛나는 고리)
      if (st === 4 && p.i === 0) {
        const glow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.016, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }))
        glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; glow.userData.ring = true; p.plant.add(glow)
      }
    }

    // ── 농부냥(학생이 고른 그림 그대로) ──
    const loader = new THREE.TextureLoader()
    const texCache = new Map()
    const tex = (src) => {
      if (!texCache.has(src)) { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; texCache.set(src, t) }
      return texCache.get(src)
    }
    const catSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }))
    catSprite.center.set(0.5, 0); catSprite.scale.set(0.78, 1.0, 1)
    const cat = new THREE.Group(); cat.add(catSprite); island.add(cat)
    const catShadow = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), new THREE.MeshBasicMaterial({ color: 0x3b2a4a, transparent: true, opacity: 0.18 }))
    catShadow.rotation.x = -Math.PI / 2; catShadow.position.y = 0.012; cat.add(catShadow)
    pickable(catSprite, 'cat')
    cat.position.set(1.3, 0.11, 1.6)
    const catGoal = new THREE.Vector3(1.3, 0.11, 1.6)
    const CAT_HEAD = new THREE.Vector3(0, 1, 0), catTmp = new THREE.Vector3() // 말풍선 자리 = 머리 끝(발 기준 스프라이트)
    let catWait = 1, catSrc = null
    function setCat(src) {
      if (!src || src === catSrc) return
      catSrc = src
      loader.load(src, t => {
        if (catSrc !== src) { t.dispose(); return }
        t.colorSpace = THREE.SRGBColorSpace
        catSprite.material.map = t; catSprite.material.needsUpdate = true
        const img = t.image, ar = img && img.width ? img.width / img.height : 0.78
        catSprite.scale.set(1.0 * ar, 1.0, 1)
      })
    }

    // ── 잡초(실제 잡초 상태 — 단계별 그림·크기) ──
    const weedMap = new Map()
    const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xe24b4a, transparent: true, opacity: 0.6 })
    function setWeeds(list) {
      const ids = new Set(list.map(w => w.id))
      for (const [id, o] of weedMap) if (!ids.has(id)) {
        unpick(o.sprite); island.remove(o.group); o.sprite.material.dispose(); o.ring?.geometry.dispose(); o.ring?.material.dispose(); weedMap.delete(id)
      }
      for (const w of list) {
        let o = weedMap.get(w.id)
        if (!o) {
          const [X, Z] = weedSpot(w.x, w.y)
          const group = new THREE.Group(); group.position.set(X, 0, Z)
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }))
          sprite.center.set(0.5, 0.05); group.add(sprite); island.add(group)
          pickable(sprite, 'weed', { id: w.id })
          o = { group, sprite, ring: null, stage: 0, born: performance.now() }
          weedMap.set(w.id, o)
        }
        if (o.stage !== w.stage) {
          o.stage = w.stage
          o.sprite.material.map = tex(`/farm/weed-${Math.max(1, Math.min(5, w.stage))}.png`); o.sprite.material.needsUpdate = true
          o.size = 0.2 + w.stage * 0.07
        }
        o.removable = !!w.removable
        if (o.removable && !o.ring) {
          o.ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 30), ringMat())
          o.ring.rotation.x = -Math.PI / 2; o.ring.position.y = 0.015; o.group.add(o.ring)
        } else if (!o.removable && o.ring) {
          o.group.remove(o.ring); o.ring.geometry.dispose(); o.ring.material.dispose(); o.ring = null
        }
      }
    }

    // ── 손님들: 새(냥이가 쫓는다)·두더지(눌러 잡는다)·지렁이(그냥 기어다닌다) — critters.js ──
    const critters = makeCritters({ THREE, island, mat, pickable, unpick, plots, reduce })
    if (process.env.NODE_ENV === 'development') window.__farmCritters = critters

    // ── 구름·비(꾸밈) ──
    const clouds = []
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.94 })
    for (const [x, z, s, y] of [[-1.4, -0.4, 1, 3.0], [1.6, 1.2, 0.8, 3.2], [3.4, -1.8, 0.7, 3.5], [-3.2, 1.9, 0.9, 2.8], [0.2, -3.0, 0.6, 3.7]]) {
      const g = new THREE.Group()
      for (const [dx, dy, r] of [[0, 0, 0.42], [0.42, -0.06, 0.32], [-0.4, -0.08, 0.3], [0.15, 0.2, 0.3]]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), cloudMat); b.position.set(dx, dy, 0); g.add(b); pickable(b, 'cloud')
      }
      g.position.set(x, y, z); g.scale.setScalar(s); g.userData.base = { x, y, z, ph: Math.random() * 6, v: 0.18 + Math.random() * 0.14 }; scene.add(g); clouds.push(g)
    }
    // ── 해 ──
    const glowTex = (rays) => {
      const c = document.createElement('canvas'); c.width = c.height = 256
      const x = c.getContext('2d')
      if (!rays) {
        const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128)
        gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(0.25, 'rgba(255,214,130,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)')
        x.fillStyle = gr; x.fillRect(0, 0, 256, 256)
      } else {
        x.translate(128, 128)
        for (let i = 0; i < 12; i++) {
          x.rotate(Math.PI / 6)
          const gr = x.createLinearGradient(0, 0, 0, -128); gr.addColorStop(0, 'rgba(255,235,170,0.9)'); gr.addColorStop(1, 'rgba(255,220,150,0)')
          x.fillStyle = gr; x.beginPath(); x.moveTo(-7, 0); x.lineTo(0, -128); x.lineTo(7, 0); x.fill()
        }
      }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx
    }
    const spriteMat = (map) => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })
    const sunDisc = pickable(new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffd36b, toneMapped: false })), 'sun')
    const sunHalo = new THREE.Sprite(spriteMat(glowTex(false))), sunRays = new THREE.Sprite(spriteMat(glowTex(true)))
    sunDisc.renderOrder = 2; sunHalo.renderOrder = 1; sunRays.renderOrder = 0
    sunDisc.add(sunHalo, sunRays); scene.add(sunDisc)
    const sunScreen = new THREE.Vector3()
    let sunGlow = 0
    const DROPS = 320
    const rain = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3),
      new THREE.MeshBasicMaterial({ color: 0x8fb8f0, transparent: true, opacity: 0.75 }), DROPS)
    rain.visible = false; scene.add(rain)
    const drops = Array.from({ length: DROPS }, () => ({ x: 0, y: -9, z: 0, v: 0 }))
    let rainUntil = 0
    const tmpM = new THREE.Matrix4()
    function startRain() {
      rainUntil = performance.now() + 4000; rain.visible = true
      for (const d of drops) { d.x = (Math.random() - 0.5) * 5.6; d.z = (Math.random() - 0.5) * 5.6; d.y = 2.8 + Math.random() * 2; d.v = 4 + Math.random() * 2 }
    }

    // ── 부모 데이터 반영 ──
    let night = false
    function sync() {
      const P = propsRef.current
      const crop = P.crop || 'tomato'
      plots.forEach((p, i) => buildPlant(p, P.plots?.[i]?.stage ?? 0, crop))
      setCat(P.catImg)
      setWeeds(P.weeds || [])
      night = !!P.night
    }
    apiRef.current = { sync, rain: startRain, hop: () => { catSprite.userData.hop = 1 },
      walkTo: (i) => { const p = plots[i]; if (p) { catGoal.set(p.x + 0.55, 0.11, p.z + 0.45); catWait = 1.4 } } }
    sync()

    // ── 누르기(살짝 끈 건 장면 돌리기로 본다) ──
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2()
    let down = null
    const hitAt = (e) => {
      const r = renderer.domElement.getBoundingClientRect()
      ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1)
      ray.setFromCamera(ptr, camera)
      return ray.intersectObjects(pickables, false)[0]
    }
    const onDown = e => { down = { x: e.clientX, y: e.clientY } }
    const onUp = e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return }
      down = null
      const hit = hitAt(e)
      if (!hit) return
      controls.autoRotate = false
      const { kind, ...data } = hit.object.userData
      if (kind === 'cloud') startRain()
      if (kind === 'cat') catSprite.userData.hop = 1
      if (kind === 'sun') sunGlow = 1
      if (kind === 'bird' || kind === 'mole' || kind === 'worm') {
        const r = critters.tap(kind, data); if (!r) return
        return propsRef.current.onPick?.(kind, r, e.clientX, e.clientY)
      }
      propsRef.current.onPick?.(kind, data, e.clientX, e.clientY)
    }
    const onMove = e => { renderer.domElement.style.cursor = hitAt(e) ? 'pointer' : 'grab' }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointermove', onMove)
    const onLost = (e) => { e.preventDefault(); propsRef.current.onFail?.() }
    renderer.domElement.addEventListener('webglcontextlost', onLost)

    // ── 크기·루프 ──
    function resize() {
      const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight
      renderer.setSize(w, h); camera.aspect = w / h
      const asp = w / h
      camera.fov = asp < 1 ? Math.min(60, 30 / asp * 0.8) : 30; camera.updateProjectionMatrix()
      controls.target.y = asp < 1 ? -1.6 : -0.4
    }
    const ro = new ResizeObserver(resize); ro.observe(host); resize()
    let nightMix = 0, last = performance.now()
    renderer.setAnimationLoop(now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const t = now / 1000
      nightMix += ((night ? 1 : 0) - nightMix) * Math.min(1, dt * 3)
      sun.intensity = 2.3 * (1 - nightMix) + 0.35; hemi.intensity = 1.5 - nightMix * 0.9
      hemi.color.setRGB(1, 0.96 - nightMix * 0.2, 0.92 + nightMix * 0.05)
      lamp.intensity = nightMix * 3; signMat.emissiveIntensity = nightMix * 1.2

      const raining = now < rainUntil
      for (const p of plots) {
        p.wet = raining ? 1 : Math.max(0, p.wet - dt * 0.12)
        p.soil.material.color.copy(soilColor).lerp(wetColor, p.wet)
        for (const c of p.plant.children) if (c.userData.ring) { c.material.opacity = 0.45 + Math.sin(t * 3) * 0.35; c.scale.setScalar(1 + Math.sin(t * 3) * 0.06) }
        if (!reduce) p.plant.rotation.z = Math.sin(t * 1.4 + p.x) * 0.04
      }
      if (!raining && rain.visible) rain.visible = false
      if (rain.visible) {
        drops.forEach((d, i) => { d.y -= d.v * dt; if (d.y < 0.05) d.y = raining ? 2.8 + Math.random() : -9
          tmpM.makeTranslation(d.x, d.y, d.z); rain.setMatrixAt(i, tmpM) })
        rain.instanceMatrix.needsUpdate = true
      }
      // 구름 = 바람 따라 섬 위를 천천히 흘러가고, 끝까지 가면 반대편에서 다시 들어온다
      for (const g of clouds) {
        const b = g.userData.base
        if (!reduce) { b.x += b.v * dt; if (b.x > 5.2) b.x = -5.2 }
        g.position.x = b.x; g.position.z = b.z + Math.sin(t * 0.2 + b.ph) * 0.25
        g.position.y = b.y + Math.sin(t * 0.6 + b.ph) * 0.08
        // 섬 가장자리 밖에선 옅어진다(갑자기 사라지지 않게)
        const fade = Math.max(0, Math.min(1, (5.2 - Math.abs(b.x)) / 1.4))
        g.children.forEach(m => { m.visible = fade > 0.02 })
        g.scale.setScalar(g.userData.s0 ?? (g.userData.s0 = g.scale.x)); g.scale.multiplyScalar(0.6 + 0.4 * fade)
      }
      // 해(밤엔 달) — 화면 오른쪽 위(단추 아래)에 늘 떠 있다. 누르면 빛이 번진다
      sunGlow = Math.max(0, sunGlow - dt * 0.55)
      sunDisc.position.copy(sunScreen.set(camera.aspect < 1 ? 0.5 : 0.7, camera.aspect < 1 ? 0.78 : 0.8, 0.5).unproject(camera)).sub(camera.position).setLength(16).add(camera.position)
      const g2 = sunGlow * sunGlow
      sunDisc.material.color.setRGB(1, 0.86 - nightMix * 0.02 + g2 * 0.1, 0.42 + nightMix * 0.5 + g2 * 0.3)
      sunDisc.scale.setScalar((1 - nightMix * 0.25) * (1 + Math.sin(sunGlow * Math.PI) * 0.18))
      sunHalo.material.opacity = (0.55 - nightMix * 0.3) + g2 * 0.45 + Math.sin(t * 1.3) * 0.04
      sunHalo.scale.setScalar((2.6 + g2 * 4.5) * (1 - nightMix * 0.3))
      sunRays.material.opacity = (0.35 - nightMix * 0.3) + g2 * 0.6
      sunRays.material.rotation = reduce ? 0 : t * 0.08 + sunGlow * 1.2
      sunRays.scale.setScalar(3.4 + g2 * 6)
      sun.intensity += g2 * 1.4; hemi.intensity += g2 * 0.6

      // 손님들 — 새가 냥이에게 쫓겨 날아가면 「훠이!」
      const shooed = critters.update(dt, t, { night, raining, catPos: cat.position })
      for (const b of shooed) {
        catSprite.userData.hop = 1
        const r = renderer.domElement.getBoundingClientRect()
        const v = b.g.getWorldPosition(new THREE.Vector3()).project(camera)
        propsRef.current.onPick?.('bird-shoo', {}, r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height)
      }
      // 쪼는 새가 있으면 냥이가 달려간다
      const prey = critters.chaseTarget()
      if (prey) { catGoal.set(prey.x + 0.18, 0.11, prey.z + 0.18); catWait = 0.8 }

      // 냥이 — 밭 사이를 오가며 일한다
      const to = catGoal.clone().sub(cat.position); to.y = 0
      if (to.length() > 0.04) {
        to.setLength(Math.min(to.length(), dt * (prey ? 2.1 : 0.8))); cat.position.add(to)
        catSprite.position.y = reduce ? 0 : Math.abs(Math.sin(t * 9)) * 0.05
        catSprite.material.rotation = reduce ? 0 : Math.sin(t * 9) * 0.04
      } else {
        catSprite.position.y = 0; catSprite.material.rotation = 0; catWait -= dt
        if (catWait <= 0) { const p = plots[Math.floor(Math.random() * plots.length)]; catGoal.set(p.x + 0.55, 0.11, p.z + 0.45); catWait = 2 + Math.random() * 2 }
      }
      if (catSprite.userData.hop) {
        catSprite.userData.hop = Math.max(0, catSprite.userData.hop - dt * 2.2)
        catSprite.position.y = Math.sin(catSprite.userData.hop * Math.PI) * 0.35
      }
      // 잡초 — 돋아나는 순간만 커진다, 뽑을 수 있는 건 고리가 숨 쉰다
      for (const o of weedMap.values()) {
        const k = Math.min(1, (now - o.born) / 600), s = o.size * k
        o.sprite.scale.set(s, s, 1)
        if (o.ring) o.ring.material.opacity = 0.35 + Math.sin(t * 4) * 0.25
      }
      if (!reduce) island.position.y = Math.sin(t * 0.8) * 0.05
      controls.update()
      renderer.render(scene, camera)
      writeCatAnchor(propsRef.current.catAnchorRef, { sprite: catSprite, camera, canvas: renderer.domElement, head: CAT_HEAD, tmp: catTmp })
    })

    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      controls.dispose()
      scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose?.(); m.dispose() }) })
      for (const t of texCache.values()) t.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      apiRef.current = null
    }
  }, [])

  // 데이터가 바뀌면 장면에 반영
  const weedKey = (props.weeds || []).map(w => `${w.id}:${w.stage}:${w.removable ? 1 : 0}`).join(',')
  const plotKey = (props.plots || []).map(p => p.stage).join(',')
  useEffect(() => { apiRef.current?.sync() }, [weedKey, plotKey, props.crop, props.catImg, props.night])
  useEffect(() => { if (props.rainKey) apiRef.current?.rain() }, [props.rainKey])
  useEffect(() => { if (props.walkKey) apiRef.current?.walkTo(0) }, [props.walkKey])

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} aria-label="3D 냥밭 — 떠 있는 섬 위의 밭, 농부냥, 헛간, 구름" />
}
