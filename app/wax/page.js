'use client'
// 옛 「왁뿌」 화면 — 이제 왁뿌는 3D 홈의 배경 장면 하나(해변·우리 스튜디오와 같이). 설정은 홈 「장면」 패널에서.
// 예전 주소로 오면 왁뿌 배경을 고른 3D 홈으로 보낸다.
import { useEffect } from 'react'
import { saveSceneLocal } from '../../lib/castleScenes'

export default function WaxPage() {
  useEffect(() => {
    saveSceneLocal('wax')
    try { if (localStorage.getItem('2hs_home_mode') === 'wax') localStorage.setItem('2hs_home_mode', 'castle') } catch {}
    window.location.replace('/castle')
  }, [])
  return null
}
