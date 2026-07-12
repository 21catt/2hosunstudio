'use client'
// 싱그러운(fresh) 테마 전용 글래스모피즘 홈 — 2026 여름 한정 스킨.
// data/핸들러는 app/student/page.js에서 props로 받는다. 모달·PaletteFab은 부모/전역이 렌더.

const T = {
  bg: '#dfeaf2',
  blob1: 'rgba(148,198,232,0.75)', blob2: 'rgba(130,150,60,0.5)',
  blob3: 'rgba(96,110,45,0.55)', blob4: 'rgba(190,195,210,0.6)',
  scrim: 'rgba(230,240,245,0.35)',
  text: '#33402c', sub: 'rgba(51,64,44,0.68)', faint: 'rgba(51,64,44,0.55)', dim: 'rgba(51,64,44,0.4)',
  border: 'rgba(255,255,255,0.75)', logoRing: '#6f9fc9',
  heroGrad: 'linear-gradient(150deg, rgba(190,220,240,0.65), rgba(210,220,175,0.5) 55%, rgba(160,175,110,0.4))',
  glass: 'linear-gradient(150deg, rgba(255,255,255,0.72), rgba(255,255,255,0.45))',
  glassN: 'linear-gradient(150deg, rgba(255,255,255,0.65), rgba(255,255,255,0.4))',
  ghostBorder: 'rgba(51,64,44,0.2)', ghostBg: 'rgba(255,255,255,0.5)',
  primaryGrad: 'linear-gradient(135deg,#6f9fc9,#4f7fae)', primaryShadow: '0 8px 20px -8px rgba(111,159,201,0.6)',
  accentGrad: 'linear-gradient(135deg,#b7c24a,#96a52e)', accentText: '#2c330a', accentShadow: '0 8px 20px -8px rgba(150,165,46,0.55)',
  accent: '#7f9227', accentSoft: 'rgba(150,165,46,0.18)',
  constStroke: 'rgba(127,146,39,0.55)', constFill: '#a3b23c',
  tile1: 'linear-gradient(160deg, rgba(130,150,60,0.5), rgba(130,150,60,0.2))',
  tile2: 'linear-gradient(160deg, rgba(148,198,232,0.6), rgba(148,198,232,0.25))',
  tile3: 'linear-gradient(160deg, rgba(110,130,170,0.45), rgba(110,130,170,0.18))',
  tile4: 'linear-gradient(160deg, rgba(170,180,120,0.5), rgba(170,180,120,0.2))',
  dayBg: 'rgba(255,255,255,0.6)', dayBgMute: 'rgba(255,255,255,0.32)', dayRing: 'rgba(51,64,44,0.12)',
  track: 'rgba(51,64,44,0.1)', progGlow: '0 0 10px rgba(150,165,46,0.45)',
  navBg: 'rgba(240,246,248,0.88)', navBorder: 'rgba(51,64,44,0.08)', navMute: 'rgba(51,64,44,0.45)',
  thumb1: 'linear-gradient(140deg,#94c6e8,#8e9c3c)', thumb2: 'linear-gradient(140deg,#5f6e2d,#a9c4dd)',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const glassBlur = { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Tile({ bg, label, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding: '15px 0 12px', borderRadius: 20, border: `1px solid ${T.border}`, background: bg, ...glassBlur, color: T.text, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {children}
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

function NavItem({ active, label, onClick, children }) {
  return (
    <div onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 0', cursor: 'pointer', color: active ? T.accent : T.navMute }}>
      {children}
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600 }}>{label}</span>
    </div>
  )
}

export default function GlassHome(props) {
  const {
    user, ticket, nextBooking, pendingBooking, notices = [], weather, heroSub, unread = 0,
    stripDates = [], selDate, todayStr, bookedDates = new Set(), stripRef,
    coursesOn = () => [], schedulesFor = () => [], myBookingFor = () => null, seatCount = () => 0, bookingBusy,
    onDate = () => {}, onQuickBook = () => {}, onCancel = () => {}, onAsk = () => {}, go = () => {},
  } = props

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Pretendard','Nunito',-apple-system,sans-serif", overflow: 'hidden' }}>
      {/* ambient blobs */}
      <div style={{ position: 'absolute', top: -60, left: -40, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${T.blob1}, transparent 65%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 180, right: -90, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${T.blob2}, transparent 65%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 40, left: -70, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${T.blob3}, transparent 65%)`, filter: 'blur(24px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 220, right: -60, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${T.blob4}, transparent 65%)`, filter: 'blur(22px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: T.scrim, pointerEvents: 'none' }} />

      {/* top bar */}
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <circle cx="13" cy="13" r="9.5" stroke={T.logoRing} strokeWidth="3" />
            <circle cx="22" cy="22" r="8" fill={T.accent} />
          </svg>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.4px' }}>2호선 스튜디오</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: T.sub }}>
          <span className="tap" onClick={() => user && go(`/profile/${user.id}`)} style={{ display: 'flex', cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
            </svg>
          </span>
          <div className="tap" onClick={() => go('/student/notification')} style={{ position: 'relative', cursor: 'pointer', display: 'flex' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
            </svg>
            {unread > 0 && <span style={{ position: 'absolute', top: -5, right: -7, background: '#e24b4a', color: '#fff', fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '1.5px solid #fff' }}>{unread > 99 ? '99+' : unread}</span>}
          </div>
        </div>
      </div>

      <div className="no-scrollbar" style={{ position: 'relative', zIndex: 4, padding: '4px 20px 120px' }}>

        {/* HERO */}
        <div style={{ position: 'relative', borderRadius: 30, padding: '22px', overflow: 'hidden', background: T.heroGrad, ...glassBlur, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${T.border}`, boxShadow: '0 20px 50px -20px rgba(0,0,0,0.35)' }}>
          <svg width="150" height="72" viewBox="0 0 150 72" style={{ position: 'absolute', top: 16, right: 18, opacity: 0.95 }}>
            <path d="M8 40 L44 20 L82 34 L112 14 L140 30" stroke={T.constStroke} strokeWidth="1.5" fill="none" />
            {[[8, 40, 5], [44, 20, 7], [82, 34, 4], [112, 14, 6], [140, 30, 4.5]].map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r={c[2]} fill={T.constFill} />)}
          </svg>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 44 }}>
            <div>
              <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.2 }}>
                {user && nextBooking ? <>이번 주<br />수업 예약</> : <>수업 예약,<br />여기서 시작</>}
              </div>
              <div style={{ marginTop: 9, fontSize: 13, color: T.sub, fontWeight: 500 }}>{heroSub}</div>
            </div>
            {weather && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.sub, fontWeight: 700, fontSize: 15, flexShrink: 0, marginTop: 2 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15Z" strokeLinejoin="round" />
                </svg>
                {weather.temp}°
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
            <button onClick={() => go('/student/curriculum?tab=core')} style={{ flex: 1, padding: '13px 0', borderRadius: 15, border: `1px solid ${T.ghostBorder}`, background: T.ghostBg, color: T.text, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{user ? '자세히' : '커리큘럼'}</button>
            <button onClick={() => go(user ? '/student/calendar' : '/signup')} style={{ flex: 1.2, padding: '13px 0', borderRadius: 15, border: 'none', background: T.primaryGrad, color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: T.primaryShadow }}>예약하기</button>
            <button onClick={onAsk} style={{ flex: 1.3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 0', borderRadius: 15, border: 'none', background: T.accentGrad, color: T.accentText, fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: T.accentShadow }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v11H8l-4 3Z" strokeLinejoin="round" /></svg>
              수업 문의
            </button>
          </div>
        </div>

        {/* DATE STRIP — stripRef에 부모의 드래그 관성 스크롤이 붙는다 */}
        <div ref={stripRef} className="no-scrollbar" style={{ display: 'flex', gap: 9, marginTop: 18, overflowX: 'auto', cursor: 'grab', touchAction: 'pan-x' }}>
          {stripDates.map(d => {
            const ds = fmt(d)
            const isSel = selDate === ds
            const isToday = ds === todayStr
            const isMon = d.getDay() === 1
            const has = bookedDates.has(ds)
            const label = d.getDate() === 1 ? `${d.getMonth() + 1}월` : DOW[d.getDay()]
            return (
              <button key={ds} onClick={() => onDate(d)} style={{ flex: '0 0 auto', width: 56, padding: '11px 0', borderRadius: 16, position: 'relative', border: `1px solid ${isSel ? T.accent : T.dayRing}`, background: isSel ? T.accentSoft : (isMon ? T.dayBgMute : T.dayBg), ...glassBlur, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: isMon ? T.dim : T.text, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center', opacity: isMon ? 0.6 : 1 }}>
                {has && <span style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: '50%', background: T.accent, border: '1.5px solid #fff' }} />}
                <div style={{ fontSize: 11, color: isToday ? T.accent : T.faint, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>{d.getDate()}</div>
              </button>
            )
          })}
        </div>

        {/* SELECTED DAY LIST */}
        {selDate && (() => {
          const d = new Date(selDate + 'T00:00:00')
          const list = coursesOn(selDate)
          const past = selDate < todayStr
          return (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 8px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>{d.getMonth() + 1}월 {d.getDate()}일 ({DOW[d.getDay()]}) 수업</span>
                <span onClick={() => go(`/student/calendar?date=${selDate}`)} style={{ fontSize: 11, color: T.faint, cursor: 'pointer' }}>캘린더에서 보기 →</span>
              </div>
              {list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '15px 0', color: T.faint, fontSize: 12, borderRadius: 16, border: `1px dashed ${T.ghostBorder}`, background: T.glassN, ...glassBlur }}>이날은 수업이 없어요 🐾</div>
              ) : list.map(c => (
                <div key={c.id} style={{ borderRadius: 18, padding: '12px 14px', marginBottom: 8, background: T.glass, ...glassBlur, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: c.category === 'free' ? 0 : 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>강사 {c.teacher}</div>
                    </div>
                    {c.category === 'free' && !past && <button onClick={() => go(`/student/free?date=${selDate}`)} style={{ fontSize: 11, fontWeight: 700, color: T.accentText, background: T.accentSoft, border: `1px solid ${T.accent}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>자리 고르기</button>}
                  </div>
                  {c.category !== 'free' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {schedulesFor(c, selDate).map(s => {
                        const lb = `${s.start_time}~${s.end_time}`
                        const mine = myBookingFor(c, s, selDate)
                        const cnt = seatCount(c, s, selDate)
                        const full = cnt >= (c.max_count || 999)
                        const busy = bookingBusy === `${c.id}-${s.id}-${selDate}`
                        if (mine) return <button key={s.id} onClick={() => onCancel(mine, lb)} style={{ fontSize: 11, fontWeight: 700, color: T.accentText, background: T.accentSoft, border: `1px solid ${T.accent}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>✓ {lb} 예약됨</button>
                        if (past) return <span key={s.id} style={{ fontSize: 11, color: T.dim, border: `1px solid ${T.dayRing}`, borderRadius: 20, padding: '6px 12px' }}>{lb}</span>
                        if (full) return <span key={s.id} style={{ fontSize: 11, fontWeight: 700, color: T.faint, background: 'rgba(255,255,255,0.4)', borderRadius: 20, padding: '6px 12px' }}>{lb} 마감</span>
                        return <button key={s.id} disabled={busy} onClick={() => onQuickBook(c, s, selDate)} style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: T.accent, border: 'none', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>{busy ? '예약 중…' : `${lb} 예약`}</button>
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })()}

        {/* QUICK TILES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
          <Tile bg={T.tile1} label="커리큘럼" onClick={() => go('/student/curriculum?tab=core')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.7"><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v16H6.5A1.5 1.5 0 0 1 5 18.5Z" strokeLinejoin="round" /><path d="M8 4v16" strokeLinecap="round" /></svg>
          </Tile>
          <Tile bg={T.tile2} label="기록" onClick={() => go('/student/records')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.7"><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" strokeLinejoin="round" /><path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" /></svg>
          </Tile>
          <Tile bg={T.tile3} label="텃밭" onClick={() => go('/student/farm')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.7"><path d="M12 21v-8" strokeLinecap="round" /><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5ZM12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" strokeLinejoin="round" /></svg>
          </Tile>
          <Tile bg={T.tile4} label="알림" onClick={() => go('/student/notification')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.7"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" /></svg>
          </Tile>
        </div>

        {/* PENDING */}
        {pendingBooking && (
          <div onClick={() => go(`/student/calendar?date=${pendingBooking.class_date}`)} style={{ marginTop: 14, borderRadius: 20, padding: '14px 16px', background: T.glass, ...glassBlur, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>입금 안내</div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingBooking.class_name} · {pendingBooking.class_date.slice(5).replace('-', '/')} {pendingBooking.class_time?.split('~')[0] || ''}{pendingBooking.amount ? ` · ${Number(pendingBooking.amount).toLocaleString()}원` : ''}</div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: T.accentText, background: T.accentSoft, borderRadius: 10, padding: '5px 11px' }}>입금 대기</span>
          </div>
        )}

        {/* PASS CARD */}
        {user && ticket && (
          <div style={{ marginTop: 16, borderRadius: 24, padding: '19px 20px', background: T.glass, ...glassBlur, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: T.faint, fontWeight: 600 }}>내 수강권</span>
              <span style={{ fontSize: 11.5, color: T.dim, fontWeight: 500 }}>만료 {ticket.expires_at}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, letterSpacing: '-0.4px' }}>{ticket.total}회권 · 잔여 {ticket.remain}회</div>
            <div style={{ marginTop: 14, height: 9, borderRadius: 9, background: T.track, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((ticket.remain / ticket.total) * 100)}%`, height: '100%', borderRadius: 9, background: T.accentGrad, boxShadow: T.progGlow }} />
            </div>
          </div>
        )}

        {/* NOTICES */}
        {notices.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill={T.accent}><path d="M9 3h6l-1 6 4 3-5 1v7l-2 1-2-9-3-1 4-3Z" /></svg>
                <span style={{ fontSize: 16, fontWeight: 800 }}>스튜디오 공지</span>
              </div>
              <span onClick={() => go('/lounge')} style={{ fontSize: 12.5, color: T.faint, fontWeight: 600, cursor: 'pointer' }}>라운지에서 보기 →</span>
            </div>
            {notices.map((n, i) => {
              const thumb = (n.images && n.images[0]) || n.image_url
              return (
                <div key={n.id} onClick={() => go('/lounge')} style={{ marginTop: i ? 11 : 0, borderRadius: 20, padding: '15px 16px', background: T.glassN, ...glassBlur, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${T.border}`, display: 'flex', gap: 13, alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: T.accent, padding: '3px 8px', borderRadius: 7 }}>공지</span>
                      <span style={{ fontSize: 12, color: T.faint, fontWeight: 600 }}>{n.author_name} · {(n.created_at || '').slice(5, 10).replace('-', '/')}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, color: T.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{n.title || n.content || '사진 공지'}</div>
                  </div>
                  {thumb ? <img src={thumb} alt="" loading="lazy" style={{ flex: '0 0 58px', width: 58, height: 58, borderRadius: 14, objectFit: 'cover' }} /> : <div style={{ flex: '0 0 58px', width: 58, height: 58, borderRadius: 14, background: i % 2 ? T.thumb2 : T.thumb1 }} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* GLASS BOTTOM NAV */}
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 430, zIndex: 7, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '11px 8px 20px', background: T.navBg, ...glassBlur, backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderTop: `1px solid ${T.navBorder}`, boxSizing: 'border-box' }}>
        <NavItem active label="홈" onClick={() => go('/student')}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 11 12 4l8 7" strokeLinejoin="round" /><path d="M6 10v9h12v-9" strokeLinejoin="round" /></svg>
        </NavItem>
        <NavItem label="캘린더" onClick={() => go('/student/calendar')}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M4 9h16M8 3v4M16 3v4" strokeLinecap="round" /></svg>
        </NavItem>
        <NavItem label="기록" onClick={() => go('/student/records')}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" strokeLinejoin="round" /><path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" /></svg>
        </NavItem>
        <NavItem label="냥밭" onClick={() => go('/student/farm')}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21v-8" strokeLinecap="round" /><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5ZM12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" strokeLinejoin="round" /><path d="M5 21h14" strokeLinecap="round" /></svg>
        </NavItem>
        <NavItem label="라운지" onClick={() => go('/lounge')}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 6h14v10H9l-4 3Z" strokeLinejoin="round" /></svg>
        </NavItem>
        <NavItem label="설정" onClick={() => go('/student/settings')}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" /></svg>
        </NavItem>
      </div>
    </div>
  )
}
