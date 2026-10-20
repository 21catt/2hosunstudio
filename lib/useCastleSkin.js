'use client'
// 3D 홈 모양(성 장면 위 유리 시트)을 쓸 사람인가 — 기록·라운지·알림·… 이 화면들이 같은 판정을 쓴다.
//   · 3D 모드는 로그인한 사람 누구나 켤 수 있다(2026-10-20 전체 공개 — 학생 홈 오른쪽 위 「3D 모드」)
//   · 켜져 있는가 = localStorage 2hs_home_mode: 'castle' = 켬 · 'classic' = 끔 · 고른 적 없음 = 관리자·미리보기 학생(castle_beta)만 켬
//   · 켜지면 <html data-skin="castle"> — 색·카드·하단 메뉴는 globals.css 의 [data-skin='castle'] 규칙이 바꾼다.
// 학생 전체에 열 때는 이 판정 하나만 바꾸면 된다.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getSavedScene } from './castleScenes'

export const HOME_MODE_KEY = '2hs_home_mode'

export function castleSkinAllowed(user) { return !!user }
// 지금 3D 모드인가(위 규칙) — 화면 모양·하단 냥밭 탭·학생 홈 이동이 이 판정 하나를 쓴다
export function castleModeOn(user) {
  if (!user) return false
  let mode = null
  try { mode = localStorage.getItem(HOME_MODE_KEY) } catch {}
  if (mode === 'classic') return false
  if (mode === 'castle') return true
  const m = user.user_metadata || {}
  return m.role === 'admin' || m.castle_beta === true
}

export function useCastleSkin() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let alive = true
    let classic = false
    try { classic = localStorage.getItem(HOME_MODE_KEY) === 'classic' } catch {}
    if (classic) return
    // 로컬 개발에서만: ?dev=1 이면 로그인 없이 3D 모양을 본다(배포 빌드에선 이 분기가 없다)
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('dev') === '1') {
      document.documentElement.setAttribute('data-skin', 'castle'); document.documentElement.setAttribute('data-scene', getSavedScene()); setOn(true)
      return () => { document.documentElement.removeAttribute('data-skin'); document.documentElement.removeAttribute('data-scene') }
    }
    // 세션은 기기에 있는 값이라 네트워크 없이 바로 온다(화면이 늦게 바뀌지 않게)
    supabase.auth.getSession().then(({ data }) => {
      if (!alive || !castleModeOn(data?.session?.user)) return
      document.documentElement.setAttribute('data-skin', 'castle')
      document.documentElement.setAttribute('data-scene', getSavedScene()) // 배경 그림 = 고른 3D 배경
      setOn(true)
    })
    return () => {
      alive = false
      document.documentElement.removeAttribute('data-skin')
      document.documentElement.removeAttribute('data-scene')
    }
  }, [])
  return on
}

// 「예전 화면」 — 3D 홈의 「예전 홈으로」와 같은 선택(다시 3D 홈 입구로 들어오면 돌아온다)
export function leaveCastleSkin() {
  try { localStorage.setItem(HOME_MODE_KEY, 'classic') } catch {}
  document.documentElement.removeAttribute('data-skin')
}

// 지금 3D 모양이 켜져 있는가 — 읽기만 한다(켜고 끄지 않음). <html data-skin> 을 지켜본다.
// ⚠️ 카드·목록 같은 안쪽 부품은 useCastleSkin 을 부르면 안 된다 — 그 훅은 사라질 때 data-skin 을 지워
//    탭을 바꾸거나 카드를 접는 순간 화면 전체의 3D 모양이 꺼진다. 안쪽 부품은 이것으로 판정만 한다.
export function useCastleOn() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = document.documentElement
    const read = () => setOn(el.getAttribute('data-skin') === 'castle')
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { attributes: true, attributeFilter: ['data-skin'] })
    return () => mo.disconnect()
  }, [])
  return on
}
