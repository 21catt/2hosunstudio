'use client'
// 비가입자가 개인 화면(기록·알림·자율창작·냥밭)에 들어왔을 때 — 무엇을 하는 곳인지 + 가입 후 수업 신청 안내.
// 다른 회원의 기록은 하나도 불러오지 않는다. 3D 모양이면 CastleHero + castle-sheet 로 다른 화면과 같은 유리 시트에 놓인다.
import CastleHero from './castle/CastleHero'
import StudentNav from './StudentNav'

const GUIDE = {
  records:      { hero: 'Records', name: '기록', icon: '📸', desc: '오늘 수업의 결과를 사진으로 찍고 기록하는 공간이에요.', more: '그날 그린 그림과 선생님의 피드백이 날짜별로 차곡차곡 쌓여요.' },
  notification: { hero: 'Notice', name: '알림', icon: '🔔', desc: '예약 확정, 수업 소식, 선생님의 피드백이 도착하는 곳이에요.', more: '' },
  free:         { hero: 'Free Studio', name: '자율창작', icon: '🎨', desc: '수업이 없는 시간에 화실을 빌려 혼자 작업하고 기록하는 공간이에요.', more: '' },
  farm:         { hero: 'Farm', name: '냥밭', icon: '🌱', desc: '수업에 출석할수록 작물이 자라는 나만의 밭이에요.', more: '' },
}

export default function GuestGuide({ kind }) {
  const g = GUIDE[kind] || GUIDE.records
  const btn = { display: 'block', textAlign: 'center', padding: '13px 16px', borderRadius: 14, fontSize: 14, fontWeight: 700, textDecoration: 'none' }
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 90 }}>
      <CastleHero title={g.hero} />
      <div className="castle-sheet" style={{ padding: '18px 16px 40px', minHeight: '70vh' }}>
        <div style={{ maxWidth: 420, margin: '24px auto 0', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">{g.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{g.name}</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{g.desc}</p>
          {g.more && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.7 }}>{g.more}</p>}
          <div style={{ margin: '6px 0 0', padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.06)', fontSize: 13.5, lineHeight: 1.6 }}>
            사용하려면 <b>가입한 뒤 수업을 신청</b>해 주세요.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <a href="/signup" style={{ ...btn, background: '#2b2433', color: '#fff' }}>가입하기</a>
            <a href="/student/calendar" style={{ ...btn, background: 'rgba(255,255,255,0.75)', color: '#2b2433', border: '1px solid rgba(0,0,0,0.08)' }}>수업 둘러보고 신청하기</a>
            <a href="/login" style={{ fontSize: 12.5, color: 'inherit', opacity: 0.7, marginTop: 4 }}>이미 회원이에요 · 로그인</a>
          </div>
        </div>
      </div>
      <StudentNav active={kind === 'notification' ? 'notification' : kind} />
    </div>
  )
}
