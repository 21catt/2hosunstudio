'use client'
// 왁뿌 엔진 — 고양이 얼굴 위에 왁스 3겹을 입히고, 누르는 자리부터 조각으로 깨뜨린다(캔버스 2D).
//   · 겹 = 고양이 실루엣을 점점 크게 부풀린 모양(1단계 = 가장 바깥 · 3단계 = 고양이에 붙은 안쪽)
//   · 겹마다 보로노이 조각. 누르면 그 자리 맨 위 겹의 조각이 날아가고, 옆 조각엔 금이 가거나 연달아 깨진다
//   · 손이 조금 빗나가도 깨지게: 눌린 자리에 조각이 없으면 가까운 조각(손가락 반경)을 깬다
//   · 화면만 다룬다 — 소리·진동은 콜백(onBreak 등)으로 바깥에 알린다

export const WAX_COLORS = [
  { key: 'clear',    name: '투명',   c: '#f3efe6', a: 0.5 },
  { key: 'milk',     name: '우유',   c: '#fff6e8', a: 0.93 },
  { key: 'butter',   name: '버터',   c: '#f6d877', a: 0.9 },
  { key: 'pink',     name: '핑크',   c: '#f5a6c3', a: 0.9 },
  { key: 'sky',      name: '하늘',   c: '#a3d1f2', a: 0.9 },
  { key: 'mint',     name: '민트',   c: '#a6e2c4', a: 0.9 },
  { key: 'lavender', name: '라벤더', c: '#c7b4f1', a: 0.9 },
  { key: 'peach',    name: '복숭아', c: '#f8bc98', a: 0.9 },
  { key: 'cocoa',    name: '코코아', c: '#b4896b', a: 0.92 },
]
export const DEFAULT_WAX = ['sky', 'pink', 'butter'] // 1단계(바깥) · 2단계 · 3단계(안쪽)
export const STAGES = 3

export function waxColor(key) { return WAX_COLORS.find(w => w.key === key) || WAX_COLORS[1] }

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function shade(hex, f) { // f>0 밝게, f<0 어둡게
  const [r, g, b] = hexRgb(hex)
  const m = v => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

function clipPoly(poly, ax, ay, c) { // 반평면 ax*x + ay*y <= c 쪽만 남긴다
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    const dp = ax * p[0] + ay * p[1] - c, dq = ax * q[0] + ay * q[1] - c
    if (dp <= 0) out.push(p)
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  }
  return out
}
function centroid(poly) {
  let a = 0, x = 0, y = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]
    const cr = x0 * y1 - x1 * y0
    a += cr; x += (x0 + x1) * cr; y += (y0 + y1) * cr
  }
  if (Math.abs(a) < 1e-6) return poly[0]
  return [x / (3 * a), y / (3 * a)]
}
function inPoly(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 } }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c }

export class WaxEngine {
  constructor(cv, { onBreak, onStageClear, onProgress } = {}) {
    this.cv = cv
    this.ctx = cv.getContext('2d')
    this.on = { onBreak, onStageClear, onProgress }
    this.colors = [...DEFAULT_WAX]
    this.layers = []
    this.frags = []
    this.crumbs = []
    this.shake = 0
    this.squash = { s: 1, v: 0 }
    this.coatT = 1
    this.showWax = true
    this.raf = 0
    this.img = null
    this.loop = this.loop.bind(this)
  }

  setColors(cols) { this.colors = [...cols]; this.layers.forEach((L, i) => { L.dirty = true; L.colorKey = this.colors[i] }) }

  // 크기·고양이가 바뀌면 다시 짓는다(깨진 상태는 버린다)
  build(img, w, h, dpr) {
    this.img = img; this.w = w; this.h = h; this.dpr = dpr
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr)
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px'
    const S = Math.min(w, h) * 0.5
    this.S = S
    this.cx = w / 2; this.cy = h * 0.5
    this.catBox = [this.cx - S / 2, this.cy - S / 2, S, S]
    const dil = [0.3, 0.2, 0.1].map(f => f * S) // 1단계(바깥) → 3단계(안쪽)
    const counts = [30, 24, 18]
    this.layers = dil.map((d, i) => this.makeLayer(i, d, counts[i]))
    this.coatT = 0
    this.report()
    this.start()
  }

  makeLayer(i, d, count) {
    const { w, h, dpr } = this
    const [bx, by, bs] = this.catBox
    // 마스크 = 고양이 실루엣을 d 만큼 부풀림 (반지름 d/2·d 두 원 위로 여러 번 찍기)
    const mask = canvas(w * dpr, h * dpr)
    const mx = mask.getContext('2d')
    mx.scale(dpr, dpr)
    const rings = [[0, 1], [d * 0.34, 16], [d * 0.67, 28], [d, 40]]
    for (const [r, n] of rings) for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      mx.drawImage(this.img, bx + Math.cos(a) * r, by + Math.sin(a) * r, bs, bs)
    }
    // 고양이 얼굴 안쪽 빈 곳(눈 흰자 등)도 왁스로 채운다 — 모양을 한 번 더 부드럽게 채움
    mx.globalCompositeOperation = 'source-in'
    mx.fillStyle = '#000'; mx.fillRect(0, 0, w, h)
    // 매끈하게 — 작게 줄였다 키워 흐린 뒤 문턱으로 다시 또렷하게(픽셀 그림의 계단 모서리를 둥글린다)
    const k = Math.round(4 * dpr)
    const small = canvas(mask.width / k, mask.height / k)
    const sg = small.getContext('2d')
    sg.imageSmoothingEnabled = true
    sg.drawImage(mask, 0, 0, small.width, small.height)
    // 작은 격자에서 상자 흐림 두 번(가로·세로) — 이진에 가까운 칸을 부드러운 언덕으로
    const sd = sg.getImageData(0, 0, small.width, small.height)
    const W = small.width, H = small.height, rad = 2
    let a = new Float32Array(W * H), tmp = new Float32Array(W * H)
    for (let q = 0; q < W * H; q++) a[q] = sd.data[q * 4 + 3]
    // 속 빈 곳 채우기 — 가장자리에서 닿는 빈 칸만 「바깥」, 나머지(고리 안쪽 등)는 왁스로 채운다
    const out = new Uint8Array(W * H), stack = []
    for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x) }
    for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1) }
    while (stack.length) {
      const q = stack.pop()
      if (out[q] || a[q] > 64) continue
      out[q] = 1
      const x = q % W, y = (q - x) / W
      if (x > 0) stack.push(q - 1); if (x < W - 1) stack.push(q + 1)
      if (y > 0) stack.push(q - W); if (y < H - 1) stack.push(q + W)
    }
    for (let q = 0; q < W * H; q++) if (!out[q]) a[q] = 255
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let sum = 0, n = 0
        for (let dx = -rad; dx <= rad; dx++) { const xx = x + dx; if (xx >= 0 && xx < W) { sum += a[y * W + xx]; n++ } }
        tmp[y * W + x] = sum / n
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let sum = 0, n = 0
        for (let dy = -rad; dy <= rad; dy++) { const yy = y + dy; if (yy >= 0 && yy < H) { sum += tmp[yy * W + x]; n++ } }
        a[y * W + x] = sum / n
      }
    }
    for (let q = 0; q < W * H; q++) { sd.data[q * 4] = sd.data[q * 4 + 1] = sd.data[q * 4 + 2] = 0; sd.data[q * 4 + 3] = a[q] }
    sg.putImageData(sd, 0, 0)
    mx.setTransform(1, 0, 0, 1, 0, 0)
    mx.globalCompositeOperation = 'copy'
    mx.imageSmoothingEnabled = true
    mx.drawImage(small, 0, 0, mask.width, mask.height)
    mx.globalCompositeOperation = 'source-over'
    const img = mx.getImageData(0, 0, mask.width, mask.height)
    const data = img.data
    for (let q = 3; q < data.length; q += 4) {
      const v = (data[q] - 115) * 6
      data[q] = v < 0 ? 0 : v > 255 ? 255 : v
      data[q - 3] = data[q - 2] = data[q - 1] = 0
    }
    mx.putImageData(img, 0, 0)
    // 마스크 경계 상자
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
    for (let y = 0; y < mask.height; y += 2) for (let x = 0; x < mask.width; x += 2) {
      if (data[(y * mask.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    // 아무것도 안 그린 빈 그림이면 마스크가 없다 — 조각 0개인 빈 겹(부술 것 없음)
    if (x1 < 0) return { i, d, mask, alphaAt: () => 0, box: [...this.catBox, ], shards: [], total: 0, view: canvas(w * dpr, h * dpr), dirty: true, colorKey: this.colors[i], cell: 10 }
    const box = [x0 / dpr, y0 / dpr, (x1 - x0) / dpr, (y1 - y0) / dpr]
    const alphaAt = (x, y) => {
      const px = Math.round(x * dpr), py = Math.round(y * dpr)
      if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) return 0
      return data[(py * mask.width + px) * 4 + 3]
    }
    // 보로노이 조각 — 상자 안 흔들린 격자 위 씨앗
    const r = rng(1234 + i * 97)
    const aspect = box[2] / Math.max(1, box[3])
    const cols = Math.max(3, Math.round(Math.sqrt(count * aspect)))
    const rows = Math.max(3, Math.round(count / cols))
    const cw = box[2] / cols, ch = box[3] / rows
    const sites = []
    for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
      sites.push([box[0] + (cx + 0.15 + r() * 0.7) * cw, box[1] + (ry + 0.15 + r() * 0.7) * ch])
    }
    const reach = Math.max(cw, ch) * 3.2
    const pad = 4
    const shards = []
    for (let a = 0; a < sites.length; a++) {
      let poly = [[box[0] - pad, box[1] - pad], [box[0] + box[2] + pad, box[1] - pad], [box[0] + box[2] + pad, box[1] + box[3] + pad], [box[0] - pad, box[1] + box[3] + pad]]
      const [sx, sy] = sites[a]
      for (let b = 0; b < sites.length && poly.length; b++) {
        if (a === b) continue
        const [tx, ty] = sites[b]
        if (Math.abs(tx - sx) > reach || Math.abs(ty - sy) > reach) continue
        // |p-s|² <= |p-t|²  ⇔  2(t-s)·p <= |t|²-|s|²
        poly = clipPoly(poly, 2 * (tx - sx), 2 * (ty - sy), tx * tx + ty * ty - sx * sx - sy * sy)
      }
      if (poly.length < 3) continue
      const c = centroid(poly)
      // 마스크와 겹치는 조각만 남긴다(씨앗·무게중심·꼭짓점 중간 표본)
      const probes = [c, [sx, sy], ...poly.map(p => [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2])]
      if (!probes.some(([x, y]) => alphaAt(x, y) > 20)) continue
      shards.push({ poly, c, alive: true, crack: 0, lines: [], seed: r() })
    }
    const near = Math.max(cw, ch) * 1.65
    shards.forEach((s, k) => {
      s.nb = []
      shards.forEach((o, m) => { if (m !== k && Math.hypot(o.c[0] - s.c[0], o.c[1] - s.c[1]) < near) s.nb.push(m) })
    })
    const view = canvas(w * dpr, h * dpr)
    return { i, d, mask, alphaAt, box, shards, total: shards.length, view, dirty: true, colorKey: this.colors[i], cell: Math.max(cw, ch) }
  }

  renderLayer(L) {
    const { dpr, w, h } = this
    const g = L.view.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, L.view.width, L.view.height)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const col = waxColor(this.colors[L.i])
    g.fillStyle = col.c
    g.beginPath()
    for (const s of L.shards) if (s.alive) { const p = s.poly; g.moveTo(p[0][0], p[0][1]); for (let k = 1; k < p.length; k++) g.lineTo(p[k][0], p[k][1]); g.closePath() }
    g.fill()
    // 깨진 구멍 가장자리 = 두께(어두운 테) · 금 = 가는 선
    g.lineJoin = 'round'
    for (const s of L.shards) {
      if (!s.alive) continue
      const edge = s.nb.some(m => !L.shards[m].alive)
      if (edge || s.crack) {
        g.save()
        g.beginPath(); s.poly.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath()
        g.clip()
        if (edge) { g.strokeStyle = shade(col.c, -0.28); g.lineWidth = 5; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.4; g.stroke() }
        if (s.crack) {
          for (const [ax, ay, bx2, by2] of s.lines) {
            g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2)
            g.strokeStyle = shade(col.c, -0.4); g.lineWidth = 1.3; g.stroke()
            g.beginPath(); g.moveTo(ax + 0.8, ay + 0.8); g.lineTo(bx2 + 0.8, by2 + 0.8)
            g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.8; g.stroke()
          }
        }
        g.restore()
      }
    }
    // 반들반들 — 왼쪽 위 빛
    g.globalCompositeOperation = 'source-atop'
    const [bx, by, bw, bh] = L.box
    const lg = g.createLinearGradient(bx, by, bx + bw * 0.7, by + bh)
    lg.addColorStop(0, 'rgba(255,255,255,0.55)'); lg.addColorStop(0.35, 'rgba(255,255,255,0.08)'); lg.addColorStop(1, 'rgba(0,0,0,0.12)')
    g.fillStyle = lg; g.fillRect(bx, by, bw, bh)
    const rg = g.createRadialGradient(bx + bw * 0.3, by + bh * 0.22, 2, bx + bw * 0.3, by + bh * 0.22, bw * 0.28)
    rg.addColorStop(0, 'rgba(255,255,255,0.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg; g.fillRect(bx, by, bw, bh)
    // 왁스 모양으로 자르기
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'destination-in'
    g.drawImage(L.mask, 0, 0)
    g.globalCompositeOperation = 'source-over'
    L.dirty = false
    void w; void h
  }

  // 그 자리에서 깰 조각 찾기 — 위(바깥) 겹부터. 없으면 손가락 반경 안 가장 가까운 조각
  pick(x, y, slack = 30) {
    for (const L of this.layers) {
      if (L.alphaAt(x, y) <= 20) continue
      const k = L.shards.findIndex(s => s.alive && inPoly(x, y, s.poly))
      if (k >= 0) return [L, k]
    }
    let best = null, bd = slack
    for (const L of this.layers) {
      L.shards.forEach((s, k) => {
        if (!s.alive) return
        const d = Math.hypot(s.c[0] - x, s.c[1] - y) - L.cell * 0.35
        if (d < bd) { bd = d; best = [L, k] }
      })
      if (best) return best // 바깥 겹이 먼저
    }
    return null
  }

  // 누른 자리 = 강하게(옆까지 번짐) · 끌기 = 약하게
  hit(x, y, power = 1) {
    if (this.coatT < 0.7 || !this.showWax) return false
    const got = this.pick(x, y)
    if (!got) return false
    const [L, k] = got
    this.breakShard(L, k, x, y, power)
    // 옆 조각: 금 가기 · 금 간 조각은 연달아 깨짐
    const s = L.shards[k]
    let chain = 0
    for (const m of s.nb) {
      const o = L.shards[m]
      if (!o.alive) continue
      if (o.crack >= 1 && Math.random() < 0.55 * power) {
        chain++
        setTimeout(() => { if (o.alive) { this.breakShard(L, m, o.c[0], o.c[1], 0.6); this.on.onBreak?.({ size: 0.35, bright: 1 - L.i / 2, chain: true }) } }, 50 + Math.random() * 110)
      } else if (Math.random() < 0.7 * power) {
        o.crack++
        const a = Math.random() * Math.PI
        const len = L.cell * 0.9
        o.lines.push([o.c[0] - Math.cos(a) * len, o.c[1] - Math.sin(a) * len, o.c[0] + Math.cos(a) * len, o.c[1] + Math.sin(a) * len])
        L.dirty = true
      }
    }
    this.on.onBreak?.({ size: Math.min(1, 0.45 + chain * 0.18) * power, bright: 1 - L.i / 2, chain: false })
    return true
  }

  breakShard(L, k, x, y, power) {
    const s = L.shards[k]
    if (!s.alive) return
    if (L.dirty) this.renderLayer(L) // 날아갈 조각 그림 = 깨지기 직전 모습
    this.spawnFrags(L, s, x, y, power)
    s.alive = false
    L.dirty = true
    this.shake = Math.min(9, this.shake + 3.5 * power)
    this.squash.v -= 0.035 * power
    const left = L.shards.filter(o => o.alive).length
    if (left === 0) this.on.onStageClear?.(L.i + 1)
    this.report()
  }

  spawnFrags(L, s, x, y, power) {
    const { dpr } = this
    const col = waxColor(this.colors[L.i])
    const c = s.c, p = s.poly
    // 조각을 2~3개 부채꼴로 나눠 날린다
    const parts = []
    const n = p.length
    const splits = n >= 6 ? 3 : 2
    for (let j = 0; j < splits; j++) {
      const from = Math.floor((j * n) / splits), to = Math.floor(((j + 1) * n) / splits)
      const poly = [c]
      for (let m = from; m <= to; m++) poly.push(p[m % n])
      parts.push(poly)
    }
    for (const poly of parts) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const [px, py] of poly) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py) }
      const bw = x1 - x0, bh = y1 - y0
      if (bw < 1 || bh < 1) continue
      const spr = canvas(bw * dpr + 2, bh * dpr + 2)
      const g = spr.getContext('2d')
      g.scale(dpr, dpr)
      g.beginPath(); poly.forEach(([px, py], m) => (m ? g.lineTo(px - x0, py - y0) : g.moveTo(px - x0, py - y0))); g.closePath()
      g.clip()
      g.drawImage(L.view, x0 * dpr, y0 * dpr, bw * dpr, bh * dpr, 0, 0, bw, bh)
      g.strokeStyle = shade(col.c, -0.3); g.lineWidth = 1.5; g.stroke()
      const pc = centroid(poly)
      const dx = pc[0] - x, dy = pc[1] - y, dl = Math.hypot(dx, dy) || 1
      const sp = (2.2 + Math.random() * 3.2) * (0.7 + power * 0.5)
      this.frags.push({
        spr, w: bw, h: bh, ox: pc[0] - x0, oy: pc[1] - y0, x: pc[0], y: pc[1],
        vx: (dx / dl) * sp + (Math.random() - 0.5) * 1.6, vy: (dy / dl) * sp - 2.4 - Math.random() * 2.2,
        rot: 0, vr: (Math.random() - 0.5) * 0.35, life: 1, a: col.a,
      })
    }
    for (let j = 0; j < 5 + Math.round(power * 5); j++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4.5
      this.crumbs.push({ x: c[0], y: c[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5, r: 1 + Math.random() * 2.2, c: shade(col.c, (Math.random() - 0.5) * 0.4), life: 1 })
    }
    if (this.frags.length > 160) this.frags.splice(0, this.frags.length - 160)
    if (this.crumbs.length > 400) this.crumbs.splice(0, this.crumbs.length - 400)
  }

  // 꾹 누르기 — 말랑하게 눌렸다가 가운데 근처 몇 조각이 한꺼번에
  squeeze(x, y) {
    if (this.coatT < 0.7 || !this.showWax) return
    this.squash.v -= 0.12
    let n = 0
    for (let t = 0; t < 4; t++) {
      const a = Math.random() * Math.PI * 2, r = this.S * 0.25 * Math.random()
      if (this.hit(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.8)) n++
    }
    return n
  }

  // 고양이 고르기 단계 = 왁스 없이 맨 얼굴 · 다시 켜면 입히는 모습부터
  setShowWax(on) {
    if (on === this.showWax) return
    this.showWax = on
    if (on) this.coatT = 0
  }

  restore() {
    for (const L of this.layers) { L.shards.forEach(s => { s.alive = true; s.crack = 0; s.lines = [] }); L.dirty = true }
    this.coatT = 0
    this.report()
  }

  report() {
    const per = this.layers.map(L => ({ total: L.total, left: L.shards.filter(s => s.alive).length }))
    const total = per.reduce((a, b) => a + b.total, 0)
    const left = per.reduce((a, b) => a + b.left, 0)
    this.on.onProgress?.({ pct: total ? Math.round(((total - left) / total) * 100) : 0, per })
  }

  start() { if (!this.raf) this.raf = requestAnimationFrame(this.loop) }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0 }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop)
    const { ctx: g, dpr, w, h } = this
    if (!this.img) return
    // 시간 기준(느린 기기·화면 주사율이 달라도 같은 빠르기) — 한 프레임 = 60Hz 기준 몇 칸인가
    const dtMs = Math.min(64, Math.max(4, (now || 0) - (this.lastT || now || 0) || 16.7))
    this.lastT = now
    const steps = Math.max(1, Math.round(dtMs / 16.7))
    // 스프링(눌림 → 튕김)
    const sq = this.squash
    for (let i = 0; i < steps; i++) { sq.v += (1 - sq.s) * 0.22; sq.v *= 0.78; sq.s += sq.v }
    this.shake *= Math.pow(0.86, steps)
    if (this.showWax && this.coatT < 1) this.coatT = Math.min(1, this.coatT + dtMs / 500)

    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    // 바닥 그림자
    g.fillStyle = 'rgba(40,30,60,0.12)'
    g.beginPath(); g.ellipse(this.cx, this.cy + this.S * 0.62, this.S * 0.58 * (2 - sq.s), this.S * 0.08, 0, 0, Math.PI * 2); g.fill()

    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake
    g.save()
    g.translate(this.cx + sx, this.cy + this.S * 0.55 + sy)
    g.scale(2 - sq.s, sq.s)
    g.translate(-this.cx, -(this.cy + this.S * 0.55))
    const [bx, by, bs] = this.catBox
    // 그림 = 픽셀 고양이 + 그린 선을 합친 캔버스(WaxHome) — 줄여 그리니 부드럽게
    g.imageSmoothingQuality = 'high'
    g.drawImage(this.img, bx, by, bs, bs)
    // 안쪽 겹부터 그린다(3단계 → 1단계)
    for (let j = this.layers.length - 1; j >= 0; j--) {
      const L = this.layers[j]
      if (L.dirty) this.renderLayer(L)
      // 되돌리기 = 바깥 겹일수록 늦게 덮인다
      const appear = this.showWax ? Math.max(0, Math.min(1, this.coatT * 3 - (2 - j))) : 0
      if (appear <= 0) continue
      g.globalAlpha = waxColor(this.colors[L.i]).a * 0.86 * appear
      const sc = 1 + (1 - appear) * 0.08
      g.save()
      g.translate(this.cx, this.cy); g.scale(sc, sc); g.translate(-this.cx, -this.cy)
      g.drawImage(L.view, 0, 0, w, h)
      g.restore()
    }
    g.globalAlpha = 1
    g.restore()

    // 날아가는 조각 · 부스러기
    const floor = this.cy + this.S * 0.66
    for (const f of this.frags) {
      for (let i = 0; i < steps; i++) {
        f.vy += 0.42; f.x += f.vx; f.y += f.vy; f.rot += f.vr
        if (f.y > floor && f.vy > 0) { f.y = floor; f.vy *= -0.32; f.vx *= 0.7; f.vr *= 0.6 }
        f.life -= 0.012
      }
      g.save(); g.globalAlpha = Math.max(0, Math.min(1, f.life * 2.2)) * f.a
      g.translate(f.x, f.y); g.rotate(f.rot)
      g.drawImage(f.spr, -f.ox, -f.oy, f.w, f.h)
      g.restore()
    }
    this.frags = this.frags.filter(f => f.life > 0)
    for (const c of this.crumbs) {
      for (let i = 0; i < steps; i++) {
        c.vy += 0.38; c.x += c.vx; c.y += c.vy
        if (c.y > floor && c.vy > 0) { c.y = floor; c.vy *= -0.25; c.vx *= 0.6 }
        c.life -= 0.016
      }
      g.globalAlpha = Math.max(0, c.life)
      g.fillStyle = c.c; g.fillRect(c.x - c.r / 2, c.y - c.r / 2, c.r, c.r)
    }
    g.globalAlpha = 1
    this.crumbs = this.crumbs.filter(c => c.life > 0)
  }
}
