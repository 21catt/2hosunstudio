'use client'
import { useGlassTheme } from '../lib/useFreshTheme'
import GlassMintBg from './GlassMintBg'

// 글라스 민트 배경을 앱 전체에 한 번만 마운트한다(layout.js).
// SpaceBg 처럼 페이지마다 붙이면 19곳을 손대야 하고 새 페이지에서 빠지기 쉽다.
export default function GlassMintLayer() {
  const glass = useGlassTheme()
  return glass ? <GlassMintBg /> : null
}
