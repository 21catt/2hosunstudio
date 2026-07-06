'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import AdminNav from '../../../components/AdminNav'
import { NavIcon } from '../../../components/NavIcons'
import { HEADER_BG } from '../../../lib/adminTheme'
import { THEMES, applyTheme, getSavedTheme, isValidTheme } from '../../../lib/theme'
import { PIXEL_CATS, pixelCatImg, getSavedProfileCat, saveProfileCatLocal, isValidPixelCat, DEFAULT_PROFILE_CAT } from '../../../lib/pixelCats'

// 관리자 개인 설정 — 프로필 사진(픽셀 고양이)·화면 색(테마) 커스텀.
// 관리자는 전부 해금(잠금 없음). 냥밭 농부냥은 없음.
export default function AdminSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [profileCat, setProfileCat] = useState(DEFAULT_PROFILE_CAT)
  const [themeKey, setThemeKey] = useState('ultra')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setThemeKey(getSavedTheme())
    setProfileCat(getSavedProfileCat())
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/student'); return }
      setUser(data.user)
      const [{ data: pref }, { data: u }] = await Promise.all([
        supabase.from('user_prefs').select('profile_cat, theme').eq('user_id', data.user.id).single(),
        supabase.from('users').select('name').eq('id', data.user.id).single(),
      ])
      if (isValidPixelCat(pref?.profile_cat)) setProfileCat(pref.profile_cat)
      if (isValidTheme(pref?.theme)) { setThemeKey(pref.theme); applyTheme(pref.theme) }
      setName(u?.name || data.user.user_metadata?.name || '')
      setLoading(false)
    })
  }, [])

  async function changeProfileCat(key) {
    setProfileCat(key)
    saveProfileCatLocal(key)
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, profile_cat: key })
  }

  async function changeTheme(key) {
    setThemeKey(key)
    applyTheme(key)
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, theme: key })
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ fontSize: 32 }}>🐱</div>
    </div>
  )

  return (
    <>
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span onClick={() => router.push('/admin')} style={{ fontSize: 20, fontWeight: 900, color: '#fff', cursor: 'pointer', lineHeight: 1 }} title="홈">‹</span>
          <span className="header-title">개인 설정</span>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', marginTop: -8, padding: '16px 16px 90px', minHeight: '80vh' }}>

        {/* 계정 카드 */}
        <div className="p-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--acBg)', border: '1.5px solid var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            <img src={pixelCatImg(profileCat)} alt="프로필" width={34} height={34} style={{ imageRendering: 'pixelated', display: 'block' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--td)' }}>{name || '관리자'}</div>
            <div style={{ fontSize: 11, color: 'var(--tmu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--acTx)', marginTop: 3 }}>🛠️ 관리자 · 모든 고양이·테마 열려 있어요</div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="p-chip p-chip--sm" style={{ borderColor: 'var(--g2)', color: 'var(--tm)', fontWeight: 700, flexShrink: 0 }}>로그아웃</button>
        </div>

        {/* 프로필 사진 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tmu)', marginBottom: 2 }}>프로필 사진</div>
        <div style={{ fontSize: 11, color: 'var(--tmu)', marginBottom: 10 }}>라운지·프로필에 보일 고양이를 골라요 🐾</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 22 }}>
          {PIXEL_CATS.map(k => {
            const on = profileCat === k
            return (
              <div key={k} onClick={() => changeProfileCat(k)}
                style={{ cursor: 'pointer', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: on ? 'var(--acBg)' : '#fff', border: on ? '2px solid var(--ac)' : '1.5px solid var(--g2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={pixelCatImg(k)} alt={k} width={40} height={40} style={{ imageRendering: 'pixelated', display: 'block' }} />
              </div>
            )
          })}
        </div>

        {/* 화면 색 (테마) */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tmu)', marginBottom: 2 }}>화면 색</div>
        <div style={{ fontSize: 11, color: 'var(--tmu)', marginBottom: 10 }}>앱 전체(관리자 화면 포함) 색이 바뀌어요 🎨</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {THEMES.map(t => {
            const on = themeKey === t.key
            return (
              <div key={t.key} onClick={() => changeTheme(t.key)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 14, background: on ? 'var(--acBg)' : '#fff', border: on ? `2px solid ${t.a1}` : '1.5px solid var(--g2)' }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: t.a1, flexShrink: 0 }} />
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: t.a2, marginLeft: -14, flexShrink: 0, border: '2px solid #fff' }} />
                <span style={{ fontSize: 12, fontWeight: on ? 800 : 600, color: on ? 'var(--acTx)' : 'var(--td)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      <AdminNav active="" />
    </>
  )
}
