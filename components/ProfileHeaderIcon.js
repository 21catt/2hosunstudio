'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { NavIcon } from './NavIcons'

// 상단 헤더용 아이콘 — 로그인 시에만 뜨고, 탭하면 개인 설정으로.
// (프로필 페이지 제거 후 설정 단축으로 재연결.) 알림 벨과 동일 라인아트로 통일.
export default function ProfileHeaderIcon({ size = 22 }) {
  const router = useRouter()
  const [uid, setUid] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id || null))
  }, [])
  if (!uid) return null
  return (
    <div onClick={() => router.push('/student/settings')} style={{ cursor:'pointer', display:'flex' }} title="개인 설정">
      <NavIcon name="profile" color="var(--ac)" size={size} />
    </div>
  )
}
