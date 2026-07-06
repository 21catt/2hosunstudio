'use client'
import { useState, useEffect } from 'react'

const ICONS = {
  0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌦',
  61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '🌨', 75: '🌨',
  77: '🌨',
  80: '🌦', 81: '🌧', 82: '⛈',
  85: '🌨', 86: '🌨',
  95: '⛈', 96: '⛈', 99: '⛈',
}

export function useTodayWeather() {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,weather_code&timezone=Asia/Seoul')
      .then(r => r.json())
      .then(d => setWeather(d.current))
      .catch(() => {})
  }, [])
  return weather ? { icon: ICONS[weather.weather_code] || '🌤', temp: Math.round(weather.temperature_2m), code: weather.weather_code } : null
}

// 오늘 날씨 — 하단 내비와 같은 라인아트 톤(아웃라인 SVG). open-meteo weather_code 기준.
export function weatherGlyph(code) {
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

export function WeatherGlyph({ code, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {weatherGlyph(code)}
    </svg>
  )
}