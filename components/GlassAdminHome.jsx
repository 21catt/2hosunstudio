'use client'
import HeroWeatherFX from './HeroWeatherFX'
import { NavIcon } from './NavIcons'
// 관리자 홈 fresh(싱그러운) 글래스 스킨 — GlassHome과 동일한 글래스 토큰·드롭섀도우.
// data/핸들러는 app/admin/page.js에서 props로 받는다.

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
  warnText: '#7a5312', warnSoft: 'rgba(232,163,61,0.2)', warnBorder: 'rgba(232,163,61,0.55)',
  tile1: 'linear-gradient(160deg, rgba(130,150,60,0.5), rgba(130,150,60,0.2))',
  tile2: 'linear-gradient(160deg, rgba(148,198,232,0.6), rgba(148,198,232,0.25))',
  tile3: 'linear-gradient(160deg, rgba(110,130,170,0.45), rgba(110,130,170,0.18))',
  tile4: 'linear-gradient(160deg, rgba(170,180,120,0.5), rgba(170,180,120,0.2))',
  track: 'rgba(51,64,44,0.1)',
  navBg: 'rgba(240,246,248,0.88)', navBorder: 'rgba(51,64,44,0.08)', navMute: 'rgba(51,64,44,0.45)',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const TILE_BG = [T.tile1, T.tile2, T.tile3, T.tile4]
const glassBlur = { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }

function Badge({ n }) {
  if (!n) return null
  return (
    <span style={{ position: 'absolute', top: 6, right: 8, background: '#e24b4a', color: '#fff', fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1, border: '1.5px solid #fff' }}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

function IconChip({ title, onClick, fill, children }) {
  return (
    <div className="tap" onClick={onClick} title={title}
      style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        background: fill ? T.accentGrad : 'rgba(255,255,255,0.5)', ...glassBlur, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${fill ? 'transparent' : T.border}`, color: fill ? T.accentText : T.text, boxShadow: fill ? T.accentShadow : 'none' }}>
      {children}
    </div>
  )
}

function NavItem({ active, label, badge, onClick, children }) {
  return (
    <div onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 0', cursor: 'pointer', color: active ? T.accent : T.navMute }}>
      <div style={{ position: 'relative', display: 'flex' }}>
        {children}
        {badge > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -8, background: '#e24b4a', color: '#fff', fontSize: 9, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1, border: '1.5px solid #fff' }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600 }}>{label}</span>
    </div>
  )
}

export default function GlassAdminHome(props) {
  const {
    now = new Date(), weather, todayCount = 0, attendedCnt = 0, memberCnt = 0,
    todayGroups = [], menus = [], paymentBadge = 0, pendingCnt = 0, refundCnt = 0, unread = 0,
    pushEnabled = false, onEnablePush = () => {}, onKakao = () => {}, onSettings = () => {}, onLogout = () => {}, go = () => {},
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
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <circle cx="13" cy="13" r="9.5" stroke={T.logoRing} strokeWidth="3" />
            <circle cx="22" cy="22" r="8" fill={T.accent} />
          </svg>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.4px' }}>관리자 홈</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <IconChip title={pushEnabled ? '예약 알림 켜짐' : '예약 알림 설정'} onClick={onEnablePush} fill={pushEnabled}>
            <NavIcon name="bell" color={pushEnabled ? T.accentText : T.text} size={18} />
          </IconChip>
          <IconChip title="카카오톡 연동" onClick={onKakao}>
            <NavIcon name="chat" color={T.text} size={18} />
          </IconChip>
          <IconChip title="개인 설정" onClick={onSettings}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </IconChip>
          <IconChip title="로그아웃" onClick={onLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </IconChip>
        </div>
      </div>

      <div className="no-scrollbar" style={{ position: 'relative', zIndex: 4, padding: '4px 20px 120px' }}>

        {/* HERO */}
        <div style={{ position: 'relative', borderRadius: 30, padding: '22px', overflow: 'hidden', background: T.heroGrad, ...glassBlur, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${T.border}`, boxShadow: '0 20px 50px -20px rgba(0,0,0,0.35)' }}>
          <HeroWeatherFX code={weather?.code} />
          <svg width="150" height="72" viewBox="0 0 150 72" style={{ position: 'absolute', top: 16, right: 18, opacity: 0.95, zIndex: 1 }}>
            <path d="M8 40 L44 20 L82 34 L112 14 L140 30" stroke={T.constStroke} strokeWidth="1.5" fill="none" />
            {[[8, 40, 5], [44, 20, 7], [82, 34, 4], [112, 14, 6], [140, 30, 4.5]].map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r={c[2]} fill={T.constFill} />)}
          </svg>
          <div style={{ position: 'relative', zIndex: 1, marginTop: 44 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.2 }}>
                {now.getMonth() + 1}월 {now.getDate()}일<br />({DOW[now.getDay()]}) 오늘
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
            <div style={{ marginTop: 9, fontSize: 13, color: T.sub, fontWeight: 500 }}>
              예약 {todayCount}명 · 출석 {attendedCnt}명 · 회원 {memberCnt}명 🐾
            </div>
            <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
              <button onClick={() => go('/admin/attendance')} style={{ flex: 1.2, padding: '13px 0', borderRadius: 15, border: 'none', background: T.primaryGrad, color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: T.primaryShadow }}>출석 체크하기</button>
              <button onClick={() => go('/admin/schedule')} style={{ flex: 1, padding: '13px 0', borderRadius: 15, border: `1px solid ${T.ghostBorder}`, background: T.ghostBg, color: T.text, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>수업 현황</button>
            </div>
          </div>
        </div>

        {/* MENU TILES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
          {menus.map((m, i) => (
            <button key={m.label} onClick={() => go(m.href)}
              style={{ position: 'relative', padding: '15px 0 12px', borderRadius: 20, border: `1px solid ${T.border}`, background: TILE_BG[i % 4], ...glassBlur, color: T.text, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <NavIcon name={m.icon} color={T.text} size={22} />
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>{m.label}</span>
              <Badge n={m.badge} />
            </button>
          ))}
        </div>

        {/* PAYMENT ALERT */}
        {paymentBadge > 0 && (
          <div onClick={() => go('/admin/payment')} style={{ marginTop: 16, borderRadius: 20, padding: '14px 16px', background: T.glass, ...glassBlur, border: `1px solid ${T.warnBorder}`, boxShadow: '0 10px 26px -16px rgba(122,83,18,0.5)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.warnSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <NavIcon name="card" color={T.warnText} size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.warnText }}>
                {pendingCnt > 0 && `입금 대기 ${pendingCnt}건`}
                {pendingCnt > 0 && refundCnt > 0 && ' · '}
                {refundCnt > 0 && `환불 필요 ${refundCnt}건`}
              </div>
              <div style={{ fontSize: 11, color: T.warnText, opacity: 0.8, marginTop: 2, fontWeight: 600 }}>눌러서 바로 처리하기</div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 17, color: T.warnText }}>›</span>
          </div>
        )}

        {/* TODAY CLASSES */}
        <div style={{ fontSize: 13, fontWeight: 800, margin: '24px 2px 10px' }}>오늘 수업</div>
        {todayGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '18px 0', color: T.faint, fontSize: 12, borderRadius: 18, border: `1px dashed ${T.ghostBorder}`, background: T.glassN, ...glassBlur }}>오늘은 예약된 수업이 없어요 🐾</div>
        ) : todayGroups.map(g => (
          <div key={g.time} onClick={() => go('/admin/attendance')} style={{ marginBottom: 9, borderRadius: 20, padding: '13px 15px', background: T.glass, ...glassBlur, border: `1px solid ${T.border}`, boxShadow: '0 10px 26px -18px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.accentText, background: T.accentSoft, borderRadius: 10, padding: '6px 10px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{g.start}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: T.faint, marginBottom: 3 }}>{g.time}</div>
              {g.classes.map((c, i) => (
                <div key={i} style={{ marginBottom: 2, lineHeight: 1.45 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800 }}>{c.cn}</span>
                  <span style={{ fontSize: 11, color: T.sub }}> · {c.names}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, flexShrink: 0, color: g.total > 0 && g.done === g.total ? T.accent : T.faint }}>출석 {g.done}/{g.total}</span>
          </div>
        ))}
      </div>

      {/* GLASS BOTTOM NAV */}
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 430, zIndex: 7, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '11px 6px 20px', background: T.navBg, ...glassBlur, backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderTop: `1px solid ${T.navBorder}`, boxSizing: 'border-box' }}>
        <NavItem active label="홈" onClick={() => go('/admin')}><NavIcon name="home" color={T.accent} size={22} /></NavItem>
        <NavItem label="회원" onClick={() => go('/admin/members')}><NavIcon name="users" color={T.navMute} size={22} /></NavItem>
        <NavItem label="수업현황" onClick={() => go('/admin/schedule')}><NavIcon name="calendar" color={T.navMute} size={22} /></NavItem>
        <NavItem label="출석" onClick={() => go('/admin/attendance')}><NavIcon name="check" color={T.navMute} size={22} /></NavItem>
        <NavItem label="기록" onClick={() => go('/admin/records')}><NavIcon name="clipboard" color={T.navMute} size={22} /></NavItem>
        <NavItem label="알림" badge={unread} onClick={() => go('/admin/notification')}><NavIcon name="bell" color={T.navMute} size={22} /></NavItem>
        <NavItem label="라운지" onClick={() => go('/lounge')}><NavIcon name="chat" color={T.navMute} size={22} /></NavItem>
      </div>
    </div>
  )
}
