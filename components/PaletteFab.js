'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PalettePlanner from './PalettePlanner'

// 색 계획(PIGMENT) 플로팅 버튼 — 로그인된 모든 화면(수강생·작가·강사)에 노란 팔레트 아이콘으로 떠 있고,
// 스크롤에 반응(내리면 오른쪽으로 살짝 숨고 흐려짐)한다. 탭하면 도구가 열리고, 저장하면 그날 기록에 남는다.
// 하단 입력바가 있는 화면(기록·라운지)·로그인 계열에서는 겹침/중복 방지로 숨긴다.
const HIDE = ['/login', '/signup', '/reset-password', '/student/records', '/lounge']

export default function PaletteFab() {
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tuck, setTuck] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => { if (mounted) setUser(data.user || null) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null))
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  // 스크롤 반응 — 내리면 tuck, 올리거나 멈추면 복귀
  useEffect(() => {
    if (open) return
    let last = window.scrollY, timer
    const onScroll = () => {
      const y = window.scrollY
      if (y > last + 6) setTuck(true)
      else if (y < last - 6) setTuck(false)
      last = y
      clearTimeout(timer); timer = setTimeout(() => setTuck(false), 650)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer) }
  }, [open])

  async function handleSave(blob, palette, note) {
    if (!user || saving) return
    setSaving(true)
    try {
      const n = new Date()
      const date = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
      const { data: rec } = await supabase.from('class_records').insert({ user_id: user.id, class_date: date, note: note || '🎨 색 계획' }).select().single()
      if (!rec) throw new Error('insert failed')
      const path = `${user.id}/${rec.id}/${Date.now()}_plan.png`
      const file = new File([blob], 'plan.png', { type: 'image/png' })
      const { error: upErr } = await supabase.storage.from('class-records').upload(path, file)
      if (upErr) throw upErr
      let { error: insErr } = await supabase.from('class_record_photos').insert({ record_id: rec.id, storage_path: path, palette })
      if (insErr) await supabase.from('class_record_photos').insert({ record_id: rec.id, storage_path: path })
      setOpen(false)
      setToast('색 계획이 기록에 저장됐어요 🐾')
    } catch {
      setToast('저장에 실패했어요 🐾')
    } finally {
      setSaving(false)
      setTimeout(() => setToast(''), 2600)
    }
  }

  if (!user || HIDE.includes(pathname)) return null

  return (
    <>
      <style>{`
        .pf-btn{ animation: pf-in .38s ease backwards; transition: transform .32s cubic-bezier(.22,1,.36,1), opacity .3s, box-shadow .2s, filter .15s }
        .pf-btn:active{ transform: scale(.85) !important }
        @media(hover:hover){ .pf-btn:hover{ filter: brightness(1.07) } }
        @keyframes pf-in{ from{ opacity:0 } to{ opacity:1 } }
        @keyframes pf-toast{ from{ opacity:0; transform: translate(-50%, 8px) } to{ opacity:1; transform: translate(-50%, 0) } }
      `}</style>

      <div style={{ position:'fixed', bottom:78, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:390, zIndex:90, pointerEvents:'none', display:'flex', justifyContent:'flex-end', padding:'0 16px', boxSizing:'border-box' }}>
        <button className="pf-btn" onClick={() => setOpen(true)} aria-label="색 계획 열기"
          style={{ pointerEvents:'auto', width:46, height:46, borderRadius:14, border:'none', cursor:'pointer', background:'#EDBA3B', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 20px -5px rgba(237,186,59,0.5), 0 2px 6px rgba(0,0,0,0.28)', padding:0,
            opacity: tuck ? 0.62 : 1, transform: tuck ? 'translateX(38px) scale(0.9)' : 'none' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21a9 9 0 0 1 0 -18a9 8 0 0 1 9 8a4.5 4 0 0 1 -4.5 4h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25"/>
            <circle cx="7.5" cy="10.5" r="1" fill="#fff" stroke="none"/>
            <circle cx="12" cy="7.5" r="1" fill="#fff" stroke="none"/>
            <circle cx="16.5" cy="10.5" r="1" fill="#fff" stroke="none"/>
          </svg>
        </button>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:150, left:'50%', transform:'translateX(-50%)', zIndex:1400, background:'rgba(20,16,26,0.92)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:600, fontSize:12.5, padding:'10px 16px', borderRadius:20, boxShadow:'0 6px 20px rgba(0,0,0,0.35)', animation:'pf-toast .25s ease', whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      {open && <PalettePlanner role={user?.user_metadata?.role} saving={saving} onClose={() => setOpen(false)} onSave={handleSave} />}
    </>
  )
}
