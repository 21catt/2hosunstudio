'use client'
// 냥냥이(고등어 고양이) 약 먹이기 — 하루 한 번. 안 삼키고 뱉을 때가 있어서 다시 줘야 한다.
// 그림·동작 = public/studio-tour(cmd 'pill' → { scene: 'pill', result: 'ok' | 'spit' }), 기록 = 이 기기.
import { useEffect, useState } from 'react'
import s from '../../app/castle/castle.module.css'

const KEY = '2hs_nyang_pill', FED_KEY = '2hs_cat_fed'
const TOYS = [['feather', '깃털 낚싯대'], ['ball', '털실 공'], ['mouse', '쥐 인형']]
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

export default function NyangPill({ send, onPlay }) {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [spits, setSpits] = useState(0)
  const [fed, setFed] = useState(false)
  const [feeding, setFeeding] = useState(false)

  useEffect(() => { try { setDone(localStorage.getItem(KEY) === today()); setFed(localStorage.getItem(FED_KEY) === today()) } catch {} }, [])
  useEffect(() => {
    const on = e => {
      if (e.origin !== window.location.origin) return
      if (e.data?.scene === 'fed') { setFeeding(false); setFed(true); try { localStorage.setItem(FED_KEY, today()) } catch {} }
      if (e.data?.scene !== 'pill') return
      setBusy(false)
      if (e.data.result === 'ok') { setDone(true); setNote('꿀꺽! 오늘 약 다 먹었어요'); try { localStorage.setItem(KEY, today()) } catch {} }
      else { setSpits(n => n + 1); setNote('퉤! 뱉고 도망갔어요. 다시 줘 볼까요?') }
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])

  return (<>
    <div className={s.sectionLabel} style={{ padding: 0 }}>고양이들</div>
    <button className={`${s.chip} ${s.glass}`} disabled={fed || feeding} onClick={() => { setFeeding(true); send({ cmd: 'feed' }) }}>
      {fed ? '오늘 밥 먹었어요' : feeding ? '밥 먹는 중' : '밥 주기'}
    </button>
    <div className={s.sectionLabel} style={{ padding: 0 }}>감자랑 놀아주기</div>
    <div className={s.row} style={{ flexWrap: 'wrap' }}>
      {TOYS.map(([id, label]) => <button key={id} className={`${s.chip} ${s.glass}`} onClick={() => { send({ cmd: 'toy', kind: id }); onPlay?.() }}>{label}</button>)}
    </div>
    <div className={s.sectionLabel} style={{ padding: 0 }}>냥냥이</div>
    <button className={`${s.chip} ${s.glass}`} disabled={done || busy} onClick={() => { setBusy(true); setNote(''); send({ cmd: 'pill', spits }) }}>
      {done ? '오늘 약 먹었어요' : busy ? '냥냥이 부르는 중' : '약 먹이기'}
    </button>
    {note && <div className={s.muted}>{note}</div>}
  </>)
}
