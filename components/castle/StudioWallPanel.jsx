'use client'
// 우리 스튜디오 장면 패널의 「내 그림 벽」 — 규칙은 lib/studioWall, 그리기는 public/studio-tour.
// 보내는 값 = { cmd: 'wall', images: [칸마다 주소 또는 null] }
import { useEffect, useMemo, useState } from 'react'
import { WALL_SLOTS, resolveWall, nextPins, fetchMyPhotos, signPaths, savePins } from '../../lib/studioWall'
import s from '../../app/castle/castle.module.css'

// 개발 서버 ?dev=1 은 로그인이 없어 예시 그림으로 확인한다(저장 안 함)
const DEV_PHOTOS = ['frog', 'duck', 'card', 'ref2', 'house', 'pc1'].map(n => `/studio-tour/art/${n}.jpg`)

export default function StudioWallPanel({ user, send, frameTick, dev }) {
  const [photos, setPhotos] = useState([])
  const [urls, setUrls] = useState({})
  const [pins, setPins] = useState({})
  const [slot, setSlot] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let off = false
    ;(async () => {
      if (!user) {
        if (dev) { setPhotos(DEV_PHOTOS); setUrls(Object.fromEntries(DEV_PHOTOS.map(p => [p, p]))) }
        return
      }
      setPins(user.user_metadata?.studio_wall || {})
      const paths = await fetchMyPhotos(user.id)
      const signed = await signPaths(paths)
      if (!off) { setPhotos(paths.filter(p => signed[p])); setUrls(signed) }
    })().catch(() => {})
    return () => { off = true }
  }, [user, dev])

  const wall = useMemo(() => resolveWall(photos, pins), [photos, pins])
  useEffect(() => { if (frameTick) send({ cmd: 'wall', images: wall.map(w => (w ? urls[w.path] : null)) }) }, [wall, urls, frameTick]) // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(path) {
    const n = nextPins(pins, slot, path), before = pins
    setPins(n); setSlot(null); setErr('')
    if (!user) return
    setSaving(true)
    const { error } = await savePins(n)
    setSaving(false)
    if (error) { setPins(before); setErr('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.') }
  }

  if (!user && !dev) return <div className={s.muted}>로그인하면 내 수업 기록 그림이 벽에 걸려요</div>
  if (!photos.length) return <div className={s.muted}>수업 기록에 사진을 올리면 벽에 걸려요</div>
  return (<>
    <div className={s.sectionLabel} style={{ padding: 0 }}>내 그림 벽</div>
    <div className={s.muted}>최근 기록이 자동으로 걸려요. 칸을 골라 바꾸면 그 그림은 새 기록이 올라와도 그대로예요.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
      {wall.map((w, i) => (
        <button key={i} aria-label={`${WALL_SLOTS[i]} ${w?.pinned ? '고정됨' : '자동'} · 바꾸기`} aria-pressed={slot === i} onClick={() => setSlot(slot === i ? null : i)}
          style={{ position: 'relative', aspectRatio: '1', minHeight: 44, padding: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'rgba(255,255,255,.6)', border: slot === i ? '2px solid #6f5bd6' : '1px solid rgba(255,255,255,.8)' }}>
          {w && <img src={urls[w.path]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          {w?.pinned && <span style={{ position: 'absolute', right: 2, top: 2, width: 15, height: 15, borderRadius: 8, background: '#6f5bd6', color: '#fff', fontSize: 9, fontWeight: 800, lineHeight: '15px' }}>고</span>}
        </button>
      ))}
    </div>
    {slot !== null && (<>
      <div className={s.muted}>{WALL_SLOTS[slot]}에 걸 그림을 골라 주세요</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6, maxHeight: 170, overflowY: 'auto' }}>
        {photos.map(p => (
          <button key={p} aria-label="이 그림 걸기" disabled={saving} onClick={() => pick(p)} style={{ aspectRatio: '1', minHeight: 44, padding: 0, border: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer' }}>
            <img src={urls[p]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      {pins[slot] && <button className={`${s.chip} ${s.glass}`} disabled={saving} onClick={() => pick(null)}>최근 기록으로 되돌리기</button>}
    </>)}
    {err && <div className={s.muted}>{err}</div>}
  </>)
}
