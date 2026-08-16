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

// 현재 적용 테마가 'glass'(글라스 민트 서리 유리)인지 반환 — {glass && <GlassMintBg/>} 마운트용.
export function useGlassTheme() {
  const [glass, setGlass] = useState(false)
  useEffect(() => {
    const check = () => setGlass(document.documentElement.getAttribute('data-theme') === 'glass')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return glass
}

// 현재 적용 테마가 'liquid'(리퀴드 글라스)인지 반환 — {liquid && <LiquidGlassBg/>} 마운트용.
export function useLiquidTheme() {
  const [liquid, setLiquid] = useState(false)
  useEffect(() => {
    const check = () => setLiquid(document.documentElement.getAttribute('data-theme') === 'liquid')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return liquid
}

// 현재 적용 테마가 'space'(울트라 스페이스 다크 스킨)인지 반환 — {space && <SpaceBg/>} 마운트용.
export function useSpaceTheme() {
  const [space, setSpace] = useState(false)
  useEffect(() => {
    const check = () => setSpace(document.documentElement.getAttribute('data-theme') === 'space')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return space
}
