'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { NavIcon, NAV_ACTIVE, NAV_MUTED } from './NavIcons'

// 하단 내비. 수강생은 6탭(홈·캘린더·기록·냥밭·라운지·설정),
// 작가도 6탭(홈·회의·기록·냥밭·라운지·설정) — 홈이 /artist(대시보드), 회의 캘린더는 /artist/meetings.
// role은 prop으로 주거나(권장), 없으면 자체 조회한다.
export default function StudentNav({ active, role: roleProp }) {
  const [role, setRole] = useState(roleProp || '')
  const [unread, setUnread] = useState(0)
  const [loungeNew, setLoungeNew] = useState(0)   // 마지막으로 본 뒤 올라온 라운지 글 수
  useEffect(() => {
    if (roleProp) return
    supabase.auth.getUser().then(({ data }) => setRole(data.user?.user_metadata?.role || 'student'))
  }, [roleProp])

  // 확인 안 한 알림 개수 — 관리자 네비와 동일하게 30초 폴링, 알림 탭에 붉은 숫자 뱃지
  useEffect(() => {
    loadUnread()
    loadLoungeNew()
    const interval = setInterval(() => { loadUnread(); loadLoungeNew() }, 30000)
    // 라운지 화면이 "봤다"고 알리면 즉시 0 으로(30초 폴링을 기다리지 않게)
    const seen = () => setLoungeNew(0)
    window.addEventListener('lounge-seen', seen)
    return () => { clearInterval(interval); window.removeEventListener('lounge-seen', seen) }
  }, [])

  // 라운지 새 글 — 사람마다 "마지막으로 본 시각" 하나만 저장하고 그 뒤 글을 센다.
  // 글×회원 표를 만들면 글 하나에 회원 수만큼 행이 생긴다.
  // 내가 쓴 글은 빼고, 컬럼이 없거나 기준 시각이 없으면 조용히 0(첫 방문 폭탄 배지 방지).
  async function loadLoungeNew() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoungeNew(0); return }
    const { data: pref, error } = await supabase
      .from('user_prefs').select('lounge_seen_at').eq('user_id', user.id).maybeSingle()
    if (error) { setLoungeNew(0); return }
    // 라운지를 한 번도 안 연 사람은 기준 시각이 없다. 0 으로 두면 그 사람에겐 배지가
    // 영영 안 뜨고(정작 안 오는 사람인데), 전체를 세면 첫 화면에 폭탄이 뜬다.
    // 그래서 기준이 없으면 최근 7일치만 센다.
    const since = pref?.lounge_seen_at
      || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const { count } = await supabase
      .from('posts').select('*', { count: 'exact', head: true })
      .gt('created_at', since).neq('author_id', user.id)
    setLoungeNew(count || 0)
  }
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

  const artist = role === 'artist'
  const items = artist ? [
    { href:'/artist', label:'홈', icon:'home', key:'home' },
    { href:'/artist/meetings', label:'회의', icon:'calendar', key:'meetings' },
    { href:'/student/records', label:'기록', icon:'clipboard', key:'records' },
    { href:'/student/farm', label:'냥밭', icon:'plant', key:'farm' },
    { href:'/student/notification', label:'알림', icon:'bell', key:'notification' },
    { href:'/lounge', label:'라운지', icon:'chat', key:'lounge' },
    { href:'/student/settings', label:'설정', icon:'user', key:'settings' },
  ] : [
    { href:'/student', label:'홈', icon:'home', key:'home' },
    { href:'/student/calendar', label:'캘린더', icon:'calendar', key:'calendar' },
    { href:'/student/records', label:'기록', icon:'clipboard', key:'records' },
    { href:'/student/farm', label:'냥밭', icon:'plant', key:'farm' },
    { href:'/student/notification', label:'알림', icon:'bell', key:'notification' },
    { href:'/lounge', label:'라운지', icon:'chat', key:'lounge' },
    { href:'/student/settings', label:'설정', icon:'user', key:'settings' },
  ]

  return (
    <nav className="bottom-nav">
      {items.map(t => {
        const on = active === t.key
        return (
          <a key={t.key} href={t.href} className={`nav-item ${on ? 'active' : ''}`}>
            <div style={{ position:'relative', display:'flex' }}>
              <NavIcon name={t.icon} active={on} />
              {t.key === 'lounge' && loungeNew > 0 && (
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
                  {loungeNew > 99 ? '99+' : loungeNew}
                </span>
              )}
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
