// 3D 홈 반응 소리 — 젤리를 만지고 물을 끌고 배를 움직일 때 나는 짧은 소리. 음원 파일 없이 그 자리에서 만든다.
// 한 파일을 3D 홈(Next 화면)·시트러스 젤리·젤리 문어(iframe 한 파일 장면)가 같이 쓴다: <script src="/jelly-sfx.js"> → window.JellySfx
//   JellySfx.play('boing', { s: 0.8, pitch: 1 })   · 소리 이름 = boing squish stretch pop splash drip chime splat thud whistle gulp growl
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

  // 소리 2안(2026-10-20) — 높고 짧고 동글동글, 끝을 살짝 올린다. 음은 도·레·미·솔·라 안에서 골라 겹쳐도 화음처럼 들린다.
  // 젤리 소리 = 「말캉 쫀득」: 낮고 둥근 몸통이 꿀렁꿀렁 흔들리다 끝에 「쫀」 하고 당겨 붙는다.
  const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1567.98 }
  // 동그란 한 방울: 낮게 시작 → 쭉 올라갔다(peak) → 제 음(f)에 앉으며 파르르(vib)
  function blip(t, f, { from = 0.7, peak = 1.4, up = 0.045, settle = 0.12, dur = 0.3, vol = 0.25, vib = 0, depth = 0, oct = 0.12 }) {
    for (const [mul, v, type] of [[1, vol, 'sine'], [2, vol * oct, 'triangle']]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type
      o.frequency.setValueAtTime(f * mul * from, t); o.frequency.exponentialRampToValueAtTime(f * mul * peak, t + up); o.frequency.exponentialRampToValueAtTime(f * mul, t + settle)
      if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib; lg.gain.setValueAtTime(f * mul * depth, t + up); lg.gain.exponentialRampToValueAtTime(0.01, t + dur); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05) }
      env(g, t, v, 0.008, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05)
    }
  }

  const SOUNDS = {
    // 젤리 — 「말캉 쫀득」: 낮고 둥근 몸통이 느리게 꿀렁(7→4.5Hz)이다 끝에 「쫀」
    boing(t, { s = 1, pitch = 1 }) {
      const f = 392 * pitch * (1 + 0.08 * s), v = 0.3 * (0.55 + 0.45 * s)
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'triangle'
      o.frequency.setValueAtTime(f * 1.4, t); o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 0.07); o.frequency.exponentialRampToValueAtTime(f, t + 0.16)
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.setValueAtTime(7, t); l.frequency.linearRampToValueAtTime(4.5, t + 0.45)
      lg.gain.setValueAtTime(f * 0.11 * s, t + 0.05); lg.gain.exponentialRampToValueAtTime(0.5, t + 0.45); l.connect(lg); lg.connect(o.frequency)
      lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(650, t + 0.3)
      const trem = ctx.createGain(), tl = ctx.createOscillator(), tg = ctx.createGain(); trem.gain.value = 1; tl.frequency.value = 6; tg.gain.value = 0.25; tl.connect(tg); tg.connect(trem.gain)
      env(g, t, v, 0.012, 0.42); o.connect(lp); lp.connect(trem); trem.connect(g); g.connect(out)
      o.start(t); l.start(t); tl.start(t); o.stop(t + 0.5); l.stop(t + 0.5); tl.stop(t + 0.5)
      const n = noise(t, 0.05), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 3
      env(ng, t, 0.07 * s, 0.004, 0.04); n.connect(bp); bp.connect(ng); ng.connect(out)
      blip(t + 0.24, f * 1.5, { from: 0.8, peak: 1.45, up: 0.025, settle: 0.05, dur: 0.09, vol: v * 0.42, oct: 0.05 })
    },
    // 꾹 누를 때 — 「뽀옥」: 눌려서 내려갔다 다시 동그랗게 올라옴
    squish(t, { s = 1 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(NOTE.E5, t); o.frequency.exponentialRampToValueAtTime(NOTE.C5 * 0.62, t + 0.08); o.frequency.exponentialRampToValueAtTime(NOTE.G5, t + 0.19)
      env(g, t, 0.24 * s, 0.012, 0.2); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.26)
      const n = noise(t, 0.09), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 700
      env(ng, t, 0.05 * s, 0.01, 0.07); n.connect(lp); lp.connect(ng); ng.connect(out)
    },
    // 잡아 늘릴 때 — 「뾰오」: 늘릴수록 높아지는 작은 피리
    stretch(t, { s = 0.5 }) {
      blip(t, NOTE.C5 * (1 + 1.2 * s), { from: 0.96, peak: 1.06, up: 0.04, settle: 0.09, dur: 0.1, vol: 0.06 + 0.05 * s, vib: 9, depth: 0.025, oct: 0.05 })
    },
    // 단추·작은 방울 — 「뽁」: 더 높고 짧게, 끝에 아주 작은 딸깍
    pop(t, { pitch = 1 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(NOTE.G5 * pitch, t); o.frequency.exponentialRampToValueAtTime(NOTE.G6 * 1.2 * pitch, t + 0.035)
      env(g, t, 0.22, 0.003, 0.06); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.09)
      const n = noise(t, 0.02), hp = ctx.createBiquadFilter(), ng = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 3500
      env(ng, t, 0.05, 0.001, 0.012); n.connect(hp); hp.connect(ng); ng.connect(out)
    },
    // 물을 칠 때 — 「찰랑」: 물소리는 부드럽게, 동그란 방울을 더
    splash(t, { s = 1 }) {
      const n = noise(t, 0.4), lp = ctx.createBiquadFilter(), g = ctx.createGain()
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.3)
      env(g, t, 0.12 * s, 0.008, 0.3); n.connect(lp); lp.connect(g); g.connect(out)
      for (let k = 0; k < 5; k++) SOUNDS.drip(t + 0.05 + k * 0.06 + Math.random() * 0.03, { s: 0.75 * s })
    },
    // 물방울 — 「퐁」: 동그란 보글
    drip(t, { s = 1 }) {
      const fs = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5], f = fs[(Math.random() * fs.length) | 0]
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(f * 0.8, t); o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.05)
      env(g, t, 0.12 * s, 0.006, 0.07); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1)
    },
    // 탑·성문·냥이를 눌러 들어갈 때 — 「딩동댕」: 오르골처럼 도·미·솔
    chime(t) {
      [NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, k) => {
        const dt = k * 0.085, o = ctx.createOscillator(), g = ctx.createGain(), o2 = ctx.createOscillator(), g2 = ctx.createGain()
        o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 4.1
        env(g, t + dt, 0.11, 0.003, 0.7); env(g2, t + dt, 0.025, 0.002, 0.12)
        o.connect(g); o2.connect(g2); g.connect(out); g2.connect(out); o.start(t + dt); o2.start(t + dt); o.stop(t + dt + 0.8); o2.stop(t + dt + 0.2)
      })
    },
    // 먹물 — 「퓨슉 보글보글」: 짧은 숨 + 방울이 오르내림
    splat(t, { s = 1 }) {
      const n = noise(t, 0.16), bp = ctx.createBiquadFilter(), g = ctx.createGain()
      bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(1400, t); bp.frequency.exponentialRampToValueAtTime(600, t + 0.14)
      env(g, t, 0.14 * s, 0.006, 0.14); n.connect(bp); bp.connect(g); g.connect(out)
      ;[NOTE.C5, NOTE.E5, NOTE.D5, NOTE.G5, NOTE.E5, NOTE.A5].forEach((f, k) => {
        const o = ctx.createOscillator(), og = ctx.createGain(), tt = t + 0.12 + k * 0.075; o.type = 'sine'
        o.frequency.setValueAtTime(f * 0.75, tt); o.frequency.exponentialRampToValueAtTime(f * 1.9, tt + 0.05)
        env(og, tt, 0.1 * s, 0.005, 0.07); o.connect(og); og.connect(out); o.start(tt); o.stop(tt + 0.1)
      })
    },
    // 기차 경적 — 「뿌뿌!」(2026-10-20 사용자 선택 A안): 장난감 기차처럼 미·솔# 두 음이 함께, 짧게 두 번 통통
    whistle(t, { s = 1 }) {
      const toot = (t0, f, dur) => {
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.13 * s, t0 + 0.035)
        g.gain.setValueAtTime(0.13 * s, t0 + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.09); g.connect(out)
        for (const [mul, v, ty] of [[1, 1, 'sine'], [2, 0.2, 'triangle']]) {
          const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty
          o.frequency.setValueAtTime(f * mul * 0.82, t0); o.frequency.exponentialRampToValueAtTime(f * mul, t0 + 0.05)
          o.frequency.setValueAtTime(f * mul, t0 + dur * 0.7); o.frequency.exponentialRampToValueAtTime(f * mul * 1.06, t0 + dur)
          og.gain.value = v; o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + dur + 0.12)
        }
        const n = noise(t0, dur + 0.1), bp = ctx.createBiquadFilter(), ng = ctx.createGain()
        bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 3; ng.gain.value = 0.18; n.connect(bp); bp.connect(ng); ng.connect(g)
      }
      for (const [dt, dur] of [[0, 0.16], [0.24, 0.3]]) for (const f of [659.25, 830.61]) toot(t + dt, f, dur)
    },
    // 떨어져 닿을 때 — 「통」: 나무 실로폰처럼 말랑하게
    thud(t, { s = 1 }) {
      const f = 330, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(f * 1.25, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04)
      env(g, t, 0.3 * s, 0.003, 0.22); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3)
      const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.value = f * 3.9
      env(g2, t, 0.05 * s, 0.002, 0.05); o2.connect(g2); g2.connect(out); o2.start(t); o2.stop(t + 0.08)
    },
    // 먹이를 삼킬 때 — 「꿀꺽」: 동그란 방울이 아래로 쑥 내려간다
    gulp(t, { s = 1 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.16)
      env(g, t, 0.26 * s, 0.01, 0.2); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.26)
      blip(t + 0.17, NOTE.E5, { from: 0.8, peak: 1.3, up: 0.03, settle: 0.07, dur: 0.12, vol: 0.12 * s, oct: 0.05 })
    },
    // 배고플 때 — 「꼬르륵」: 낮은 음이 꾸물꾸물 떨리며 세 번 굴러간다
    growl(t, { s = 1 }) {
      for (const [dt, f, dur] of [[0, 150, 0.32], [0.3, 120, 0.3], [0.58, 165, 0.45]]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'triangle'
        lp.type = 'lowpass'; lp.frequency.value = 520
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 17; lg.gain.value = f * 0.18; l.connect(lg); lg.connect(o.frequency)
        o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(f * 0.72, t + dt + dur)
        env(g, t + dt, 0.2 * s, 0.05, dur); o.connect(lp); lp.connect(g); g.connect(out)
        o.start(t + dt); o.stop(t + dt + dur + 0.1); l.start(t + dt); l.stop(t + dt + dur + 0.1)
      }
    },
  }
  // 같은 소리가 너무 촘촘하면 시끄럽다 — 소리마다 최소 간격
  const GAP = { boing: 0.09, squish: 0.12, stretch: 0.075, pop: 0.05, splash: 0.12, drip: 0.035, chime: 0.25, splat: 0.3, thud: 0.08, whistle: 0.7, gulp: 0.15, growl: 1.2 }

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
