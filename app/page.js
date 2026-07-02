'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🐱</div>
        <div style={{ fontSize:14, color:'var(--tmu)', fontWeight:700 }}>2호선 스튜디오</div>
      </div>
    </div>
  )
}