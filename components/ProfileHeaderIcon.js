'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { NavIcon } from './NavIcons'

// 상단 헤더용 프로필 진입 아이콘 — 로그인 시에만 뜨고, 탭하면 내 인스타형 프로필로.
// 알림 벨과 동일한 라인아트(profile 글리프)로 통일. 각 페이지 헤더 우측에 드롭인.
export default function ProfileHeaderIcon({ size = 22 }) {
  const router = useRouter()
  const [uid, setUid] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id || null))
  }, [])
  if (!uid) return null
  return (
    <div onClick={() => router.push(`/profile/${uid}`)} style={{ cursor:'pointer', display:'flex' }} title="내 프로필">
      <NavIcon name="profile" color="var(--ac)" size={size} />
    </div>
  )
}
