// 3D 홈 배경음악 — 마을 게임처럼 잔잔하게 깔리는 곡. 음원 파일 없이 브라우저가 그 자리에서 만든다(저작권·용량 0, 이 앱을 위해 새로 쓴 선율).
// 기기 시계를 보고 아침(5–11시)·낮(11–17시)·저녁(17–20시)·밤(20–5시) 곡이 바뀐다 — 바뀌면 다음 바퀴(여덟 마디)부터.
// 악기 = 동글한 전자 피아노 화음 + 둥근 베이스 + 선율(휘파람·마림바·오르골) + 작은 셰이커·림 + 새 소리·귀뚜라미. 두 바퀴째는 앞 네 마디 선율을 쉰다.
// 반응 소리(public/jelly-sfx.js)와는 따로 켜고 끈다. 쓰는 법: const m = createCozyMusic(); await m.start()(사용자가 누른 순간에) · m.stop()
// 미리 듣기 = https://claude.ai/artifact/UgPPGBEXiTeMu8ctiLxwtP (2026-10-20 사용자 확정)
const mtof = m => 440 * Math.pow(2, (m - 69) / 12)
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const n2m = s => { const m = /^([A-G])([#b]?)(\d)$/.exec(s); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) }
const Q = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], '7sus': [0, 5, 7, 10], '6': [0, 4, 7, 9], m9: [0, 3, 7, 14] }
const chordOf = s => { const m = /^([A-G][#b]?)(.*)$/.exec(s), r = n2m(m[1] + '3'), q = Q[m[2]] || [0, 4, 7]; return { root: r, notes: q.map(i => r + i) } }

// 곡 넷 — 마디마다 화음(반 마디씩 둘일 수 있음) + 8분음표 여덟 칸 선율('-' = 끌기, '.' = 쉼)
export const TRACKS = {
  morning: { name: '아침 · 산책', desc: '휘파람 선율 · 조금 빠르게 · 새 지저귐', bpm: 96, swing: 0.6, lead: 'whistle', perc: 1, birds: 1,
    chords: ['Fmaj7', 'Am7', 'Bbmaj7', 'C7sus', 'Fmaj7', 'Dm7', 'Gm7', 'C7'],
    mel: ['A4 - C5 - E5 - D5 C5', 'E5 - - . C5 - A4 -', 'D5 - F5 - D5 C5 Bb4 -', 'C5 - - - . . G4 A4', 'A4 - C5 - F5 - E5 D5', 'F5 - A5 - G5 F5 D5 -', 'Bb4 - D5 - F5 - E5 D5', 'E5 - - - C5 . . .'] },
  noon: { name: '낮 · 느긋한 오후', desc: '통통 마림바 · 가볍게 흔들리는 박자', bpm: 88, swing: 0.62, lead: 'marimba', perc: 1, birds: 0,
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7 G7', 'Cmaj7'],
    mel: ['E5 . G5 . E5 D5 C5 -', 'A4 - C5 - E5 - - .', 'F5 . E5 . D5 - A4 -', 'B4 - D5 - G5 - - .', 'G5 - E5 - B4 - D5 E5', 'C#5 - E5 - G5 - E5 -', 'F5 - D5 - B4 - D5 -', 'C5 - - - . . . .'] },
  evening: { name: '저녁 · 노을', desc: '느린 휘파람 · 따뜻한 건반 · 귀뚜라미', bpm: 78, swing: 0.6, lead: 'whistle', perc: 0.6, birds: 0, crickets: 1,
    chords: ['Gmaj7', 'Bm7', 'Cmaj7', 'Am7 D7', 'Gmaj7', 'Em7', 'Am7', 'D7sus'],
    mel: ['B4 - - D5 . B4 A4 -', 'F#4 - - - . . A4 B4', 'C5 - E5 - G5 - E5 -', 'D5 - - - C5 B4 A4 -', 'B4 - D5 - F#5 - E5 D5', 'E5 - G5 - - . E5 -', 'C5 - - E5 . D5 C5 -', 'A4 - - - . . . .'] },
  night: { name: '밤 · 별빛', desc: '오르골 · 아주 느리게 · 박자 소리 없음', bpm: 68, swing: 0.55, lead: 'musicbox', perc: 0, birds: 0, crickets: 0.5,
    chords: ['Dm7', 'Bbmaj7', 'Gm7', 'A7sus A7', 'Dm7', 'Bbmaj7', 'Gm7 C7', 'Fmaj7'],
    mel: ['A5 - - . F5 - E5 -', 'D5 - - - . . F5 -', 'Bb5 - A5 - G5 - F5 -', 'E5 - - - . . . .', 'A5 - - . D6 - C6 -', 'A5 - - - F5 - G5 -', 'Bb5 - - . A5 - G5 -', 'A5 - - - . . . .'] },
}
const ORDER = ['morning', 'noon', 'evening', 'night']
const byClock = (h = new Date().getHours()) => h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'noon' : h >= 17 && h < 20 ? 'evening' : 'night'
function parse(tr) { // 선율 → [{step, midi, len}]
  const out = []
  tr.mel.forEach((bar, b) => { const cells = bar.trim().split(/\s+/); cells.forEach((c, i) => { if (c === '-' || c === '.') return
    let len = 1; while (cells[i + len] === '-') len++
    out.push({ step: b * 8 + i, midi: n2m(c), len }) }) })
  return out
}


export function createCozyMusic({ volume = 0.2 } = {}) {
  let ctx = null, master = null, dry = null, wet = null, noiseBuf = null, timer = null
    let key = byClock(), tr = TRACKS[key], notes = parse(tr), step = 0, nextT = 0, loop = 0
  function build() {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return false
    ctx = new A(); master = ctx.createGain(); master.gain.value = 0
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination)
    const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5) }
    conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.28; wet.connect(conv); conv.connect(master)
    dry = ctx.createGain(); dry.gain.value = 0.85; dry.connect(master)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return true
  }
  const send = (node, w = 1) => { node.connect(dry); const g = ctx.createGain(); g.gain.value = w; node.connect(g); g.connect(wet) }
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d) }

  // 건반 — 동글한 전자 피아노
  function keys(t, ms, dur, vel = 1) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; send(lp, 0.9)
    for (const m of ms) { const f = mtof(m)
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; env(g, t, 0.045 * vel, 0.01, dur)
      const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.value = f * 4; env(g2, t, 0.008 * vel, 0.003, 0.12)
      o.connect(g); o2.connect(g2); g.connect(lp); g2.connect(lp); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + 0.2) }
  }
  function bass(t, m, dur) { const f = mtof(m), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'triangle'; o2.frequency.value = f; g2.gain.value = 0.25
    env(g, t, 0.15, 0.02, dur); o.connect(g); o2.connect(g2); g2.connect(g); send(g, 0.15); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05) }
  // 선율 악기 셋
  function lead(t, m, dur, kind) { const f = mtof(m)
    if (kind === 'whistle') { const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'sine'
      o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04)
      l.frequency.value = 5.4; lg.gain.setValueAtTime(0.0001, t); lg.gain.linearRampToValueAtTime(f * 0.009, t + 0.18); l.connect(lg); lg.connect(o.frequency)
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.04); g.gain.setValueAtTime(0.07, t + Math.max(0.05, dur - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12)
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noiseBuf; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 8; ng.gain.value = 0.06
      n.connect(bp); bp.connect(ng); ng.connect(g); o.connect(g); send(g, 1.1); o.start(t); l.start(t); n.start(t, Math.random()); o.stop(t + dur + 0.2); l.stop(t + dur + 0.2); n.stop(t + dur + 0.2)
    } else if (kind === 'marimba') { for (const [mul, v, d] of [[1, 0.09, 0.45], [4, 0.025, 0.06], [10, 0.006, 0.02]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * mul; env(g, t, v, 0.004, d); o.connect(g); send(g, 0.8); o.start(t); o.stop(t + d + 0.05) }
    } else { for (const [mul, v, d, ty] of [[1, 0.06, 1.3, 'triangle'], [3.01, 0.018, 0.5, 'sine'], [5.98, 0.008, 0.2, 'sine']]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = ty; o.frequency.value = f * mul; env(g, t, v, 0.003, d); o.connect(g); send(g, 1.3); o.start(t); o.stop(t + d + 0.05) } }
  }
  function shaker(t, v) { const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6000; env(g, t, v, 0.006, 0.05); n.connect(hp); hp.connect(g); send(g, 0.3); n.start(t, Math.random() * 0.8); n.stop(t + 0.08) }
  function rim(t) { const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 6; env(g, t, 0.05, 0.002, 0.04); n.connect(bp); bp.connect(g); send(g, 0.5); n.start(t, Math.random() * 0.8); n.stop(t + 0.06) }
  function bird(t) { for (let k = 0; k < 2 + (Math.random() * 2 | 0); k++) { const tt = t + k * 0.11, f = 2600 + Math.random() * 900, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'
    o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 1.35, tt + 0.05); o.frequency.exponentialRampToValueAtTime(f * 0.9, tt + 0.08); env(g, tt, 0.018, 0.005, 0.07); o.connect(g); send(g, 1.2); o.start(tt); o.stop(tt + 0.1) } }
  function cricket(t) { for (let k = 0; k < 3; k++) { const tt = t + k * 0.05, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 4300; env(g, tt, 0.008, 0.004, 0.03); o.connect(g); send(g, 1); o.start(tt); o.stop(tt + 0.05) } }

  const comp = [0, 3, 6] // 건반 치는 자리(8분음표 칸)
  function schedule() {
    const spb = 60 / tr.bpm / 2, bar8 = spb * 8
    while (nextT < ctx.currentTime + 0.15) {
      const s = step % 64, bar = s >> 3, i = s & 7
      const odd = i % 2 === 1, t = nextT + (odd ? (tr.swing - 0.5) * 2 * spb : 0)
      const parts = tr.chords[bar].split(' '), ch = chordOf(parts.length > 1 && i >= 4 ? parts[1] : parts[0])
      const voice = ch.notes.map(n => (n < 52 ? n + 12 : n)).slice(1).concat([ch.notes[0] + 12])
      if (comp.includes(i) || (parts.length > 1 && i === 4)) keys(t, voice, i === 0 || i === 4 ? spb * 2.6 : spb * 1.2, i === 0 ? 1 : 0.75)
      if (i === 0) bass(t, ch.root - 12, spb * 3)
      if (i === 4) bass(t, (parts.length > 1 ? chordOf(parts[1]).root : ch.root + 7) - 12, spb * 2.5)
      if (tr.perc) { shaker(t, (odd ? 0.022 : 0.012) * tr.perc); if (i === 2 || i === 6) rim(t) }
      // 두 바퀴째는 앞 네 마디 선율을 쉬어 숨을 돌린다
      if (!(loop % 2 === 1 && bar < 4)) for (const n of notes) if (n.step === s) lead(t, n.midi, n.len * spb * 0.95, tr.lead)
      if (tr.birds && Math.random() < 0.025) bird(t)
      if (tr.crickets && Math.random() < 0.04 * tr.crickets) cricket(t)
      nextT += spb; step++; if (step % 64 === 0) loop++
    }
  }

  function setTrack(k) { if (!TRACKS[k] || k === key) return; key = k; tr = TRACKS[k]; notes = parse(tr); step = Math.ceil(step / 64) * 64 }
  let clock = null
  return {
    get playing() { return !!timer },
    get track() { return key },
    async start() {
      if (!ctx && !build()) return false
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch {} }
      if (ctx.state !== 'running') return false
      setTrack(byClock())
      if (timer) return true
      nextT = ctx.currentTime + 0.1
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2)
      timer = setInterval(schedule, 30)
      clock = setInterval(() => setTrack(byClock()), 60000) // 시간대가 바뀌면 다음 바퀴부터 그 곡
      return true
    },
    stop() {
      if (!ctx || !timer) return
      clearInterval(timer); timer = null; clearInterval(clock); clock = null
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    },
    suspend() { try { ctx?.suspend() } catch {} },
    resume() { if (timer) { try { ctx?.resume() } catch {} } },
    close() { this.stop(); setTimeout(() => { try { ctx?.close() } catch {} ctx = null }, 700) },
  }
}
