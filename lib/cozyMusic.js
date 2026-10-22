// 3D 홈 배경음악 — 마을 게임처럼 잔잔하게 깔리는 곡. 음원 파일 없이 브라우저가 그 자리에서 만든다(저작권·용량 0, 이 앱을 위해 새로 쓴 선율).
// 설산 기차 배경에선 캐럴(CAROLS — 징글벨·덱 더 홀스)로 바뀐다(mode 'christmas').
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
// 캐럴 — 설산 기차 배경에서만(2026-10-22). 저작권이 끝난 전래 캐럴 둘을 같은 방식으로 연주한다(음원 파일 없음)
//   징글벨(1857) · 덱 더 홀스(웨일스 전래). 오르골·글로켄 선율 + 썰매 방울 + 칙칙폭폭 기차 박자, 두 바퀴씩 번갈아
export const CAROLS = {
  jingle: { name: '징글벨', desc: '글로켄 · 썰매 방울 · 기차 박자', bpm: 104, swing: 0.54, lead: 'bells', perc: 0, sleigh: 1, chuff: 1, noRest: true,
    chords: ['G', 'G', 'G', 'G7', 'C', 'G', 'A7', 'D7'],
    mel: ['B4 - B4 - B4 - - -', 'B4 - B4 - B4 - - -', 'B4 - D5 - G4 - - A4', 'B4 - - - - - . .', 'C5 - C5 - C5 - - C5', 'C5 - B4 - B4 - B4 B4', 'B4 - A4 - A4 - B4 -', 'A4 - - - D5 - - -'] },
  deck: { name: '덱 더 홀스', desc: '오르골 · 썰매 방울 · 기차 박자', bpm: 100, swing: 0.55, lead: 'musicbox', perc: 0, sleigh: 0.7, chuff: 0.8, noRest: true,
    chords: ['F', 'F C7', 'Gm7 F', 'C7 F', 'F', 'F C7', 'Gm7 F', 'C7 F'],
    mel: ['C5 - - Bb4 A4 - G4 -', 'F4 - G4 - A4 - F4 -', 'G4 A4 Bb4 G4 A4 - - G4', 'F4 - E4 - F4 - - -', 'C5 - - Bb4 A4 - G4 -', 'F4 - G4 - A4 - F4 -', 'G4 A4 Bb4 G4 A4 - - G4', 'F4 - E4 - F4 - - -'] },
}
const CAROL_ORDER = ['jingle', 'deck']

// 냥밭 곡 후보(2026-10-22 미리 듣기용 — 고르면 냥밭 배경음악). 새로 쓴 선율. 낮·밤 한 벌씩
//   A = 텃밭 산책: 우쿨렐레 뜯기 + 휘파람 + 나무 블록 + 닭·새 / B = 오후의 헛간: 아코디언 화음 + 마림바 + 벌 윙윙·풀벌레
export const FARM_TRACKS = {
  farmA: { name: 'A · 텃밭 산책 (낮)', desc: '우쿨렐레 뜯기 · 휘파람 · 나무 블록 · 닭과 새', bpm: 112, swing: 0.58, lead: 'whistle', comp: 'uke', perc: 0.7, wood: 1, birds: 1, hens: 1,
    chords: ['D', 'G', 'D', 'A7', 'D', 'G', 'A7', 'D'],
    mel: ['F#5 - A5 - F#5 E5 D5 -', 'B4 - D5 - G5 - F#5 E5', 'F#5 - D5 - A4 - B4 D5', 'E5 - - - . . A4 -', 'D5 - F#5 - A5 - B5 A5', 'G5 - B5 - G5 F#5 E5 -', 'F#5 E5 D5 - E5 - C#5 -', 'D5 - - - . . . .'] },
  farmANight: { name: 'A · 텃밭 산책 (밤)', desc: '오르골 · 느린 우쿨렐레 · 귀뚜라미', bpm: 72, swing: 0.55, lead: 'musicbox', comp: 'uke', perc: 0, crickets: 1, noRest: true,
    chords: ['Dmaj7', 'Bm7', 'Gmaj7', 'A7sus A7', 'Dmaj7', 'Bm7', 'Em7 A7', 'Dmaj7'],
    mel: ['F#5 - - - A5 - - -', 'D5 - - - . . F#5 -', 'B5 - - A5 G5 - - -', 'E5 - - - . . . .', 'F#5 - - - A5 - B5 -', 'A5 - - - F#5 - D5 -', 'E5 - - - G5 - C#5 -', 'D5 - - - . . . .'] },
  farmB: { name: 'B · 오후의 헛간 (낮)', desc: '아코디언 화음 · 마림바 · 벌 윙윙', bpm: 84, swing: 0.6, lead: 'marimba', comp: 'pad', perc: 0.5, bees: 1,
    chords: ['F', 'Dm7', 'Bb', 'C7', 'Am7', 'Dm7', 'Gm7 C7', 'F'],
    mel: ['A4 - - C5 F5 - E5 -', 'D5 - - - A4 - - .', 'Bb4 - D5 - F5 - D5 -', 'C5 - - - . . G4 A4', 'C5 - - E5 G5 - E5 -', 'F5 - - D5 A4 - - .', 'Bb4 - A4 - G4 - E5 -', 'F5 - - - . . . .'] },
  farmBNight: { name: 'B · 오후의 헛간 (밤)', desc: '아코디언만 아주 작게 · 풀벌레', bpm: 66, swing: 0.55, lead: 'accordion', comp: 'pad', perc: 0, crickets: 1.2, noRest: true,
    chords: ['Fmaj7', 'Dm7', 'Bbmaj7', 'C7sus', 'Am7', 'Dm7', 'Gm7 C7', 'Fmaj7'],
    mel: ['A4 - - - C5 - - -', 'D5 - - - . . . .', 'F5 - - - D5 - - -', 'C5 - - - . . . .', 'E5 - - - G5 - - -', 'F5 - - - D5 - - -', 'Bb4 - - - G4 - - -', 'A4 - - - . . . .'] },
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


// mode: 'cozy'(시간대 곡) | 'christmas'(캐럴 — 설산 기차) · 도중에 setMode 로 바꾸면 다음 마디부터
export function createCozyMusic({ volume = 0.2, mode = 'cozy', track = null } = {}) {
  let ctx = null, master = null, dry = null, wet = null, noiseBuf = null, timer = null
  const pick = () => track || (mode === 'christmas' ? CAROL_ORDER[0] : byClock())
  const table = k => CAROLS[k] || FARM_TRACKS[k] || TRACKS[k]
  let key = pick(), tr = table(key), notes = parse(tr), step = 0, nextT = 0, loop = 0
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
    } else if (kind === 'accordion') { const lp = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1600
      l.frequency.value = 5.2; lg.gain.value = 0.012; l.connect(lg); lg.connect(g.gain)
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.08); g.gain.setValueAtTime(0.035, t + Math.max(0.09, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15)
      for (const det of [0.997, 1.003]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * det; o.connect(lp); o.start(t); o.stop(t + dur + 0.2) }
      lp.connect(g); send(g, 0.9); l.start(t); l.stop(t + dur + 0.2)
    } else if (kind === 'bells') { for (const [mul, v, d] of [[1, 0.07, 0.9], [2.76, 0.02, 0.35], [5.4, 0.008, 0.12]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * 2 * mul; env(g, t, v, 0.002, d); o.connect(g); send(g, 1.2); o.start(t); o.stop(t + d + 0.05) }
    } else { for (const [mul, v, d, ty] of [[1, 0.06, 1.3, 'triangle'], [3.01, 0.018, 0.5, 'sine'], [5.98, 0.008, 0.2, 'sine']]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = ty; o.frequency.value = f * mul; env(g, t, v, 0.003, d); o.connect(g); send(g, 1.3); o.start(t); o.stop(t + d + 0.05) } }
  }
  function shaker(t, v) { const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6000; env(g, t, v, 0.006, 0.05); n.connect(hp); hp.connect(g); send(g, 0.3); n.start(t, Math.random() * 0.8); n.stop(t + 0.08) }
  function rim(t) { const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 6; env(g, t, 0.05, 0.002, 0.04); n.connect(bp); bp.connect(g); send(g, 0.5); n.start(t, Math.random() * 0.8); n.stop(t + 0.06) }
  // 우쿨렐레 — 화음을 아래에서 위로 살짝 흩어 뜯는다
  function uke(t, ms, vel = 1) { ms.forEach((m, k) => { const tt = t + k * 0.018, f = mtof(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain()
    o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, tt); lp.frequency.exponentialRampToValueAtTime(700, tt + 0.25)
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(lp); o.connect(lp); lp.connect(g); env(g, tt, 0.035 * vel, 0.004, 0.45); send(g, 0.6); o.start(tt); o2.start(tt); o.stop(tt + 0.55); o2.stop(tt + 0.55) }) }
  // 아코디언 화음 — 길게 깔린다
  function pad(t, ms, dur, vel = 1) { const lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1100
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.016 * vel, t + 0.12); g.gain.setValueAtTime(0.016 * vel, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2)
    for (const m of ms) for (const det of [0.996, 1.004]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m) * det; o.connect(lp); o.start(t); o.stop(t + dur + 0.25) }
    lp.connect(g); send(g, 0.7) }
  // 나무 블록 — 「똑」
  function wood(t, v, hi) { const f = hi ? 1250 : 900, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.05)
    env(g, t, v, 0.001, 0.07); o.connect(g); send(g, 0.4); o.start(t); o.stop(t + 0.1) }
  // 닭 — 「꼬꼬」 짧게 두세 번
  function hen(t) { for (let k = 0; k < 2 + (Math.random() * 2 | 0); k++) { const tt = t + k * 0.16, f = 520 + Math.random() * 80, o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain()
    o.type = 'square'; o.frequency.setValueAtTime(f * 1.2, tt); o.frequency.exponentialRampToValueAtTime(f * 0.8, tt + 0.09); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 3
    env(g, tt, 0.012, 0.006, 0.09); o.connect(bp); bp.connect(g); send(g, 0.8); o.start(tt); o.stop(tt + 0.12) } }
  // 벌 — 윙 하고 지나간다
  function bee(t) { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    o.type = 'sawtooth'; o.frequency.value = 210 + Math.random() * 40; l.frequency.value = 23; lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency); lp.type = 'lowpass'; lp.frequency.value = 900
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.012, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + 1.8)
    o.connect(lp); lp.connect(g); if (p) { p.pan.setValueAtTime(-0.8, t); p.pan.linearRampToValueAtTime(0.8, t + 1.8); g.connect(p); send(p, 0.5) } else send(g, 0.5)
    o.start(t); l.start(t); o.stop(t + 1.9); l.stop(t + 1.9) }
  // 썰매 방울 — 작은 방울 여럿이 한꺼번에 흔들린다
  function sleigh(t, v) { for (let k = 0; k < 4; k++) { const tt = t + Math.random() * 0.025, n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain()
    n.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 6500 + Math.random() * 3000; bp.Q.value = 14; env(g, tt, v, 0.003, 0.09); n.connect(bp); bp.connect(g); send(g, 0.6); n.start(tt, Math.random() * 0.8); n.stop(tt + 0.12) } }
  // 칙칙폭폭 — 낮게 숨 쉬는 증기 소리(박마다)
  function chuff(t, v) { const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; lp.type = 'lowpass'; lp.frequency.value = 700
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); n.connect(lp); lp.connect(g); send(g, 0.2); n.start(t, Math.random() * 0.8); n.stop(t + 0.2) }
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
      if (tr.comp === 'uke') { if ([0, 2, 3, 4, 6].includes(i)) uke(t, voice, i === 0 || i === 4 ? 1 : 0.6) }
      else if (tr.comp === 'pad') { if (i === 0 || (parts.length > 1 && i === 4)) pad(t, voice, spb * (parts.length > 1 ? 3.8 : 7.6)) }
      else if (comp.includes(i) || (parts.length > 1 && i === 4)) keys(t, voice, i === 0 || i === 4 ? spb * 2.6 : spb * 1.2, i === 0 ? 1 : 0.75)
      if (i === 0) bass(t, ch.root - 12, spb * 3)
      if (i === 4) bass(t, (parts.length > 1 ? chordOf(parts[1]).root : ch.root + 7) - 12, spb * 2.5)
      if (tr.perc) { shaker(t, (odd ? 0.022 : 0.012) * tr.perc); if (i === 2 || i === 6) rim(t) }
      if (tr.wood && (i === 2 || i === 6 || i === 7)) wood(t, (i === 7 ? 0.02 : 0.035) * tr.wood, i === 7)
      if (tr.hens && Math.random() < 0.006 * tr.hens) hen(t)
      if (tr.bees && Math.random() < 0.008 * tr.bees) bee(t)
      if (tr.sleigh) sleigh(t, (i % 2 ? 0.012 : 0.022) * tr.sleigh)
      if (tr.chuff && i % 2 === 0) chuff(t, (i % 4 === 0 ? 0.05 : 0.03) * tr.chuff)
      // 두 바퀴째는 앞 네 마디 선율을 쉬어 숨을 돌린다(캐럴은 쉬지 않는다)
      if (tr.noRest || !(loop % 2 === 1 && bar < 4)) for (const n of notes) if (n.step === s) lead(t, n.midi, n.len * spb * 0.95, tr.lead)
      if (tr.birds && Math.random() < 0.025) bird(t)
      if (tr.crickets && Math.random() < 0.04 * tr.crickets) cricket(t)
      nextT += spb; step++
      if (step % 64 === 0) { loop++; if (mode === 'christmas' && loop % 2 === 0) setTrack(CAROL_ORDER[(CAROL_ORDER.indexOf(key) + 1) % CAROL_ORDER.length]) }
    }
  }

  function setTrack(k) { if (!table(k) || k === key) return; key = k; tr = table(k); notes = parse(tr); step = Math.ceil(step / 64) * 64 }
  let clock = null
  return {
    get playing() { return !!timer },
    get track() { return key },
    get mode() { return mode },
    // 곡 하나를 고정(냥밭 낮·밤·낮잠) — 바로 그 곡 첫 마디부터
    setFixed(k) { if (!table(k)) return; track = k; setTrack(k) },
    // 배경이 바뀌면(설산 기차 ↔ 그 밖) 곡 묶음을 바꾼다 — 바로 그 곡 첫 마디부터
    setMode(m) { if (m === mode || (m !== 'cozy' && m !== 'christmas')) return; mode = m; loop = 0; setTrack(pick()) },
    async start() {
      if (!ctx && !build()) return false
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch {} }
      if (ctx.state !== 'running') return false
      setTrack(pick())
      if (timer) return true
      nextT = ctx.currentTime + 0.1
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2)
      timer = setInterval(schedule, 30)
      clock = setInterval(() => { if (mode === 'cozy' && !track) setTrack(byClock()) }, 60000) // 시간대가 바뀌면 그 곡
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
