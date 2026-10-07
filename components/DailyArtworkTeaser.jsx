'use client'

// 오늘의 그림 — 하단에 작게 뜨는 띠(A안: 디테일 띠) → 누르면 상세 시트.
//
// 계약 넷:
//  ① 작업을 막지 않는다 — 띠는 작고, × 로 그날 하루 닫힌다(기기별 localStorage, 계정·문서 무관).
//  ② 공지 팝업이 뜬 날은 양보한다(hasNotice) — 한 화면에 팝업 둘을 띄우지 않는다.
//  ③ 목록이 비거나 이미지가 안 열리면 **아무것도 안 뜬다**(깨진 아이콘 금지).
//  ④ 관리자 덮어쓰기 테이블이 아직 없어도 **고정 목록으로 그대로 돈다**(조용히 무시).
//
// ⚠️ 띠의 작은 사각형은 그림 전체가 아니라 **디테일 한 조각**이다(background-size 420%).
//    알아보기 어려워야 눌러 본다 — 전체 썸네일로 바꾸면 이 기능의 이유가 사라진다.

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getDailyArtwork, getRecentArtworks, mergeOverride, ymd, koDate } from '../lib/dailyArtwork'
import { activePopupNotice, noticeDismissed } from '../lib/notices'

const MONO = "'Space Mono', ui-monospace, monospace"
const hideKey = d => `2hs_art_hide_${d}`

// 노트의 **강조** 를 굵게. (dangerouslySetInnerHTML 안 쓴다 — 관리자 입력이 들어올 자리라서.)
function Note({ text, color }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g)
  return (
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.72, color, letterSpacing: '-0.2px' }}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <b key={i} style={{ fontWeight: 800, color: 'var(--ac)' }}>{p.slice(2, -2)}</b>
          : <span key={i}>{p}</span>
      )}
    </p>
  )
}

export default function DailyArtworkTeaser({ bottom = 68 }) {
  const [art, setArt] = useState(null)      // 오늘 보여 줄 작품
  const [shown, setShown] = useState(false) // 띠 표시
  const [open, setOpen] = useState(false)   // 상세 시트
  const [detail, setDetail] = useState(null)// 시트가 보여 주는 작품(지난 그림 클릭 시 교체)
  const [today, setToday] = useState('')
  const [past, setPast] = useState([])

  useEffect(() => {
    const now = new Date()
    const t = ymd(now)
    setToday(t)
    setPast(getRecentArtworks(now, 6))

    const base = getDailyArtwork(now)
    let alive = true

    // 닫은 날이면 아예 안 뜬다.
    let hidden = false
    try { hidden = localStorage.getItem(hideKey(t)) === '1' } catch {}

    // ⚠️ 공지 판정은 공지 코드에 묻는다(여기서 다시 쓰면 둘이 갈린다).
    //    공지가 떠 있는 날은 띠가 양보한다 — 한 화면에 팝업 둘은 안 띄운다.
    const n = activePopupNotice(t)
    if (n && !noticeDismissed(n.id)) hidden = true

    const show = a => {
      if (!alive || !a?.image) return
      setArt(a)
      if (!hidden) {
        // 공지보다 한 박자 늦게 — 화면이 한꺼번에 덮이지 않게.
        setTimeout(() => { if (alive) setShown(true) }, 900)
      }
    }

    // 관리자 덮어쓰기. 테이블이 없거나 실패하면 고정 목록 그대로.
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('daily_artworks').select('*').eq('on_date', t).maybeSingle()
        if (!alive) return
        if (error || !data || data.enabled === false) return show(base)
        show(mergeOverride(base, data) || base)
      } catch { show(base) }
    })()

    return () => { alive = false }
  }, [])

  const openSheet = useCallback(() => { setDetail(art); setOpen(true) }, [art])

  const close = useCallback(() => setOpen(false), [])

  // 시트는 Esc 로 닫힌다(모달 관례). 열려 있을 때만 듣는다.
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const dismiss = useCallback(e => {
    e.stopPropagation()
    try { localStorage.setItem(hideKey(today), '1') } catch {}
    setShown(false)
  }, [today])

  if (!art) return null

  const d = detail || art

  return (
    <>
      {shown && !open && (
        <div
          onClick={openSheet}
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openSheet() }}
          style={{
            position: 'fixed', left: 14, right: 14, bottom, zIndex: 1180,
            maxWidth: 420, margin: '0 auto', height: 62, borderRadius: 16,
            background: 'rgba(255,255,255,0.84)',
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.92)',
            boxShadow: '0 10px 30px rgba(20,24,40,0.18)',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px 8px 8px', cursor: 'pointer',
            animation: 'artIn .5s cubic-bezier(.2,.9,.3,1) both',
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 12, flex: 'none',
            backgroundImage: `url(${art.image})`,
            backgroundSize: '420%', backgroundPosition: art.crop || '50% 50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '1.6px', color: 'var(--ac)', fontWeight: 700 }}>
              TODAY&apos;S PAINTING
            </div>
            <div style={{
              fontSize: 12.5, fontWeight: 800, color: '#17181f', letterSpacing: '-0.3px', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{art.tease || art.titleKo}</div>
          </div>
          <div style={{ fontSize: 16, color: 'var(--tl)', flex: 'none' }}>›</div>
          <button
            onClick={dismiss} aria-label="오늘은 닫기"
            style={{
              position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 11,
              border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#9aa0ad',
              fontSize: 12, lineHeight: 1, cursor: 'pointer', padding: 0,
              boxShadow: '0 2px 6px rgba(20,24,40,0.16)',
            }}
          >×</button>
        </div>
      )}

      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 1260,
            background: 'rgba(14,16,24,0.62)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'artFade .22s ease both',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
              background: 'var(--card, #fff)', borderRadius: '24px 24px 0 0',
              animation: 'artUp .34s cubic-bezier(.2,.9,.3,1) both',
              paddingBottom: 22,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--line, #e6e8ee)' }} />
            </div>

            <div style={{ padding: '4px 18px 0' }}>
              <img
                src={d.image} alt={d.titleKo || d.title}
                style={{ width: '100%', borderRadius: 14, display: 'block', background: '#f3f4f7' }}
              />
            </div>

            <div style={{ padding: '16px 20px 0' }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '1.5px', color: 'var(--ac)', fontWeight: 700 }}>
                오늘의 그림 · {koDate(d._on || today)}
              </div>
              <h3 style={{
                margin: '7px 0 4px', fontSize: 20, fontWeight: 900,
                letterSpacing: '-0.6px', color: 'var(--td)', lineHeight: 1.3,
              }}>{d.titleKo || d.title}</h3>
              <div style={{ fontSize: 12.5, color: 'var(--tmu)' }}>
                {d.artistKo || d.artist}{d.bio ? ` · ${d.bio}` : ''}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 13 }}>
                {[d.year, d.medium].filter(Boolean).map((t, i) => (
                  <span key={i} style={{
                    fontFamily: MONO, fontSize: 10, letterSpacing: '0.4px', color: 'var(--tm)',
                    border: '1px solid var(--line, #e6e8ee)', borderRadius: 7, padding: '4px 8px',
                  }}>{t}</span>
                ))}
              </div>

              <div style={{ height: 1, background: 'var(--line, #e6e8ee)', margin: '16px 0 14px' }} />

              <Note text={d.note} color="var(--tm)" />

              <div style={{ fontSize: 10.5, color: 'var(--tl)', marginTop: 14, lineHeight: 1.6 }}>
                퍼블릭 도메인 · 메트로폴리탄 미술관 공개 소장품(CC0)
                {d.source && <>{' · '}<a href={d.source} target="_blank" rel="noreferrer" style={{ color: 'var(--tl)' }}>원본 보기</a></>}
              </div>
            </div>

            {past.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{
                  padding: '0 20px 8px', fontFamily: MONO, fontSize: 9,
                  letterSpacing: '1.4px', color: 'var(--tl)', fontWeight: 700,
                }}>지난 그림</div>
                <div style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '0 20px 4px' }}>
                  {past.map(p => (
                    <button
                      key={p.id + p._on} onClick={() => setDetail(p)}
                      style={{
                        flex: 'none', width: 86, height: 86, borderRadius: 11, padding: 0,
                        border: d.id === p.id ? '2px solid var(--ac)' : '1px solid var(--line, #e6e8ee)',
                        backgroundImage: `url(${p.image})`, backgroundSize: 'cover',
                        backgroundPosition: 'center', cursor: 'pointer',
                      }}
                      aria-label={p.titleKo}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '18px 20px 0' }}>
              <button
                onClick={close}
                style={{
                  width: '100%', padding: '13px 18px', borderRadius: 11, border: 'none',
                  background: 'var(--td)', color: 'var(--page, #fff)',
                  fontSize: 13.5, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.2px',
                }}
              >닫기</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes artIn { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
        @keyframes artFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes artUp { from { transform: translateY(100%) } to { transform: none } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes artIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes artUp { from { opacity: 0 } to { opacity: 1 } }
        }
      `}</style>
    </>
  )
}
