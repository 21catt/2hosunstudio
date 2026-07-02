'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import MoodIndicator from '../../../components/MoodIndicator'
import { THEMES, applyTheme, getSavedTheme, isValidTheme } from '../../../lib/theme'
import { FARM_CATS, getSavedFarmCat, saveFarmCatLocal, isValidFarmCat } from '../../../lib/farmCats'
import { PIXEL_CATS, pixelCatImg, getSavedProfileCat, saveProfileCatLocal, isValidPixelCat } from '../../../lib/pixelCats'
import LoadingCat from '../../../components/LoadingCat'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [themeKey, setThemeKey] = useState('ultra')
  const [moodStyle, setMoodStyle] = useState('cup')
  const [farmCat, setFarmCat] = useState('watering')
  const [profileCat, setProfileCat] = useState('09-cat')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setThemeKey(getSavedTheme())
    setFarmCat(getSavedFarmCat())
    setProfileCat(getSavedProfileCat())
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user || null
      setUser(u)
      if (u) {
        const { data: profile } = await supabase.from('users').select('name').eq('id', u.id).single()
        setName(profile?.name || '')
        const { data: pref } = await supabase.from('user_prefs').select('*').eq('user_id', u.id).single()
        setMoodStyle(pref?.mood_style || 'cup')
        if (isValidTheme(pref?.theme)) { setThemeKey(pref.theme); applyTheme(pref.theme) }
        if (isValidFarmCat(pref?.farm_cat)) { setFarmCat(pref.farm_cat); saveFarmCatLocal(pref.farm_cat) }
        if (isValidPixelCat(pref?.profile_cat)) { setProfileCat(pref.profile_cat); saveProfileCatLocal(pref.profile_cat) }
      }
      setLoading(false)
    })
  }, [])

  async function changeTheme(key) {
    setThemeKey(key)
    applyTheme(key)
    // user_prefs.theme 컬럼이 없으면 upsert만 실패하고 기기(localStorage) 저장은 유지됨
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, theme: key })
  }

  async function changeMood(style) {
    setMoodStyle(style)
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, mood_style: style })
  }

  async function changeFarmCat(key) {
    setFarmCat(key)
    saveFarmCatLocal(key)
    // user_prefs.farm_cat 컬럼이 없으면 upsert만 실패하고 기기(localStorage) 저장은 유지됨
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, farm_cat: key })
  }

  async function changeProfileCat(key) {
    setProfileCat(key)
    saveProfileCatLocal(key)
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, profile_cat: key })
  }

  if (loading) return <LoadingCat />

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>⚙️</span>
          <span className="p-title">개인 설정</span>
        </div>
      </div>

      <div style={{ background:'#fff', padding:'8px 16px 90px' }}>

        {user ? (
          <div className="p-card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--acBg)', border:'1.5px solid var(--ac)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
              <img src={pixelCatImg(profileCat)} alt="프로필" width={34} height={34} style={{ imageRendering:'pixelated', display:'block' }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--td)' }}>{name || '수강생'}</div>
              <div style={{ fontSize:11, color:'var(--tmu)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
            </div>
            <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))} className="p-chip p-chip--sm" style={{ borderColor:'var(--g2)', color:'var(--tm)', fontWeight:700, flexShrink:0 }}>로그아웃</button>
          </div>
        ) : (
          <div className="p-card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--td)' }}>로그인하면 설정이 계정에 저장돼요</div>
            <button onClick={()=>router.push('/login')} className="p-chip p-chip--sm" style={{ flexShrink:0 }}>로그인 / 가입</button>
          </div>
        )}

        <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:2 }}>프로필 사진</div>
        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10 }}>마음에 드는 얼굴을 골라요 🐱</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:20 }}>
          {PIXEL_CATS.map(k => {
            const on = profileCat === k
            return (
              <div key={k} onClick={() => changeProfileCat(k)}
                style={{ cursor:'pointer', aspectRatio:'1', borderRadius:12, background: on ? 'var(--acBg)' : '#fff', border: on ? '2px solid var(--ac)' : '1.5px solid var(--g2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={pixelCatImg(k)} alt={k} width={40} height={40} style={{ imageRendering:'pixelated', display:'block' }} />
              </div>
            )
          })}
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:8 }}>테마 컬러</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
          {THEMES.map(t => {
            const on = themeKey === t.key
            return (
              <div key={t.key} onClick={() => changeTheme(t.key)}
                style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:8, padding:'11px 12px', borderRadius:14, background: on ? 'var(--acBg)' : '#fff', border: on ? `2px solid ${t.a1}` : '1.5px solid var(--g2)' }}>
                <span style={{ width:16, height:16, borderRadius:'50%', background:t.a1, flexShrink:0 }} />
                <span style={{ width:16, height:16, borderRadius:'50%', background:t.a2, marginLeft:-14, flexShrink:0, border:'2px solid #fff' }} />
                <span style={{ fontSize:12, fontWeight: on?800:600, color: on?'var(--acTx)':'var(--td)' }}>{t.name}</span>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:2 }}>수강권 무드</div>
        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10 }}>잔여가 줄면 표정이 바뀌어요 🐾</div>
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {[['orb','리퀴드 오브'],['cup','커피 유리컵'],['plant','식물']].map(([k, label]) => {
            const on = moodStyle === k
            return (
              <div key={k} onClick={() => changeMood(k)}
                style={{ flex:1, cursor:'pointer', background: on ? 'var(--acBg)' : '#fff', border: on ? '2px solid var(--ac)' : '1.5px solid var(--g2)', borderRadius:14, padding:'12px 4px 9px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <MoodIndicator ratio={0.7} style={k} size={48} />
                <span style={{ fontSize:10, fontWeight: on?800:700, color: on?'var(--acTx)':'var(--tmu)' }}>{label}</span>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'var(--tmu)', marginBottom:2 }}>농부냥</div>
        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10 }}>냥밭을 돌봐줄 고양이 한 마리를 골라요 🥕</div>
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {FARM_CATS.map(c => {
            const on = farmCat === c.key
            return (
              <div key={c.key} onClick={() => changeFarmCat(c.key)}
                style={{ flex:1, cursor:'pointer', background: on ? 'var(--acBg)' : '#fff', border: on ? '2px solid var(--ac)' : '1.5px solid var(--g2)', borderRadius:14, padding:'12px 4px 9px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <img src={c.img} alt={c.name} width={44} style={{ imageRendering:'pixelated', display:'block' }} />
                <span style={{ fontSize:10, fontWeight: on?800:700, color: on?'var(--acTx)':'var(--td)' }}>{c.name}</span>
                <span style={{ fontSize:9, color:'var(--tmu)' }}>{c.desc}</span>
              </div>
            )
          })}
        </div>
      </div>

      <StudentNav active="settings" />
    </>
  )
}
