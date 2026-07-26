'use client'
import HeroWeatherFX from './HeroWeatherFX'
import SpaceBg from './SpaceBg'
// 울트라 스페이스(space) 테마 전용 다크 홈 — 2026 여름 한정(2달) 스킨.
// 첨부 iOS 위젯 목업의 카드 그라데이션을 섹션별로 그대로 이식한다.
//   Codex(마젠타 라디얼)  → HERO "수업 예약, 여기서 시작"
//   Media(딥 블루)         → 날짜 스트립 셀
//   Web Design(세이지+주황) → 내 수강권 카드(진행바 = 주황)
//   UI(러스트+블루 글로우)  → 커리큘럼·기록·텃밭·알림 타일
//   Total Skills(더스티 로즈) → 스튜디오 공지 카드
// 배경 = 어두운 바이올렛(검정에 가까움). 외곽선 전부 제거 — 깊이는 그림자/내부 하이라이트로만.
// data/핸들러는 app/student/page.js에서 props로 받는다(GlassHome과 동일 계약).

const S = {
  bg: '#0d0812',
  text: '#f3eef8', sub: 'rgba(243,238,248,0.66)', faint: 'rgba(243,238,248,0.5)', dim: 'rgba(243,238,248,0.34)',
  accent: '#e35ba6', accentText: '#ffe6f2', accentSoft: 'rgba(227,91,166,0.16)', accentRing: 'rgba(227,91,166,0.5)',
  // 첨부 이미지 카드 그라데이션 (섹션별) — 진한 명도 코어의 '위치'를 원본대로.
  // Codex: 코어 #581b3a(짧게) → 중간연결 #ba426f → 외곽 #c593b9 (색이 넓게).
  hero: 'radial-gradient(116% 124% at 52% 44%, #581b3a 0%, #581b3a 13%, #ba426f 40%, #c593b9 100%)',
  // 날짜: 코어 #0d0a1b(짧게) → 중간 #363e44 → 외곽 #92a19a (외곽 영역 넓게 — 반경 축소·외곽 스톱 당김).
  media: 'radial-gradient(72% 74% at 50% 42%, #0d0a1b 0%, #0d0a1b 13%, #363e44 38%, #92a19a 84%, #92a19a 100%)',
  mediaSel: 'radial-gradient(72% 74% at 50% 42%, #1a1530 0%, #1a1530 13%, #4a565f 38%, #a8b6ae 84%, #a8b6ae 100%)',
  // 오늘: 같은 그라데이션 구조를 유지하되 조화되는 웜 로즈(세이지 날짜들과 구분).
  mediaToday: 'radial-gradient(72% 74% at 50% 42%, #2c0f1f 0%, #2c0f1f 13%, #86345c 38%, #d69ab8 84%, #d69ab8 100%)',
  // 수강권: 코어 #06050b(짧게) → 연결·외곽 #1a2252 동일(작은 검정 코어 + 네이비가 대부분).
  pass: 'radial-gradient(120% 120% at 50% 44%, #06050b 0%, #06050b 10%, #1a2252 34%, #1a2252 100%)',
  passFill: 'linear-gradient(90deg, #e8531d, #f2872f 60%, #f6b23e)',
  // 퀵타일 4종 공통 — 코어 #210107(면적 축소) → 연결 #341124 → 외곽 #76739b(영역 확장).
  tile: 'radial-gradient(82% 88% at 50% 40%, #210107 0%, #210107 6%, #341124 27%, #76739b 74%, #76739b 100%)',
  // 공지: 상단 #44404f → 연결 #865c66 → 하단 #be787a (세로 그라데이션).
  notice: 'linear-gradient(180deg, #44404f 0%, #865c66 52%, #be787a 100%)',
  // 다크 유리(그 외 요소)
  glass: 'rgba(255,255,255,0.055)', glassSoft: 'rgba(255,255,255,0.035)',
  hi: 'inset 0 1px 0 rgba(255,255,255,0.08)', hiStrong: 'inset 0 1px 0 rgba(255,255,255,0.14)',
  navBg: 'rgba(18,12,26,0.82)', navMute: 'rgba(243,238,248,0.42)',
  track: 'rgba(255,255,255,0.1)',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const glassBlur = { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Tile({ bg, label, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding: '15px 0 12px', borderRadius: 20, border: 'none', background: bg, boxShadow: S.hi, color: S.text, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {children}
      <span style={{ fontSize: 12, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.45)' }}>{label}</span>
    </button>
  )
}

function NavItem({ active, label, onClick, children }) {
  return (
    <div onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 0', cursor: 'pointer', color: active ? S.accent : S.navMute }}>
      {children}
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600 }}>{label}</span>
    </div>
  )
}

export default function SpaceHome(props) {
  const {
    user, ticket, nextBooking, pendingBooking, notices = [], weather, heroSub, unread = 0,
    stripDates = [], selDate, todayStr, bookedDates = new Set(), stripRef,
    coursesOn = () => [], schedulesFor = () => [], myBookingFor = () => null, seatCount = () => 0, bookingBusy,
    upcomingOneday = [], onOneday = () => {},
    onDate = () => {}, onQuickBook = () => {}, onCancel = () => {}, onAsk = () => {}, go = () => {},
  } = props

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'transparent', color: S.text, fontFamily: "'Pretendard','Nunito',-apple-system,sans-serif" }}>
      {/* 우주 배경 — 성운 + 반짝이는 별밭(고정, 콘텐츠 뒤) */}
      <SpaceBg />
      {/* 오늘 날짜 박스 바깥쪽으로 퍼지는 빛 일렁임(은은) — 외곽 헤일로만, 밝기·번짐이 부드럽게 흐른다 */}
      <style>{`@keyframes todayGlow{
        0%{box-shadow:0 0 7px 0 rgba(241,152,199,0.44)}
        40%{box-shadow:0 0 14px 1px rgba(246,152,202,0.88)}
        70%{box-shadow:0 0 10px 0 rgba(234,134,188,0.62)}
        100%{box-shadow:0 0 7px 0 rgba(241,152,199,0.44)}
      }`}</style>

      {/* top bar */}
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <circle cx="13" cy="13" r="9.5" stroke="#8f7fe0" strokeWidth="3" />
            <circle cx="22" cy="22" r="8" fill={S.accent} />
          </svg>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.4px' }}>2호선 스튜디오</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: S.sub }}>
          <span className="tap" onClick={() => user && go(`/profile/${user.id}`)} style={{ display: 'flex', cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
            </svg>
          </span>
          <div className="tap" onClick={() => go('/student/notification')} style={{ position: 'relative', cursor: 'pointer', display: 'flex' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
            </svg>
            {unread > 0 && <span style={{ position: 'absolute', top: -5, right: -7, background: '#ff5b7f', color: '#fff', fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '1.5px solid #1a1024' }}>{unread > 99 ? '99+' : unread}</span>}
          </div>
        </div>
      </div>

      <div className="no-scrollbar" style={{ position: 'relative', zIndex: 4, padding: '4px 20px 120px' }}>

        {/* HERO — Codex 마젠타 라디얼 (블랙홀 중심 + 글로우 도트) */}
        <div style={{ position: 'relative', borderRadius: 30, padding: '22px', overflow: 'hidden', background: S.hero, boxShadow: '0 22px 55px -20px rgba(186,66,111,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' }}>
          <HeroWeatherFX code={weather?.code} />
          {/* Codex 스타일 글로우 도트 라인 — 왼쪽 두 개만 강한 글로우 */}
          <svg width="200" height="20" viewBox="0 0 200 20" style={{ position: 'absolute', top: 26, left: 18, zIndex: 1 }}>
            <circle cx="6" cy="10" r="6.5" fill="#fff" opacity="0.28" />
            <circle cx="20" cy="10" r="6" fill="#fff" opacity="0.24" />
            {[6, 20, 42, 66, 92, 110, 128, 146, 164, 182].map((x, i) => (
              <circle key={i} cx={x} cy="10" r={i < 2 ? 3.4 : 2.2} fill="#fff" opacity={i < 2 ? 1 : 0.82} />
            ))}
          </svg>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 44, position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.2, color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,0.45)' }}>
                {user && nextBooking ? <>이번 주<br />수업 예약</> : <>수업 예약,<br />여기서 시작</>}
              </div>
              <div style={{ marginTop: 9, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{heroSub}</div>
            </div>
            {weather && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 15, flexShrink: 0, marginTop: 2 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15Z" strokeLinejoin="round" />
                </svg>
                {weather.temp}°
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 20, position: 'relative', zIndex: 1 }}>
            <button onClick={() => go('/student/curriculum?tab=core')} style={{ flex: 1, padding: '13px 0', borderRadius: 15, border: 'none', background: 'rgba(255,255,255,0.15)', boxShadow: S.hi, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{user ? '자세히' : '커리큘럼'}</button>
            <button onClick={() => go(user ? '/student/calendar' : '/signup')} style={{ flex: 1.2, padding: '13px 0', borderRadius: 15, border: 'none', background: 'linear-gradient(135deg,#ffffff,#ffe1f0)', color: '#8a1f5a', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -8px rgba(255,255,255,0.5)' }}>예약하기</button>
            <button onClick={onAsk} style={{ flex: 1.3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 0', borderRadius: 15, border: 'none', background: 'linear-gradient(135deg,#4a5fb4,#2c3d78)', color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 20px -8px rgba(64,86,196,0.6)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v11H8l-4 3Z" strokeLinejoin="round" /></svg>
              수업 문의
            </button>
          </div>
        </div>

        {/* DATE STRIP — Media 딥 블루 셀 */}
        <div style={{ fontSize: 11, color: S.faint, fontWeight: 700, margin: '18px 2px 6px' }}>날짜를 터치해서 예약하기</div>
        <div ref={stripRef} className="no-scrollbar" style={{ display: 'flex', gap: 9, overflowX: 'auto', overflowY: 'visible', cursor: 'grab', touchAction: 'pan-x' }}>
          {stripDates.map(d => {
            const ds = fmt(d)
            const isSel = selDate === ds
            const isToday = ds === todayStr
            const isMon = d.getDay() === 1
            const has = bookedDates.has(ds)
            const label = d.getDate() === 1 ? `${d.getMonth() + 1}월` : DOW[d.getDay()]
            return (
              <button key={ds} onClick={() => onDate(d)} style={{ flex: '0 0 auto', width: 56, padding: '11px 0', borderRadius: 16, position: 'relative', border: 'none', background: isToday ? S.mediaToday : (isSel ? S.mediaSel : S.media), boxShadow: isToday ? '0 0 7px 0 rgba(241,152,199,0.44)' : (isSel ? `0 0 0 2px ${S.accentRing}, ${S.hiStrong}` : S.hi), animation: isToday ? 'todayGlow 2.8s ease-in-out infinite' : undefined, color: '#f4f0f6', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center', opacity: isMon ? 0.55 : 1 }}>
                {has && <span style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: '50%', background: S.accent, border: '1.5px solid rgba(0,0,0,0.35)' }} />}
                <div style={{ fontSize: 11, color: isToday ? '#ffe0ec' : 'rgba(238,241,251,0.74)', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{d.getDate()}</div>
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
                <span onClick={() => go(`/student/calendar?date=${selDate}`)} style={{ fontSize: 11, color: S.faint, cursor: 'pointer' }}>캘린더에서 보기 →</span>
              </div>
              {list.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '15px 0', color: S.faint, fontSize: 12, borderRadius: 16, background: S.glassSoft, boxShadow: S.hi, ...glassBlur }}>이날은 수업이 없어요 🐾</div>
              ) : list.map(c => (
                <div key={c.id} style={{ borderRadius: 18, padding: '12px 14px', marginBottom: 8, background: S.glass, ...glassBlur, boxShadow: S.hi }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: c.category === 'free' ? 0 : 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: S.faint, marginTop: 1 }}>강사 {c.teacher}</div>
                    </div>
                    {c.category === 'free' && !past && <button onClick={() => go(`/student/free?date=${selDate}`)} style={{ fontSize: 11, fontWeight: 700, color: S.accentText, background: S.accentSoft, border: `1px solid ${S.accentRing}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>자리 고르기</button>}
                  </div>
                  {c.category !== 'free' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {schedulesFor(c, selDate).map(s => {
                        const lb = `${s.start_time}~${s.end_time}`
                        const mine = myBookingFor(c, s, selDate)
                        const cnt = seatCount(c, s, selDate)
                        const full = cnt >= (c.max_count || 999)
                        const busy = bookingBusy === `${c.id}-${s.id}-${selDate}`
                        if (mine) return <button key={s.id} onClick={() => onCancel(mine, lb)} style={{ fontSize: 11, fontWeight: 700, color: S.accentText, background: S.accentSoft, border: `1px solid ${S.accentRing}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>✓ {lb} 예약됨</button>
                        if (past) return <span key={s.id} style={{ fontSize: 11, color: S.dim, border: `1px solid rgba(255,255,255,0.14)`, borderRadius: 20, padding: '6px 12px' }}>{lb}</span>
                        if (full) return <span key={s.id} style={{ fontSize: 11, fontWeight: 700, color: S.faint, background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 12px' }}>{lb} 마감</span>
                        return <button key={s.id} disabled={busy} onClick={() => onQuickBook(c, s, selDate)} style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: S.accent, border: 'none', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>{busy ? '예약 중…' : `${lb} 예약`}</button>
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })()}

        {/* QUICK TILES — 4종 공통 그라데이션(#210107→#341124→#76739b) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
          <Tile bg={S.tile} label="커리큘럼" onClick={() => go('/student/curriculum?tab=core')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v16H6.5A1.5 1.5 0 0 1 5 18.5Z" strokeLinejoin="round" /><path d="M8 4v16" strokeLinecap="round" /></svg>
          </Tile>
          <Tile bg={S.tile} label="기록" onClick={() => go('/student/records')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" strokeLinejoin="round" /><path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" /></svg>
          </Tile>
          <Tile bg={S.tile} label="텃밭" onClick={() => go('/student/farm')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><path d="M12 21v-8" strokeLinecap="round" /><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5ZM12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" strokeLinejoin="round" /></svg>
          </Tile>
          <Tile bg={S.tile} label="알림" onClick={() => go('/student/notification')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" /></svg>
          </Tile>
        </div>

        {/* PENDING */}
        {pendingBooking && (
          <div onClick={() => go(`/student/calendar?date=${pendingBooking.class_date}`)} style={{ marginTop: 14, borderRadius: 20, padding: '14px 16px', background: S.glass, ...glassBlur, boxShadow: S.hi, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>입금 안내</div>
              <div style={{ fontSize: 11, color: S.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingBooking.class_name} · {pendingBooking.class_date.slice(5).replace('-', '/')} {pendingBooking.class_time?.split('~')[0] || ''}{pendingBooking.amount ? ` · ${Number(pendingBooking.amount).toLocaleString()}원` : ''}</div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: S.accentText, background: S.accentSoft, borderRadius: 10, padding: '5px 11px' }}>입금 대기</span>
          </div>
        )}

        {/* PASS CARD — 네이비(#1a2252) + 주황 진행바. 다크 배경과 대비 약해 링으로 분리 */}
        {user && ticket && (
          <div style={{ marginTop: 16, borderRadius: 24, padding: '19px 20px', background: S.pass, boxShadow: '0 0 0 1px rgba(122,140,220,0.28), 0 16px 36px -16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.16)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'rgba(243,240,232,0.62)', fontWeight: 600 }}>내 수강권</span>
              <span style={{ fontSize: 11.5, color: 'rgba(243,240,232,0.42)', fontWeight: 500 }}>만료 {ticket.expires_at}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, letterSpacing: '-0.4px', color: '#f6f3ec' }}>{ticket.total}회권 · 잔여 {ticket.remain}회</div>
            {(() => {
              const pct = Math.max(0, Math.min(100, Math.round((ticket.remain / ticket.total) * 100)))
              return (
                <div style={{ position: 'relative', marginTop: 18, marginBottom: 3 }}>
                  <div style={{ height: 6, borderRadius: 6, background: 'rgba(0,0,0,0.32)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: S.passFill, boxShadow: '0 0 10px rgba(239,95,34,0.65)' }} />
                  </div>
                  {/* 노란 삼각 마커 (원본 Web Design 슬라이더) */}
                  <div style={{ position: 'absolute', top: -6, left: `${pct}%`, transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid #f6d24a', filter: 'drop-shadow(0 1px 3px rgba(246,210,74,0.55))' }} />
                </div>
              )
            })()}
          </div>
        )}

        {/* 원데이 클래스 */}
        {upcomingOneday.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 10px' }}>
              <span style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff8ac2" strokeWidth="1.7">
                  <path d="M12 3a9 9 0 0 0 0 18c1.6 0 1.9-1.2 1.2-2.1-.8-1 .1-2.4 1.3-2.4H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5Z" strokeLinejoin="round" />
                  <circle cx="8" cy="11" r="1.1" fill="#ff8ac2" stroke="none" /><circle cx="12" cy="8" r="1.1" fill="#ff8ac2" stroke="none" /><circle cx="16" cy="11" r="1.1" fill="#ff8ac2" stroke="none" />
                </svg>
                원데이 클래스
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#ff8ac2', background: 'rgba(255,138,194,0.14)', border: '1px solid rgba(255,138,194,0.3)', borderRadius: 10, padding: '2px 9px' }}>하루만 열려요</span>
            </div>
            {upcomingOneday.map(({ course, date, schedules }) => {
              const d = new Date(date + 'T00:00:00')
              const tLabel = schedules.length > 1 ? `${schedules[0].start_time} 외 ${schedules.length - 1}` : `${schedules[0].start_time}~${schedules[0].end_time}`
              return (
                <div key={course.id} onClick={() => onOneday(date)} style={{ marginBottom: 8, borderRadius: 18, padding: '12px 14px', background: S.glass, ...glassBlur, boxShadow: S.hi, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,138,194,0.14)', border: '1px solid rgba(255,138,194,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#ff8ac2' }}>{d.getMonth() + 1}월</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: '#ff8ac2', marginTop: 1 }}>{d.getDate()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</div>
                    <div style={{ fontSize: 11, color: S.sub, marginTop: 2 }}>{DOW[d.getDay()]}요일 · {tLabel}{course.price ? ` · ${Number(course.price).toLocaleString()}원` : ''}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#d24d95', borderRadius: 20, padding: '6px 13px' }}>신청 →</span>
                </div>
              )
            })}
          </div>
        )}

        {/* NOTICES — Total Skills 더스티 로즈 카드 */}
        {notices.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill={S.accent}><path d="M9 3h6l-1 6 4 3-5 1v7l-2 1-2-9-3-1 4-3Z" /></svg>
                <span style={{ fontSize: 16, fontWeight: 800 }}>스튜디오 공지</span>
              </div>
              <span onClick={() => go('/lounge')} style={{ fontSize: 12.5, color: S.faint, fontWeight: 600, cursor: 'pointer' }}>라운지에서 보기 →</span>
            </div>
            {notices.map((n, i) => {
              const thumb = (n.images && n.images[0]) || n.image_url
              return (
                <div key={n.id} onClick={() => go('/lounge')} style={{ marginTop: i ? 11 : 0, borderRadius: 20, padding: '15px 16px', background: S.notice, boxShadow: '0 12px 30px -18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)', display: 'flex', gap: 13, alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#5a2a3a', background: '#f5d99a', padding: '3px 8px', borderRadius: 7 }}>공지</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', fontWeight: 600 }}>{n.author_name} · {(n.created_at || '').slice(5, 10).replace('-', '/')}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, color: '#fdf4f5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{n.title || n.content || '사진 공지'}</div>
                  </div>
                  {thumb ? <img src={thumb} alt="" loading="lazy" style={{ flex: '0 0 58px', width: 58, height: 58, borderRadius: 14, objectFit: 'cover' }} /> : <div style={{ flex: '0 0 58px', width: 58, height: 58, borderRadius: 14, background: 'linear-gradient(140deg,#c2898c,#6f5a6d)' }} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* GLASS BOTTOM NAV */}
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 430, zIndex: 7, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '11px 8px 20px', background: S.navBg, ...glassBlur, backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderTop: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box' }}>
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
