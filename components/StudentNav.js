'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { NavIcon, NAV_ACTIVE, NAV_MUTED } from './NavIcons'

export default function StudentNav({ active }) {
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

  const items = [
    { href:'/student', label:'일정', icon:'calendar', key:'schedule' },
    { href:'/student/records', label:'기록', icon:'clipboard', key:'records' },
    { href:'/student/curriculum', label:'커리큘럼', icon:'book', key:'curriculum' },
    { href:'/student/notification', label:'알림', icon:'bell', key:'notification' },
    { href:'/lounge', label:'라운지', icon:'chat', key:'lounge' },
  ]

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