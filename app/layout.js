import './globals.css'
import PaletteFab from '../components/PaletteFab'
import GlassMintLayer from '../components/GlassMintLayer'
import { GUEST_THEME, THEME_WINDOWS } from '../lib/theme'

export const viewport = {
  themeColor: '#2B2FD4',
}

export const metadata = {
  title: '2호선 스튜디오',
  description: '2호선 스튜디오 수업 예약 시스템',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '2호선 스튜디오',
  },
  icons: {
    icon: '/icon-192.png?v=2',
    apple: '/icon-192.png?v=2',
  },
}

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: 인라인 스크립트가 하이드레이션 전에 data-theme를 설정하므로 html 속성 불일치는 의도된 것
    <html lang="ko" suppressHydrationWarning>
      <body>
        {/* 저장된 테마를 첫 페인트 전에 적용 (기본 'ultra'는 속성 없음).
            테마를 고른 적 없고 로그인 흔적도 없는 방문자 = 비가입자 → 싱그러운으로 맞이한다.
            ⚠️ 저장하지 않는다(저장하면 로그인 뒤 계정 테마가 안 먹는다).
            기간은 THEME_WINDOWS 한 곳에서 심어 준다 — 날짜를 여기에 또 적으면 진실이 둘이 된다. */}
        <script dangerouslySetInnerHTML={{ __html:
          `try{var t=localStorage.getItem('2hs_theme');
if(t&&t!=='ultra'){document.documentElement.setAttribute('data-theme',t)}
else if(!t){var si=false;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('sb-')===0&&k.indexOf('auth-token')>0){si=true;break}}
var g=${JSON.stringify(GUEST_THEME)},f=${JSON.stringify((THEME_WINDOWS[GUEST_THEME] || {}).from || '')},u=${JSON.stringify((THEME_WINDOWS[GUEST_THEME] || {}).until || '')};
var d=new Date(),p2=function(n){return (n<10?'0':'')+n},today=d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
if(!si&&(!f||today>=f)&&(!u||today<=u))document.documentElement.setAttribute('data-theme',g)}}catch(e){}`
        }} />
        {/* 글라스 민트 테마일 때만 뒤에 깔리는 앰비언트 배경(전 페이지 공통) */}
        <GlassMintLayer />
        <div className="app-shell">
          {children}
          <PaletteFab />
        </div>
      </body>
    </html>
  )
}