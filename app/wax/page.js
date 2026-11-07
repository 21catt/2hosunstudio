'use client'
// 「왁뿌」 메인 홈 — 메인 화면을 왁뿌로 고른 학생은 /student 에서 이리로 온다(lib/useCastleSkin WAX_MODE).
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { WAX_MODE } from '../../lib/useCastleSkin'
import WaxHome from '../../components/wax/WaxHome'
import StudentNav from '../../components/StudentNav'

export default function WaxPage() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data?.session?.user || null
      setUser(u)
      // 로그인한 사람이 왁뿌 홈에 들어오면 메인 화면 = 왁뿌로 기억(3D 홈의 입구 규칙과 같다)
      if (u) { try { localStorage.setItem('2hs_home_mode', WAX_MODE) } catch {} }
    })
  }, [])
  return (
    <>
      <WaxHome user={user} />
      {user && <StudentNav active="home" role={user.user_metadata?.role || undefined} />}
    </>
  )
}
