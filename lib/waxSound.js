'use client'
// 왁뿌 소리 — 전부 Web Audio 로 그 자리에서 합성한다(소리 파일 없음 · 다른 사이트 소리 복사 없음).
//   · crack(세기, 밝기)  = 파삭: 짧은 띠 잡음 + 잘게 튀는 바스락 알갱이 + 두꺼울수록 낮은 툭
//   · squish()           = 말랑하게 쥘 때 낮은 눌림
//   · coat()             = 원래대로 되돌릴 때 뽀득 + 반짝
//   · clear(단계)        = 한 단계를 다 깼을 때 두 음
// 첫 터치 때 만든다(브라우저는 사용자 동작 전 소리를 막는다). 끄기 = localStorage 2hs_wax_sfx = 'off'.

const MUTE_KEY = '2hs_wax_sfx'
let ctx = null, master = null, noiseBuf = null

export function waxSoundOn() {
  try { return localStorage.getItem(MUTE_KEY) !== 'off' } catch { return true }
}
export function setWaxSound(on) {
  try { localStorage.setItem(MUTE_KEY, on ? 'on' : 'off') } catch {}
}

function ensure() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14; comp.ratio.value = 4
    master = ctx.createGain(); master.gain.value = 0.8
    master.connect(comp); comp.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// 첫 터치에 불러 두면 첫 파삭이 늦지 않는다
export function unlockWaxSound() { if (waxSoundOn()) ensure() }

function noise(t, dur, { type = 'bandpass', freq = 3000, q = 1, gain = 0.5, attack = 0.001, decay = 0.05, rate = 1 } = {}) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = rate
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  src.connect(f); f.connect(g); g.connect(master)
  src.start(t, Math.random() * 0.8, dur + 0.05)
}

function tone(t, f0, f1, dur, gain, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(master)
  o.start(t); o.stop(t + dur + 0.02)
}

// intensity 0..1 = 한 번에 깨진 양 · bright 0..1 = 바깥 단계일수록 얇고 밝은 소리
export function crack(intensity = 0.5, bright = 0.5) {
  if (!waxSoundOn() || !ensure()) return
  const t = ctx.currentTime + 0.002
  const k = Math.min(1, Math.max(0.15, intensity))
  // 파삭 — 메인 스냅
  noise(t, 0.09, { freq: 1800 + bright * 2600 + Math.random() * 600, q: 0.9, gain: 0.35 + k * 0.45, decay: 0.035 + k * 0.04 })
  // 바스락 알갱이 — 잘게 여러 번
  const grains = 3 + Math.round(k * 6)
  for (let i = 0; i < grains; i++) {
    const dt = Math.random() * (0.03 + k * 0.08)
    noise(t + dt, 0.02, { type: 'highpass', freq: 3500 + Math.random() * 3000, q: 0.7, gain: 0.08 + Math.random() * 0.22, decay: 0.006 + Math.random() * 0.012, rate: 0.8 + Math.random() * 0.6 })
  }
  // 툭 — 두꺼운 왁스일수록(안쪽 단계) 크게
  tone(t, 170 - bright * 40, 70, 0.07 + k * 0.05, 0.12 + (1 - bright) * 0.18 * k)
}

export function squish() {
  if (!waxSoundOn() || !ensure()) return
  const t = ctx.currentTime + 0.002
  noise(t, 0.2, { type: 'lowpass', freq: 700, q: 2, gain: 0.25, attack: 0.02, decay: 0.16 })
  tone(t, 240, 150, 0.18, 0.08, 'triangle')
}

export function coat() {
  if (!waxSoundOn() || !ensure()) return
  const t = ctx.currentTime + 0.002
  tone(t, 380, 920, 0.22, 0.18)
  noise(t + 0.05, 0.3, { type: 'highpass', freq: 6000, q: 0.5, gain: 0.06, attack: 0.04, decay: 0.25 })
  tone(t + 0.12, 1320, 1500, 0.25, 0.06)
}

export function clear(stage = 1) {
  if (!waxSoundOn() || !ensure()) return
  const t = ctx.currentTime + 0.01
  const base = [660, 740, 880][Math.max(0, Math.min(2, stage - 1))]
  tone(t, base, base, 0.22, 0.14, 'triangle')
  tone(t + 0.11, base * 1.5, base * 1.5, 0.3, 0.12, 'triangle')
}

// 진동 — 안드로이드 크롬 등에서만 있다(iOS 사파리는 없음 = 조용히 넘어간다). 너무 잦으면 거른다.
let lastBuzz = 0
export function buzz(ms = 12) {
  const now = performance.now()
  if (now - lastBuzz < 45) return
  lastBuzz = now
  try { if (navigator.vibrate) navigator.vibrate(ms) } catch {}
}

// 그리기 — 아주 작은 사각 소리(펜이 종이 위를 지날 때). 너무 잦으면 거른다.
let lastScr = 0
export function scribble(speed = 0.5) {
  if (!waxSoundOn() || !ensure()) return
  const now = performance.now()
  if (now - lastScr < 70) return
  lastScr = now
  const t = ctx.currentTime + 0.002
  noise(t, 0.08, { freq: 2200 + speed * 2500, q: 1.4, gain: 0.04 + speed * 0.05, attack: 0.01, decay: 0.06 })
}
