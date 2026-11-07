'use client'
// 앱 전체 배경음악 담당 — 레이아웃에 하나. 규칙은 lib/sharedMusic.
//   · 3D 모드로 쓰는 학생 화면에서 이어서 흐른다(관리자·로그인 화면 = 멈춤)
//   · 링크가 대부분 <a> 라 그대로 두면 새로고침되어 끊긴다 → 음악이 도는 동안만 앱 안 이동으로 바꿔 탄다
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { musicPlaying, startMusic, stopMusic, suspendMusic, setMusicBase } from '../lib/sharedMusic'
import { getSavedScene } from '../lib/castleScenes'

const zone = p => /^\/(castle|student|lounge)(\/|$)/.test(p || '')
function threeD(p) { if (p?.startsWith('/castle')) return true; try { const m = localStorage.getItem('2hs_home_mode'); return m !== 'classic' && m !== 'wax' } catch { return true } }

export default function GlobalMusic() {
  const path = usePathname(), router = useRouter(), pathRef = useRef(path)
  useEffect(() => {
    pathRef.current = path
    if (!zone(path) || !threeD(path)) stopMusic(); else startMusic().catch(() => {})
  }, [path])
  useEffect(() => {
    if (getSavedScene() === 'studio') setMusicBase('studioJazz')   // 3D 홈을 거치지 않고 들어온 화면에서도 같은 곡
    const go = e => {
      if (e?.target?.closest?.('[data-music-btn]')) return
      const p = pathRef.current
      if (zone(p) && threeD(p)) startMusic().catch(() => {})
    }
    const onMsg = e => { if (e.origin === window.location.origin && e.data?.scene === 'touch') go() }   // 3D 장면(iframe) 안을 눌렀을 때
    const EV = ['pointerdown', 'touchstart', 'keydown']
    EV.forEach(n => window.addEventListener(n, go, true)); window.addEventListener('message', onMsg)
    const vis = () => suspendMusic(document.hidden); document.addEventListener('visibilitychange', vis)
    const link = e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !musicPlaying()) return
      const a = e.target?.closest?.('a[href]')
      if (!a || a.target || a.hasAttribute('download')) return
      const u = new URL(a.href, window.location.href)
      if (u.origin !== window.location.origin || !zone(u.pathname) || (u.pathname === window.location.pathname && u.search === window.location.search)) return
      e.preventDefault(); router.push(u.pathname + u.search + u.hash)
    }
    document.addEventListener('click', link)
    return () => { EV.forEach(n => window.removeEventListener(n, go, true)); window.removeEventListener('message', onMsg); document.removeEventListener('visibilitychange', vis); document.removeEventListener('click', link) }
  }, [router])
  return null
}
