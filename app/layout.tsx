import './globals.css'

export const metadata = {
  title: '2호선 스튜디오',
  description: '2호선 스튜디오 수업 예약 시스템',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          {children}
        </div>
      </body>
    </html>
  )
}