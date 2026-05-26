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
  return weather ? { icon: ICONS[weather.weather_code] || '🌤', temp: Math.round(weather.temperature_2m) } : null
}