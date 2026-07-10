'use client'
import { useState, useEffect } from 'react'

// 현재 적용 테마가 'fresh'(싱그러운 여름 글래스 스킨)인지 반환.
// html[data-theme]를 관찰 — applyTheme가 기간을 반영해 설정하므로 9월엔 자동으로 false.
export function useFreshTheme() {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    const check = () => setFresh(document.documentElement.getAttribute('data-theme') === 'fresh')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return fresh
}
