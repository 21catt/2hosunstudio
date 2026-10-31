// 배경음악 한 대 — 앱 전체에서 하나만 돈다(겹치지 않는다). 화면이 바뀌어도 끊기지 않게 페이지가 아니라 여기서 쥔다.
//   · 3D 홈 = 시간대 곡(설산 기차 = 캐럴) · 3D 냥밭 = 그 화면 동안만 냥밭 곡으로 바꿔 끼운다
//   · 켜고 끔 기억 = 2hs_castle_music(기존 값 그대로)
import { createCozyMusic } from './cozyMusic'

const KEY = '2hs_castle_music'
let m = null, mode = 'cozy', base = null  // base = 장면이 정한 곡(우리 스튜디오 = 저녁 재즈 피아노)
const player = () => (m ??= createCozyMusic({ mode }))

export function musicWanted() { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export const musicPlaying = () => !!m?.playing
export async function startMusic() { return musicWanted() && !m?.playing ? player().start() : !!m?.playing }
export function stopMusic() { m?.stop() }
export function setMusicMode(next) { mode = next; m?.setMode(next) }
export function setMusicBase(key) {
  base = key
  if (key) player().setFixed(key); else m?.clearFixed()
}
export function holdMusicTrack(key) { player().setFixed(key) }   // 냥밭 곡으로
export function releaseMusicTrack() { if (base) m?.setFixed(base); else m?.clearFixed() }   // 원래 곡으로
export function suspendMusic(hidden) { if (hidden) m?.suspend(); else m?.resume() }
export async function toggleMusic(on) {
  try { localStorage.setItem(KEY, on ? '0' : '1') } catch {}
  if (on) { m?.stop(); return false }
  await player().start(); return true
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') { window.__music = () => ({ on: !!m?.playing, track: m?.track, wanted: musicWanted() }); window.__musicStart = () => startMusic() }
