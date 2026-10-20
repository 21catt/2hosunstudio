'use client'
// 3D 홈 모양(성 장면 위 유리 시트)을 쓸 사람인가 — 기록·라운지·알림·… 이 화면들이 같은 판정을 쓴다.
//   · 열리는 사람 = /castle 과 같다: 관리자 · user_metadata.castle_beta === true(관리자가 미리 열어 준 학생)
//   · 3D 홈에서 「예전 홈으로」를 고른 사람(localStorage 2hs_home_mode = 'classic')은 예전 모양 그대로
//   · 켜지면 <html data-skin="castle"> — 색·카드·하단 메뉴는 globals.css 의 [data-skin='castle'] 규칙이 바꾼다.
// 학생 전체에 열 때는 이 판정 하나만 바꾸면 된다.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getSavedScene } from './castleScenes'

export const HOME_MODE_KEY = '2hs_home_mode'

export function castleSkinAllowed(user) {
  const m = user?.user_metadata || {}
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
      if (!alive || !castleSkinAllowed(data?.session?.user)) return
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
