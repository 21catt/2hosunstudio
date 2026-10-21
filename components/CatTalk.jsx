'use client'
// 냥이 말풍선 — 젤리성 홈(/castle)·3D 냥밭(/castle/farm) 공용 (2026-10-21, 규칙 = lib/catTalk)
//   · 들어오면 첫 말(인사)이 뜬다. 냥이 얼굴을 누르면 다음 말 · ✕ = 이번 방문 동안 닫기(얼굴은 남는다 — 누르면 다시)
//   · 물어보는 말은 하루 한 번까지 — 답을 고르면 냥이가 대답하고, 답은 내 계정에 남아 선생님 화면에서 보인다
//   · 수업 이야기에 쓰는 기록(이름·강사 「다음에 진행할 것」·마지막 출석)은 여기서 직접 읽는다 — 화면마다 따로 안 불러도 되게
//   · 소리 = 반응 소리(JellySfx)를 따른다(끄면 조용)

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildCatLines, replyFor, saveCatAnswer, answeredOn, ymdOf } from '../lib/catTalk'
import s from './CatTalk.module.css'

// place: 'castle' | 'farm' · user: auth 사용자(없으면 손님) · cat: { name, img } · nextBooking · farm
export default function CatTalk({ place, user, cat, nextBooking = null, farm = null }) {
  const [extra, setExtra] = useState(null) // { name, nextPlan, lastAttended }
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(true)
  const [reply, setReply] = useState(null) // 고른 답에 대한 냥이 대답
  const [answeredToday, setAnsweredToday] = useState(false)

  useEffect(() => {
    if (!user) { setExtra({}); return }
    let dead = false
    setAnsweredToday(answeredOn(user.user_metadata?.cat_answers, ymdOf(new Date())))
    ;(async () => {
      const [{ data: me }, { data: last }, { data: recs }] = await Promise.all([
        supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
        supabase.from('bookings').select('class_date').eq('user_id', user.id).eq('attended', true).order('class_date', { ascending: false }).limit(1),
        supabase.from('class_records').select('id, class_date, class_name').eq('user_id', user.id).order('class_date', { ascending: false }).limit(20),
      ])
      let nextPlan = null
      if (recs?.length) {
        // 학생 홈 「다음 시간엔」과 같은 규칙 — 가장 최근 것, 그 수업을 다시 들어 기록이 생기면 내려간다
        const { data: fbs, error } = await supabase.from('class_record_feedback').select('next_plan, record_id, created_at')
          .in('record_id', recs.map(r => r.id)).not('next_plan', 'is', null).order('created_at', { ascending: false }).limit(5)
        if (!error) for (const fb of fbs || []) {
          const rec = recs.find(r => r.id === fb.record_id), text = String(fb.next_plan || '').trim()
          if (!rec || !text) continue
          if (recs.some(r => r.id !== rec.id && r.class_date > rec.class_date && (r.class_name || '') === (rec.class_name || ''))) continue
          nextPlan = text; break
        }
      }
      // 성만 쓰지 않고 이름 그대로(본인에게 하는 말) — 성+이름이면 이름만 부르면 더 다정하지만 외자·외국 이름이 있어 그대로 둔다
      if (!dead) setExtra({ name: me?.name || '', nextPlan, lastAttended: last?.[0]?.class_date || null })
    })().catch(() => { if (!dead) setExtra({}) })
    return () => { dead = true }
  }, [user])

  const lines = useMemo(() => !extra ? [] : buildCatLines({
    place, loggedIn: !!user, now: new Date(), name: extra.name, nextPlan: extra.nextPlan, lastAttended: extra.lastAttended,
    nextBooking, farm, answeredToday,
  }), [extra, place, user, nextBooking, farm, answeredToday])

  // 첫 말이 뜰 때 작은 소리 한 번
  useEffect(() => { if (lines.length) window.JellySfx?.play('chime', { s: 0.35, pitch: 1.4 }) }, [lines.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cat?.img || !lines.length) return null
  const line = lines[i % lines.length]

  function next() {
    setReply(null)
    if (!open) { setOpen(true); return }
    setI(n => n + 1)
    window.JellySfx?.play('pop', { s: 0.5 })
  }
  async function answer(a) {
    setReply(replyFor(a))
    window.JellySfx?.play('chime', { s: 0.5 })
    const ok = await saveCatAnswer(supabase, { question: line.q, answer: a, place })
    if (ok) setAnsweredToday(true) // 다음 바퀴부터 질문이 빠진다(지금 대답은 그대로 보인다)
  }

  return (
    <div className={`${s.wrap} ${place === 'farm' ? s.farm : s.castle}`}>
      {open && (
        <div className={s.bubble} role="status" aria-live="polite" key={`${i}-${reply ? 'r' : ''}`}>
          <div className={s.who}>
            <span>{cat.name}</span>
            <button className={s.close} onClick={() => setOpen(false)} aria-label="말풍선 닫기" data-no-tap>✕</button>
          </div>
          <div className={s.text}>{reply || line.text}</div>
          {line.q && !reply && (
            <div className={s.chips}>
              {line.q.options.map(o => <button key={o} onClick={() => answer(o)}>{o}</button>)}
            </div>
          )}
          {line.q && !reply && <div className={s.note}>고른 답은 선생님도 볼 수 있어요</div>}
        </div>
      )}
      <button className={s.cat} onClick={next} aria-label={open ? `${cat.name} — 다음 말 듣기` : `${cat.name} 말풍선 열기`}>
        <img src={cat.img} alt="" draggable={false} />
      </button>
    </div>
  )
}
