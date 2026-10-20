// 3D 홈 배경 음악 — 음원 파일 없이 브라우저가 그 자리에서 만든다(저작권·용량 0).
// 소리 = 통통 튀는 젤리 실로폰(짧은 음이 살짝 위로 휘며 시작) + 부드러운 배경 화음 + 낮은 베이스 + 가끔 물방울.
// 장면마다 분위기가 다르다: 젤리 성 = 느긋한 오후 · 시트러스 = 상큼하고 빠르게 · 문어 = 물속처럼 느리고 출렁이게.
// 같은 장면이면 같은 노래가 흐른다(씨앗 고정) — 마디마다 짧은 선율을 만들어 두 번 되풀이하고 조금씩 바꾼다.
// 쓰는 법: const m = createJellyMusic(); m.start('jelly')(사용자가 누른 순간에) · m.setScene('octopus') · m.stop()

export const MUSIC_MOODS = {
  jelly:   { name: '젤리 성 · 느긋한 오후', bpm: 84,  key: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], pluck: 0.9, rest: 0.34, bubbles: 0.10, wobble: 0,   bright: 2600, padVol: 0.06 },
  citrus:  { name: '시트러스 · 상큼하게',   bpm: 104, key: 62, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 12], [5, 9, 12, 16], [7, 11, 14, 19], [4, 7, 11, 16]], pluck: 1.0, rest: 0.22, bubbles: 0.06, wobble: 0,   bright: 3600, padVol: 0.045 },
  octopus: { name: '젤리 문어 · 물속에서',  bpm: 70,  key: 57, scale: [0, 2, 3, 7, 9], prog: [[0, 3, 7, 10], [5, 9, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]], pluck: 0.75, rest: 0.42, bubbles: 0.30, wobble: 1, bright: 1700, padVol: 0.075 },
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12)

export function createJellyMusic({ volume = 0.22, onNote } = {}) {
  let ctx = null, master = null, wet = null, dry = null, timer = null
  let mood = MUSIC_MOODS.jelly, moodKey = 'jelly'
  let step = 0, nextT = 0, motif = [], seed = 1
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    ctx = new AC()
    master = ctx.createGain(); master.gain.value = 0
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3
    master.connect(comp); comp.connect(ctx.destination)
    // 잔향 — 짧게 사그라드는 잡음으로 만든 방울림
    const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) }
    conv.buffer = ir
    wet = ctx.createGain(); wet.gain.value = 0.32; wet.connect(conv); conv.connect(master)
    dry = ctx.createGain(); dry.gain.value = 0.8; dry.connect(master)
    return true
  }
  const out = (node, wetAmt = 1) => { node.connect(dry); const g = ctx.createGain(); g.gain.value = wetAmt; node.connect(g); g.connect(wet) }

  // 젤리 실로폰 — 살짝 낮게 시작해 제 음으로 휘어 오르는 '뽀용' 소리
  function pluck(t, midi, vel) {
    const f = mtof(midi), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter()
    o1.type = 'sine'; o2.type = 'triangle'
    o1.frequency.setValueAtTime(f * 0.94, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.05)
    o2.frequency.setValueAtTime(f * 2 * 0.94, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.05)
    if (mood.wobble) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t); lfo.stop(t + 1.2) }
    const g2 = ctx.createGain(); g2.gain.value = 0.18
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(mood.bright, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.6)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * vel * mood.pluck, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); out(lp, 0.9)
    o1.start(t); o2.start(t); o1.stop(t + 1); o2.stop(t + 1)
  }
  // 배경 화음 — 천천히 차오르고 사그라든다
  function pad(t, notes, dur) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = mood.wobble ? 650 : 950
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(mood.padVol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05)
    g.connect(lp); out(lp, 1.4)
    for (const n of notes) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = det
      o.connect(g); o.start(t); o.stop(t + dur * 1.1)
    }
  }
  function bass(t, midi, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(midi)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); out(g, 0.2); o.start(t); o.stop(t + dur + 0.05)
  }
  // 물방울 — 위로 쭉 미끄러지는 아주 짧은 소리
  function bubble(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = 500 + rnd() * 900
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.6, t + 0.09)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(g); out(g, 1.2); o.start(t); o.stop(t + 0.15)
  }

  // 두 마디짜리 선율 — 음계 위를 걷듯 움직이고, 쉼표를 섞는다
  function makeMotif() {
    const sc = mood.scale, m = []
    let deg = 5 + Math.floor(rnd() * 3)
    for (let i = 0; i < 16; i++) {
      if (rnd() < mood.rest && i % 4 !== 0) { m.push(null); continue }
      deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)]
      deg = Math.max(2, Math.min(11, deg))
      m.push(deg)
    }
    return m
  }
  const degToMidi = d => mood.key + 12 + mood.scale[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5) - 12

  function schedule() {
    const spb = 60 / mood.bpm / 2 // 8분음표
    while (nextT < ctx.currentTime + 0.15) {
      const t = nextT, bar = Math.floor(step / 8), inBar = step % 8
      const chord = mood.prog[bar % mood.prog.length]
      if (step % 32 === 0) { motif = makeMotif() }                 // 네 마디마다 새 선율(두 번 되풀이)
      else if (step % 32 === 16 && rnd() < 0.5) motif = motif.map(d => d === null ? null : d + (rnd() < 0.25 ? 1 : 0))
      if (inBar === 0) {
        pad(t, chord.map(n => mood.key + n), spb * 8)
        bass(t, mood.key - 12 + chord[0], spb * 5)
      }
      if (inBar === 4 && rnd() < 0.6) bass(t, mood.key - 12 + chord[0] + (rnd() < 0.5 ? 7 : 0), spb * 3)
      const d = motif[step % 16]
      if (d !== null && d !== undefined) {
        // 화음에 맞는 음으로 살짝 끌어당긴다
        let midi = degToMidi(d)
        const pcs = chord.map(n => (mood.key + n) % 12)
        if (inBar % 2 === 0 && !pcs.includes(midi % 12)) midi += pcs.includes((midi + 2) % 12) ? 2 : pcs.includes((midi + 1) % 12) ? 1 : 0
        pluck(t + (rnd() - 0.5) * 0.012, midi, inBar % 2 === 0 ? 1 : 0.7)
        if (onNote) { const at = t; setTimeout(() => onNote(midi), Math.max(0, (at - ctx.currentTime) * 1000)) }
      }
      if (rnd() < mood.bubbles) bubble(t + rnd() * spb)
      nextT += spb; step++
    }
  }

  return {
    get playing() { return !!timer },
    get scene() { return moodKey },
    async start(scene = 'jelly') {
      if (!ctx && !build()) return false
      if (ctx.state === 'suspended') await ctx.resume()
      this.setScene(scene)
      if (timer) return true
      nextT = ctx.currentTime + 0.1
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
      master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.6)
      timer = setInterval(schedule, 30)
      return true
    },
    setScene(scene) {
      const k = MUSIC_MOODS[scene] ? scene : 'jelly'
      if (k === moodKey && motif.length) return
      moodKey = k; mood = MUSIC_MOODS[k]
      seed = { jelly: 11, citrus: 23, octopus: 37 }[k] || 11
      step = 0; motif = []
    },
    stop() {
      if (!ctx || !timer) return
      clearInterval(timer); timer = null
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(0.5, v))
      if (ctx && timer) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(volume, ctx.currentTime, 0.08) }
    },
    suspend() { ctx?.suspend() },
    resume() { if (timer) ctx?.resume() },
    close() { this.stop(); setTimeout(() => { try { ctx?.close() } catch {} ctx = null }, 700) },
  }
}
