import './globals.css'
import PaletteFab from '../components/PaletteFab'

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
        {/* 저장된 테마를 첫 페인트 전에 적용 (기본 'ultra'는 속성 없음) */}
        <script dangerouslySetInnerHTML={{ __html:
          `try{var t=localStorage.getItem('2hs_theme');if(t&&t!=='ultra')document.documentElement.setAttribute('data-theme',t)}catch(e){}`
        }} />
        <div className="app-shell">
          {children}
          <PaletteFab />
        </div>
      </body>
    </html>
  )
}