'use client'
import { NavIcon, NAV_ACTIVE, NAV_MUTED } from './NavIcons'

// 하단 내비 6탭. 알림은 홈 헤더의 종 아이콘으로 이동.
export default function StudentNav({ active }) {
  const items = [
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
