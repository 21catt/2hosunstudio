'use client'
// 메인 화면 고르기 — 3D 홈 · 예전 홈(왁뿌는 3D 홈의 배경 장면 — 홈 「장면」 패널에서). 고르면 그 기기에 기억(2hs_home_mode)하고 그 홈으로 간다.
//   · sheet = 아래에서 올라오는 시트(왁뿌 홈 「메인 화면」) · 아니면 설정 화면 안 카드 줄
import { useEffect, useState } from 'react'
import { HOME_MODES, currentHomeKey, setHomeMode } from '../../lib/useCastleSkin'
import s from './wax.module.css'

const ICON = { castle: '🏰', classic: '🗂️' }

export default function HomeModePicker({ onClose, sheet = false }) {
  const [cur, setCur] = useState('castle')
  useEffect(() => { setCur(currentHomeKey()) }, [])

  function pick(m) {
    setHomeMode(m.key)
    setCur(m.key)
    window.location.assign(m.href)
  }

  const list = (
    <div className={s.modeList}>
      {HOME_MODES.map(m => (
        <button key={m.key} className={`${s.modeCard} ${cur === m.key ? s.modeOn : ''}`} onClick={() => pick(m)} aria-pressed={cur === m.key}>
          <span className={s.modeIcon} aria-hidden="true">{ICON[m.key]}</span>
          <span className={s.modeText}><b>{m.name}</b><small>{m.desc}</small></span>
          {cur === m.key && <span className={s.modeUse}>사용 중</span>}
        </button>
      ))}
    </div>
  )

  if (!sheet) return list
  return (
    <div className={s.sheetBack} onClick={onClose}>
      <div className={s.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label="메인 화면 고르기">
        <div className={s.sheetHead}>
          <b>메인 화면 고르기</b>
          <button className={s.pill} onClick={onClose} aria-label="닫기">✕</button>
        </div>
        {list}
      </div>
    </div>
  )
}
