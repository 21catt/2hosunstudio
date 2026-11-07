'use client'
// 「왁뿌」 꾸미기 화면 — 고양이 고르기 · 그리기 · 왁스 색 · 부수기(3D = public/wax-squish). 메인 화면 「왁뿌」 = 3D 홈에 이 장면.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import WaxHome from '../../components/wax/WaxHome'
import StudentNav from '../../components/StudentNav'

export default function WaxPage() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data?.session?.user || null
      setUser(u)
    })
  }, [])
  return (
    <>
      <WaxHome user={user} />
      {user && <StudentNav active="home" role={user.user_metadata?.role || undefined} />}
    </>
  )
}
