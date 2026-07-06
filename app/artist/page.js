'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import StudentNav from '../../components/StudentNav'
import { NavIcon } from '../../components/NavIcons'
import ProfileHeaderIcon from '../../components/ProfileHeaderIcon'
import { useTodayWeather } from '../../components/WeatherBar'

// 전시 작가 홈 — 수강생 홈과 같은 구성(헤더 → 히어로 → 퀵타일 → 참여권 → 공지).
// 회의 신청 캘린더는 /artist/meetings 별도 페이지. 히어로에 다가오는 회의(크게)+D-day+오늘 날씨.
const DOW = ['일', '월', '화', '수', '목', '금', '토']

// 오늘 날씨 — 하단 내비와 같은 라인아트 톤(아웃라인 SVG). open-meteo weather_code 기준.
function weatherGlyph(code) {
  if (code === 0 || code === 1) return (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </>
  )
  if (code >= 95) return (
    <>
      <path d="M6.5 16.5h10a3.8 3.8 0 0 0 .4-7.6 5.2 5.2 0 0 0-10-1A3.6 3.6 0 0 0 6.5 16.5z" />
      <path d="M12.5 14l-2.2 3.6h2.8L11 22" />
    </>
  )
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return (
    <>
      <path d="M6.5 15h10a3.8 3.8 0 0 0 .4-7.6 5.2 5.2 0 0 0-10-1A3.6 3.6 0 0 0 6.5 15z" />
      <path d="M9 18.5h.01M12 20h.01M15 18.5h.01" />
    </>
  )
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return (
    <>
      <path d="M6.5 15h10a3.8 3.8 0 0 0 .4-7.6 5.2 5.2 0 0 0-10-1A3.6 3.6 0 0 0 6.5 15z" />
      <path d="M9 18l-1 2.2M12.2 18l-1 2.2M15.4 18l-1 2.2" />
    </>
  )
  return <path d="M7 17.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1A3.9 3.9 0 0 0 7 17.5z" />
}

function WeatherGlyph({ code, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {weatherGlyph(code)}
    </svg>
  )
}

export default function ArtistHomePage() {
  const router = useRouter()
  const weather = useTodayWeather()
  const [user, setUser] = useState(null)
  const [bookings, setBookings] = useState([])
  const [ticket, setTicket] = useState(null)
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const role = data.user.user_metadata?.role
      if (role !== 'artist' && role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      loadData(data.user.id)
    })
  }, [])

  async function loadData(userId) {
    const [{ data: b }, { data: t }, { data: pin }] = await Promise.all([
      supabase.from('bookings').select('*').eq('user_id', userId).neq('status', 'cancelled'),
      supabase.from('tickets').select('*').eq('user_id', userId).eq('type', 'meeting').single(),
      supabase.from('posts')
        .select('id, title, content, author_name, created_at, pinned_at, images, image_url')
        .not('pinned_at', 'is', null)
        .order('pinned_at', { ascending: false }),
    ])
    setBookings(b || [])
    setTicket(t)
    setNotices(pin || [])
    setLoading(false)
  }

  const upcoming = bookings
    .filter(b => (b.class_date || '') >= todayStr)
    .sort((a, b) => (a.class_date || '').localeCompare(b.class_date || '') || (a.class_time || '').localeCompare(b.class_time || ''))
  const next = upcoming[0] || null
  const dday = next ? Math.round((new Date(next.class_date + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000) : null
  const ddayLabel = dday === 0 ? 'D-DAY' : `D-${dday}`
  const nextDateLabel = next ? (() => {
    const dt = new Date(next.class_date + 'T00:00:00')
    return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DOW[dt.getDay()]})`
  })() : ''
  const nextTime = next?.class_time ? next.class_time.split('~')[0] : ''

  const TILES = [
    { label: '회의', icon: 'calendar', href: '/artist/meetings' },
    { label: '기록', icon: 'clipboard', href: '/student/records' },
    { label: '냥밭', icon: 'plant', href: '/student/farm' },
    { label: '라운지', icon: 'chat', href: '/lounge' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ fontSize: 32 }}>🖼️</div>
    </div>
  )

  return (
    <>
      {/* Header — 수강생 톤(밝은 헤더 + 프로필 아이콘) */}
      <div className="p-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavIcon name="photo" color="var(--ac)" size={20} />
          <span className="p-title">전시 작가</span>
        </div>
        <ProfileHeaderIcon />
      </div>

      <div style={{ background: '#fff', padding: '8px 16px 90px' }}>

        {/* 히어로 — 다가오는 회의(크게) + D-day + 오늘 날씨 */}
        <div className="p-hero" style={{ marginBottom: 14 }}>
          <div style={{ padding: '14px 16px 16px', position: 'relative' }}>
            {weather && (
              <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--acTx)' }}>
                <WeatherGlyph code={weather.code} size={20} />
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>{weather.temp}°</span>
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--acTx)' }}>{next ? '다가오는 회의' : '회의, 여기서 신청'}</div>
            {next ? (
              <div style={{ marginTop: 9 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--ac)', letterSpacing: '-0.5px', lineHeight: 1 }}>{ddayLabel}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--td)' }}>{nextDateLabel}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--tm)', fontWeight: 600, marginTop: 5 }}>
                  {next.class_name}{nextTime ? ` · ${nextTime}` : ''}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--tm)', margin: '7px 0 0', fontWeight: 600 }}>예정된 회의가 없어요 · 날짜 고르고 바로 신청 🐾</div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>
              <button className="p-chip p-chip--fill" onClick={() => router.push('/artist/meetings')}>회의 신청하기</button>
              <button className="p-chip" onClick={() => router.push('/lounge')}>라운지</button>
            </div>
          </div>
        </div>

        {/* 퀵 타일 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
          {TILES.map(m => (
            <div key={m.label} className="p-tile" style={{ padding: '12px 4px 10px' }} onClick={() => router.push(m.href)}>
              <NavIcon name={m.icon} color="var(--ac)" size={20} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* 회의 참여권 */}
        {ticket ? (
          <div className="p-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--tm)', fontWeight: 700 }}>회의 참여권</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--td)', margin: '2px 0 6px' }}>{ticket.total}회권 · 잔여 {ticket.remain}회</div>
              <div style={{ width: '100%', height: 5, background: 'var(--g1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(ticket.remain / ticket.total) * 100}%`, height: '100%', background: 'var(--ac)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--tmu)', flexShrink: 0 }}>만료 {ticket.expires_at}</span>
          </div>
        ) : (
          <div className="p-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--tm)', fontWeight: 700 }}>회의 참여권</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--td)', marginTop: 2 }}>참여권 없음 🐾</div>
            </div>
          </div>
        )}

        {/* 스튜디오 공지 — 라운지에서 관리자가 공지 지정한 글 (최대 2개) */}
        {notices.length > 0 && (
          <div style={{ marginTop: 44, paddingTop: 34, borderTop: '1px solid rgba(0,0,0,0.045)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--td)' }}>
                <NavIcon name="pin" color="var(--ac)" size={15} /> 스튜디오 공지
              </span>
              <span onClick={() => router.push('/lounge')}
                style={{ fontSize: 11, color: 'var(--tmu)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>라운지에서 보기 →</span>
            </div>
            {notices.map(n => {
              const thumb = (n.images && n.images[0]) || n.image_url
              return (
                <div key={n.id} onClick={() => router.push('/lounge')}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', marginBottom: 8, cursor: 'pointer', background: 'var(--acBg)', border: '2px solid rgb(var(--ac-rgb) / 0.35)', borderRadius: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 900, background: 'var(--ac)', color: '#fff', borderRadius: 10, padding: '2px 8px', flexShrink: 0 }}>공지</span>
                      <span style={{ fontSize: 10, color: 'var(--tmu)', fontWeight: 700 }}>
                        {n.author_name} · {(n.created_at || '').slice(5, 10).replace('-', '/')}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--td)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {n.title || n.content || '사진 공지'}
                    </div>
                  </div>
                  {thumb && (
                    <img src={thumb} alt="" loading="lazy"
                      style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '2px solid rgb(var(--ac-rgb) / 0.3)', display: 'block' }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <StudentNav active="home" role="artist" />
    </>
  )
}
