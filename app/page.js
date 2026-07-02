'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import LoadingCat from '../components/LoadingCat'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user.user_metadata?.role
        if (role === 'admin') router.push('/admin')
        else router.push('/student')
      } else {
        // 비회원도 캘린더 열람 가능 (예약 시 회원가입 유도)
        router.push('/student')
      }
    })
  }, [])

  return (
    <LoadingCat label="2호선 스튜디오" />
  )
}