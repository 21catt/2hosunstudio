'use client'
// /castle — 3D 메인(Castle Jelly) 1단계, **숨긴 미리보기** (2026-10-19)
//
// 사용자 지시: "바로 바꾸지 말고 숨겨서 진행하다가 완벽히 교체되면 그때 웹에서 보이게".
//   · 어디에도 링크하지 않는다 · 관리자(오너)만 열린다 — 그 밖은 원래 홈으로 돌려보낸다.
//   · 기존 학생 홈(/student)은 무변경.
// 구성: 가운데 3D 디오라마 · 왼쪽 수업 · 위 이번 주 일정 · 아래 기타 기능 · 오른쪽 유리 패널(오늘 + 장면 조절).
// 모바일: 위 일정 줄 · 「장면」 동그란 버튼(누르면 조절 패널) · 아래 시트(수업) + 기능 막대.

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { sortCoursesByCategory } from '../../lib/courseSort'
import s from './castle.module.css'

const CastleJellyScene = dynamic(() => import('../../components/castle/CastleJellyScene'), { ssr: false })

const CAT = {
  drawing:   { name: '드로잉',     dot: '#f4a9c0' },
  painting:  { name: '페인팅',     dot: '#b49ae8' },
  sculpture: { name: '조소',       dot: '#8fb8f0' },
  oneday:    { name: '원데이 체험', dot: '#ffd27a' },
  free:      { name: '자율창작',   dot: '#9be3c4' },
  meeting:   { name: '작가 모임',   dot: '#c9a58e' },
}
const FLAVOUR_LIST = [['glacier', '빙하', '#8fd3ea'], ['rose', '로즈', '#f4b6cb'], ['lilac', '라일락', '#cdbcf3']]
const PICK_LINK = {
  tower:   { label: '탑 · 수업 소개 →',  href: '/student/curriculum' },
  gate:    { label: '성문 · 예약하기 →', href: '/student/calendar' },
  ship:    { label: '배 · 라운지 →',     href: '/lounge' },
  brazier: { label: '화로 · 냥밭 →',     href: '/student/farm' },
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Icon({ d }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
}
const DOCK = [
  { href: '/student', label: '홈', icon: <path d="M4 11l8-7 8 7v9H4z" /> },
  { href: '/student/records', label: '기록', icon: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6" /></> },
  { href: '/student/farm', label: '냥밭', icon: <path d="M12 20V10M12 10c0-4 3-6 6-6 0 4-3 6-6 6zM12 13c0-3-2-5-5-5 0 3 2 5 5 5z" /> },
  { href: '/lounge', label: '라운지', icon: <path d="M5 6h14v9H9l-4 3z" /> },
  { href: '/student/notification', label: '알림', icon: <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20h4" /> },
  { href: '/student/settings', label: '설정', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></> },
]

export default function CastlePage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [courses, setCourses] = useState([])
  const [bookings, setBookings] = useState([])
  const [ticket, setTicket] = useState(null)
  const [look, setLook] = useState({ timeOfDay: 0.15, flow: 0.6, firmness: 0.45, damping: 0.5, flavour: 'glacier' })
  const settingsRef = useRef(look)
  settingsRef.current = look
  const commandRef = useRef(null)
  const [pick, setPick] = useState(null)
  const [sceneOpen, setSceneOpen] = useState(false)
  const [bridgeUp, setBridgeUp] = useState(false)

  // 관리자만 — 숨긴 미리보기
  useEffect(() => {
    // 로컬 개발에서만: ?dev=1 이면 로그인 없이 장면을 본다(배포 빌드에선 이 분기가 없다)
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('dev') === '1') { setAllowed(true); return }
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data?.user
      if (!u) { router.replace('/login'); return }
      if (u.user_metadata?.role !== 'admin') { router.replace('/student'); return }
      setAllowed(true)
      const today = ymd(new Date())
      const [{ data: cs }, { data: bs }, { data: tk }] = await Promise.all([
        supabase.from('class_courses').select('id, name, category').eq('is_active', true),
        supabase.from('bookings').select('class_name, class_date, class_time, course_id, status').eq('user_id', u.id).neq('status', 'cancelled').gte('class_date', today).order('class_date'),
        supabase.from('tickets').select('remain, total, expires_at').eq('user_id', u.id).maybeSingle(),
      ])
      setCourses(sortCoursesByCategory(cs || []))
      setBookings(bs || [])
      setTicket(tk || null)
    })
  }, [])

  // 이번 주(오늘부터 7일)
  const week = useMemo(() => {
    const out = []
    const base = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i)
      const key = ymd(d)
      const b = bookings.find(x => x.class_date === key)
      const cat = b ? courses.find(c => c.id === b.course_id)?.category : null
      out.push({ key, dow: DOW[d.getDay()], num: d.getDate(), today: i === 0, dot: b ? (CAT[cat]?.dot || '#f4a9c0') : 'transparent' })
    }
    return out
  }, [bookings, courses])

  // 수업 — 카테고리별 묶음(이름이 같은 수업은 하나로)
  const groups = useMemo(() => {
    const g = []
    for (const c of courses) {
      const cat = c.category || 'etc'
      let grp = g.find(x => x.cat === cat)
      if (!grp) { grp = { cat, names: [] }; g.push(grp) }
      if (!grp.names.includes(c.name)) grp.names.push(c.name)
    }
    return g
  }, [courses])

  const next = bookings[0]
  const night = look.timeOfDay > 0.7
  const setL = patch => setLook(prev => ({ ...prev, ...patch }))

  if (!allowed) return <div className={s.root} />

  return (
    <div className={`${s.root} ${night ? s.night : ''}`}>
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap" />
      <CastleJellyScene settingsRef={settingsRef} commandRef={commandRef}
        onPick={(kind, x, y) => setPick(PICK_LINK[kind] ? { ...PICK_LINK[kind], x, y } : null)} />

      <div className={s.badge}>개발 중 미리보기 · 관리자에게만 보여요</div>

      <div className={s.mast}>
        <div className={s.mastTitle}>Castle<br />Jelly.</div>
        <div className={s.mastSub}>2호선 스튜디오 · 화실</div>
      </div>

      {/* 위 — 이번 주 일정 */}
      <section className={`${s.week} ${s.glass}`} aria-label="이번 주 일정">
        <div className={s.weekHead}><span>이번 주 일정</span><a href="/student/calendar">달력 전체 보기 →</a></div>
        <div className={s.days}>
          {week.map(d => (
            <a key={d.key} href={`/student/calendar?date=${d.key}`} className={`${s.day} ${d.today ? s.today : ''}`}>
              <span className={s.dayDow}>{d.today ? '오늘' : d.dow}</span>
              <span className={s.dayNum}>{d.num}</span>
              <span className={s.dot} style={{ background: d.dot }} />
            </a>
          ))}
        </div>
      </section>

      {/* 왼쪽(모바일 = 아래 시트) — 수업 */}
      <nav className={`${s.left} ${s.glass}`} aria-label="수업">
        <div className={s.sheetHandle} />
        <div className={s.sectionLabel}>수업</div>
        {groups.length === 0 && <div className={s.muted} style={{ padding: '6px 8px' }}>열린 수업을 불러오는 중…</div>}
        {groups.map(g => (
          <div key={g.cat}>
            <div className={s.cat}><span className={s.catDot} style={{ background: CAT[g.cat]?.dot || '#ccc' }} />{CAT[g.cat]?.name || g.cat}</div>
            {g.names.map(n => <a key={n} className={s.course} href={`/student/curriculum?course=${encodeURIComponent(n)}`}>{n}</a>)}
          </div>
        ))}
      </nav>

      {/* 오른쪽 — 오늘 + 장면 (모바일: 「장면」 버튼으로 펼침) */}
      <button className={`${s.sceneBtn} ${s.glass}`} aria-label={sceneOpen ? '장면 조절 닫기' : '장면 조절 열기'} aria-expanded={sceneOpen} onClick={() => setSceneOpen(v => !v)}>
        <Icon d={<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>} />
      </button>
      <aside className={`${s.right} ${s.glass} ${sceneOpen ? s.rightOpen : ''}`} aria-label="오늘과 장면 조절">
        <div className={s.todayBlock}>
          <div className={s.sectionLabel} style={{ padding: 0 }}>다음 수업</div>
          {next ? (<>
            <div className={s.todayTitle}>{next.class_name}</div>
            <div className={s.muted}>{next.class_date} · {next.class_time}</div>
          </>) : <div className={s.muted}>예약한 수업이 없어요</div>}
          {ticket && <div className={s.muted}>수강권 {ticket.remain}/{ticket.total}회 남음</div>}
          <a className={s.primary} href="/student/calendar">수업 예약하기</a>
          <div className={s.hr} style={{ marginTop: 6 }} />
        </div>
        <div className={s.sectionLabel} style={{ padding: 0 }}>장면</div>
        <label className={s.slider}>낮 · 노을 · 밤
          <input type="range" min="0" max="1" step="0.01" value={look.timeOfDay} onChange={e => setL({ timeOfDay: +e.target.value })} style={{ accentColor: '#b49ae8' }} />
        </label>
        <label className={s.slider}>폭포 세기
          <input type="range" min="0" max="1" step="0.01" value={look.flow} onChange={e => setL({ flow: +e.target.value })} style={{ accentColor: '#8fb8f0' }} />
        </label>
        <label className={s.slider}>젤리 단단함
          <input type="range" min="0" max="1" step="0.01" value={look.firmness} onChange={e => setL({ firmness: +e.target.value })} style={{ accentColor: '#f08fb3' }} />
        </label>
        <label className={s.slider}>물결 잦아듦
          <input type="range" min="0" max="1" step="0.01" value={look.damping} onChange={e => setL({ damping: +e.target.value })} style={{ accentColor: '#9be3c4' }} />
        </label>
        <div className={s.row}>
          {FLAVOUR_LIST.map(([id, label, c]) => (
            <button key={id} className={`${s.chip} ${s.glass} ${look.flavour === id ? s.chipOn : ''}`} aria-pressed={look.flavour === id}
              onClick={() => setL({ flavour: id })}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
        <div className={s.row}>
          <button className={`${s.chip} ${s.glass}`} onClick={() => commandRef.current?.fireworks()}>불꽃놀이</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => setBridgeUp(commandRef.current?.toggleBridge() ?? false)}>{bridgeUp ? '다리 내리기' : '다리 올리기'}</button>
          <button className={`${s.chip} ${s.glass}`} onClick={() => commandRef.current?.tip()}>흔들기</button>
        </div>
      </aside>

      {/* 누른 곳 → 들어가기 */}
      {pick && (
        <a className={s.pick} href={pick.href} style={{ left: pick.x, top: pick.y }} onClick={() => setPick(null)}>{pick.label}</a>
      )}

      {/* 아래 — 기타 기능 */}
      <nav className={`${s.dock} ${s.glass}`} aria-label="기타 기능">
        {DOCK.map(d => <a key={d.href} href={d.href} className={`${s.dockItem} ${s.glass}`}><Icon d={d.icon} />{d.label}</a>)}
      </nav>

      <div className={s.howto}><b>How to play</b> — 탑·성문·배·화로를 눌러 들어가기 · 물을 끌어 물결 · 끌어서 돌려 보기</div>
    </div>
  )
}
