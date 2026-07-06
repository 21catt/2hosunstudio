'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { NavIcon, NAV_ACTIVE, NAV_MUTED } from './NavIcons'

// 하단 내비. 수강생은 6탭(홈·캘린더·기록·냥밭·라운지·설정),
// 작가도 6탭(홈·회의·기록·냥밭·라운지·설정) — 홈이 /artist(대시보드), 회의 캘린더는 /artist/meetings.
// role은 prop으로 주거나(권장), 없으면 자체 조회한다.
export default function StudentNav({ active, role: roleProp }) {
  const [role, setRole] = useState(roleProp || '')
  useEffect(() => {
    if (roleProp) return
    supabase.auth.getUser().then(({ data }) => setRole(data.user?.user_metadata?.role || 'student'))
  }, [roleProp])

  const artist = role === 'artist'
  const items = artist ? [
    { href:'/artist', label:'홈', icon:'home', key:'home' },
    { href:'/artist/meetings', label:'회의', icon:'calendar', key:'meetings' },
    { href:'/student/records', label:'기록', icon:'clipboard', key:'records' },
    { href:'/student/farm', label:'냥밭', icon:'plant', key:'farm' },
    { href:'/lounge', label:'라운지', icon:'chat', key:'lounge' },
    { href:'/student/settings', label:'설정', icon:'user', key:'settings' },
  ] : [
    { href:'/student', label:'홈', icon:'home', key:'home' },
    { href:'/student/calendar', label:'캘린더', icon:'calendar', key:'calendar' },
    { href:'/student/records', label:'기록', icon:'clipboard', key:'records' },
    { href:'/student/farm', label:'냥밭', icon:'plant', key:'farm' },
    { href:'/lounge', label:'라운지', icon:'chat', key:'lounge' },
    { href:'/student/settings', label:'설정', icon:'user', key:'settings' },
  ]

  return (
    <nav className="bottom-nav">
      {items.map(t => {
        const on = active === t.key
        return (
          <a key={t.key} href={t.href} className={`nav-item ${on ? 'active' : ''}`}>
            <NavIcon name={t.icon} active={on} />
            <span style={{ color: on ? NAV_ACTIVE : NAV_MUTED }}>{t.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
