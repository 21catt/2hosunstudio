// 3D 홈 반응 소리 — 젤리를 만지고 물을 끌고 배를 움직일 때 나는 짧은 소리. 음원 파일 없이 그 자리에서 만든다.
// 한 파일을 3D 홈(Next 화면)·시트러스 젤리·젤리 문어(iframe 한 파일 장면)가 같이 쓴다: <script src="/jelly-sfx.js"> → window.JellySfx
//   JellySfx.play('boing', { s: 0.8, pitch: 1 })   · 소리 이름 = boing squish stretch pop splash drip chime splat thud
//   JellySfx.wake(speed)                             · 계속 나는 소리(배 물살) — 매 프레임 속도를 넣으면 크기가 따라간다
//   켜고 끄기 = localStorage 2hs_castle_sfx ('0' = 끔, 그 밖 = 켬). 같은 기기의 모든 장면이 같은 값을 본다.
// 휴대폰·브라우저는 사용자가 한 번 누르기 전엔 소리를 못 낸다 — 첫 누름에 저절로 깨운다.
(function () {
  if (window.JellySfx) return
  let ctx = null, out = null, noiseBuf = null, wakeNode = null, wakeGain = null, wakeLast = 0
  const last = {}
  const enabled = () => { try { return localStorage.getItem('2hs_castle_sfx') !== '0' } catch { return true } }
  function ac() {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext
      if (!A) return null
      ctx = new A()
      out = ctx.createGain(); out.gain.value = 0.55
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4
      out.connect(comp); comp.connect(ctx.destination)
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  const wake = () => { if (enabled()) ac() }
  for (const n of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(n, wake, { capture: true, passive: true })
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (enabled()) ctx.resume() })

  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d) }
  const noise = (t, dur) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(t, Math.random() * 0.5); n.stop(t + dur); return n }

  const SOUNDS = {
    // 젤리가 출렁 — 높게 시작해 제 음으로 떨어지며 흔들리는 '뾰요옹'
    boing(t, { s = 1, pitch = 1 }) {
      const f0 = 210 * pitch * (1 + 0.25 * s)
      for (const [mul, vol, type] of [[1, 0.32, 'sine'], [2.01, 0.08, 'triangle']]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain()
        o.type = type; o.frequency.setValueAtTime(f0 * mul * 1.9, t); o.frequency.exponentialRampToValueAtTime(f0 * mul, t + 0.07)
        lfo.frequency.value = 9; lg.gain.setValueAtTime(f0 * mul * 0.16 * s, t); lg.gain.exponentialRampToValueAtTime(0.01, t + 0.55)
        lfo.connect(lg); lg.connect(o.frequency)
        env(g, t, vol * (0.45 + 0.55 * s), 0.006, 0.5 + 0.2 * s)
        o.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + 0.8); lfo.stop(t + 0.8)
      }
    },
    // 꾹 누를 때 — 말랑하게 눌리는 '뭉' 소리
    squish(t, { s = 1 }) {
      const n = noise(t, 0.25), bp = ctx.createBiquadFilter(), g = ctx.createGain()
      bp.type = 'bandpass'; bp.Q.value = 2.2; bp.frequency.setValueAtTime(1000, t); bp.frequency.exponentialRampToValueAtTime(260, t + 0.2)
      env(g, t, 0.22 * s, 0.01, 0.2); n.connect(bp); bp.connect(g); g.connect(out)
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.2)
      env(og, t, 0.22 * s, 0.01, 0.2); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.3)
    },
    // 잡아 늘릴 때 — 늘어날수록 높아지는 고무 '찌익'
    stretch(t, { s = 0.5 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = 260 + 520 * s
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.06, t + 0.07)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
      env(g, t, 0.07 + 0.05 * s, 0.01, 0.07); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12)
    },
    // 단추·작은 방울 — '뽁'
    pop(t, { pitch = 1 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(1300 * pitch, t + 0.05)
      env(g, t, 0.22, 0.004, 0.08); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12)
    },
    // 물을 칠 때 — '찰방'
    splash(t, { s = 1 }) {
      const n = noise(t, 0.6), lp = ctx.createBiquadFilter(), g = ctx.createGain()
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.45)
      env(g, t, 0.24 * s, 0.006, 0.45); n.connect(lp); lp.connect(g); g.connect(out)
      for (let k = 0; k < 4; k++) SOUNDS.drip(t + 0.06 + k * 0.055 + Math.random() * 0.04, { s: 0.7 * s })
    },
    // 물방울 — 위로 쪼르르 '퐁'
    drip(t, { s = 1 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = 700 + Math.random() * 1100
      o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.3, t + 0.06)
      env(g, t, 0.11 * s, 0.004, 0.08); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12)
    },
    // 탑·성문·냥이를 눌러 들어갈 때 — 맑은 두 음 '띵동'
    chime(t) {
      for (const [f, dt] of [[1318.5, 0], [1975.5, 0.09]]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), o2 = ctx.createOscillator(), g2 = ctx.createGain()
        o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.76
        env(g, t + dt, 0.13, 0.004, 1.1); env(g2, t + dt, 0.03, 0.004, 0.35)
        o.connect(g); o2.connect(g2); g.connect(out); g2.connect(out); o.start(t + dt); o2.start(t + dt); o.stop(t + dt + 1.3); o2.stop(t + dt + 0.5)
      }
    },
    // 먹물 — 축축하게 '푸슉' 하고 방울이 보글
    splat(t, { s = 1 }) {
      const n = noise(t, 0.3), bp = ctx.createBiquadFilter(), g = ctx.createGain()
      bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(420, t + 0.22)
      env(g, t, 0.3 * s, 0.004, 0.24); n.connect(bp); bp.connect(g); g.connect(out)
      SOUNDS.thud(t, { s: 0.6 * s })
      for (let k = 0; k < 6; k++) SOUNDS.drip(t + 0.18 + k * 0.07 + Math.random() * 0.05, { s: 0.6 })
    },
    // 떨어져 닿을 때 — 말랑한 '퉁'
    thud(t, { s = 1 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.16)
      env(g, t, 0.36 * s, 0.004, 0.2); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3)
      const n = noise(t, 0.05), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 900
      env(ng, t, 0.1 * s, 0.002, 0.04); n.connect(lp); lp.connect(ng); ng.connect(out)
    },
  }
  // 같은 소리가 너무 촘촘하면 시끄럽다 — 소리마다 최소 간격
  const GAP = { boing: 0.09, squish: 0.12, stretch: 0.075, pop: 0.05, splash: 0.12, drip: 0.035, chime: 0.25, splat: 0.3, thud: 0.08 }

  window.JellySfx = {
    get enabled() { return enabled() },
    set enabled(v) { try { localStorage.setItem('2hs_castle_sfx', v ? '1' : '0') } catch {} if (!v) this.wake(0); else ac() },
    play(name, opts = {}) {
      if (!enabled() || !SOUNDS[name]) return
      const c = ac(); if (!c) return
      if (c.state !== 'running') { c.resume().then(() => { if (c.state === 'running') this.play(name, opts) }, () => {}); return }
      const now = c.currentTime
      if (last[name] && now - last[name] < (GAP[name] || 0.05)) return
      last[name] = now
      try { SOUNDS[name](now + 0.005, opts) } catch {}
    },
    // 배 물살 — 속도(0…1)를 매 프레임 넣는다. 0.2초 동안 안 들어오면 사그라든다
    wake(speed) {
      if (!ctx || ctx.state !== 'running') { if (speed > 0 && enabled()) ac(); if (!ctx || ctx.state !== 'running') return }
      const v = enabled() ? Math.max(0, Math.min(1, speed)) : 0
      if (!wakeNode && v > 0.02) {
        wakeNode = ctx.createBufferSource(); wakeNode.buffer = noiseBuf; wakeNode.loop = true
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.8
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 1.6; lg.gain.value = 160; lfo.connect(lg); lg.connect(bp.frequency); lfo.start()
        wakeGain = ctx.createGain(); wakeGain.gain.value = 0
        wakeNode.connect(bp); bp.connect(wakeGain); wakeGain.connect(out); wakeNode.start()
      }
      if (wakeGain) wakeGain.gain.setTargetAtTime(v * 0.16, ctx.currentTime, 0.12)
      wakeLast = performance.now()
    },
  }
  setInterval(() => { if (wakeGain && performance.now() - wakeLast > 200) wakeGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15) }, 200)
})()
