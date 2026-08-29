'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { NavIcon, NAV_ACTIVE, NAV_MUTED } from './NavIcons'

// 강사 하단 내비.
// 2026-08-26 사용자 확정으로 냥밭·설정을 열었다(그전에는 업무 기능만 뒀다).
// 설정에서 테마·프로필 고양이를 고르고, 냥밭도 수강생과 같은 화면을 쓴다.
// 라운지는 아직 강사 탭에 두지 않는다.
// ⚠️ 강사 탭 목록의 단일 소스 — 강사가 보는 화면(설정·냥밭 포함)은 모두 이 내비를 쓴다.
//    StudentNav 를 쓰면 홈 탭이 /student(학생 홈)로 가서 길을 잃는다.
export const TEACHER_TABS = [
  { href:'/teacher', label:'홈', icon:'home', key:'home' },
  { href:'/admin/attendance', label:'출석', icon:'check', key:'attendance' },
  { href:'/admin/records', label:'기록', icon:'clipboard', key:'records' },
  { href:'/student/farm', label:'냥밭', icon:'plant', key:'farm' },
  { href:'/admin/notification', label:'알림', icon:'bell', key:'notification' },
  { href:'/student/settings', label:'설정', icon:'user', key:'settings' },
]
export default function TeacherNav({ active }) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    loadUnread()
    const interval = setInterval(loadUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadUnread() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setUnread(count || 0)
  }

  const items = TEACHER_TABS

  return (
    <nav className="bottom-nav">
      {items.map(t => {
        const on = active === t.key
        return (
          <a key={t.key} href={t.href} className={`nav-item ${on ? 'active' : ''}`}>
            <div style={{ position:'relative', display:'flex' }}>
              <NavIcon name={t.icon} active={on} />
              {t.key === 'notification' && unread > 0 && (
                <span style={{
                  position:'absolute', top:-6, right:-8,
                  background:'#e24b4a', color:'#fff',
                  fontSize:9, fontWeight:800,
                  minWidth:16, height:16, borderRadius:8,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'0 4px', lineHeight:1,
                  fontFamily:'Nunito,sans-serif',
                  border:'1.5px solid #fff'
                }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
            <span style={{ color: on ? NAV_ACTIVE : NAV_MUTED }}>{t.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
