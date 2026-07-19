'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import PalettePlanner from './PalettePlanner'

// 색 계획(PIGMENT) 플로팅 버튼 — 로그인된 모든 화면(수강생·작가·강사)에 노란 팔레트 아이콘으로 떠 있고,
// 스크롤에 반응(내리면 오른쪽으로 살짝 숨고 흐려짐)한다. 탭하면 도구가 열리고, 저장하면 그날 기록에 남는다.
// 하단 입력바가 있는 화면(기록·라운지)·로그인 계열에서는 겹침/중복 방지로 숨긴다.
const HIDE = ['/login', '/signup', '/reset-password', '/student/records', '/lounge']

export default function PaletteFab() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tuck, setTuck] = useState(false)
  const [toast, setToast] = useState('')
  const [initial, setInitial] = useState(null) // 오늘의 색 등 외부에서 지정한 시작 팔레트

  // 홈 "오늘의 색" 카드 → 그 색으로 삼색 도구 열기 (저장은 아래 handleSave 경로 그대로)
  useEffect(() => {
    const onOpen = e => { setInitial(e.detail || null); setOpen(true) }
    window.addEventListener('open-palette', onOpen)
    return () => window.removeEventListener('open-palette', onOpen)
  }, [])

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

  // 아이콘·미리보기는 누구나(비로그인 포함). 실제 편집·저장은 회원만 — 비회원은 잠금+가입 안내.
  const role = user?.user_metadata?.role
  const isMember = !!user && (role === 'student' || role === 'artist' || role === 'admin')
  if (HIDE.includes(pathname)) return null

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
        <button className="pf-btn" onClick={() => { setInitial(null); setOpen(true) }} aria-label="색 계획 열기"
          style={{ pointerEvents:'auto', width:46, height:46, borderRadius:14, border:'none', cursor:'pointer', background:'#EDBA3B', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 20px -5px rgba(237,186,59,0.5), 0 2px 6px rgba(0,0,0,0.28)', padding:0,
            opacity: tuck ? 0.62 : 1, transform: tuck ? 'translateX(38px) scale(0.9)' : 'none' }}>
          <svg width="27" height="27" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#fff" fillRule="evenodd" clipRule="evenodd"
              d="M12 2.4C6.1 2.4 1.6 6.5 1.6 11.7C1.6 16.1 5.1 19.7 9.5 19.7C10.7 19.7 11.4 18.9 11.4 17.9C11.4 17.4 11.2 17 11 16.7C10.8 16.4 10.7 16.1 10.7 15.7C10.7 15 11.3 14.4 12 14.4L14.3 14.4C18.2 14.4 21.4 11.4 21.4 7.7C21.4 4.3 17.3 2.4 12 2.4ZM6.4 9.6A1.4 1.4 0 1 1 6.4 12.4A1.4 1.4 0 1 1 6.4 9.6ZM9.1 5.5A1.4 1.4 0 1 1 9.1 8.3A1.4 1.4 0 1 1 9.1 5.5ZM14.3 5.3A1.4 1.4 0 1 1 14.3 8.1A1.4 1.4 0 1 1 14.3 5.3ZM17.4 8.6A1.4 1.4 0 1 1 17.4 11.4A1.4 1.4 0 1 1 17.4 8.6Z"/>
          </svg>
        </button>
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:150, left:'50%', transform:'translateX(-50%)', zIndex:1400, background:'rgba(20,16,26,0.92)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:600, fontSize:12.5, padding:'10px 16px', borderRadius:20, boxShadow:'0 6px 20px rgba(0,0,0,0.35)', animation:'pf-toast .25s ease', whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      {open && <PalettePlanner initial={initial} role={role} saving={saving} locked={!isMember} onSignup={() => { setOpen(false); setInitial(null); router.push('/signup') }} onClose={() => { setOpen(false); setInitial(null) }} onSave={handleSave} />}
    </>
  )
}
