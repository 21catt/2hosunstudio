'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import StudentNav from '../../../components/StudentNav'
import { NavIcon } from '../../../components/NavIcons'
import MoodIndicator from '../../../components/MoodIndicator'
import { THEMES, applyTheme, getSavedTheme, isValidTheme } from '../../../lib/theme'
import { FARM_CATS, getSavedFarmCat, saveFarmCatLocal, isValidFarmCat, getSavedHarvest, saveHarvestLocal, farmCatUnlocked, farmCatUnlockLabel } from '../../../lib/farmCats'
import { PIXEL_CATS_BY_UNLOCK, pixelCatImg, catUnlocked, catUnlockLabel, getSavedProfileCat, saveProfileCatLocal, isValidPixelCat } from '../../../lib/pixelCats'
import LoadingCat from '../../../components/LoadingCat'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [themeKey, setThemeKey] = useState('ultra')
  const [moodStyle, setMoodStyle] = useState('cup')
  const [farmCat, setFarmCat] = useState('watering')
  const [profileCat, setProfileCat] = useState('09-cat')
  const [harvest, setHarvest] = useState(0)
  const [unlockAll, setUnlockAll] = useState(false) // 관리자가 해금해준 회원은 수확 조건 무시
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setThemeKey(getSavedTheme())
    setFarmCat(getSavedFarmCat())
    setProfileCat(getSavedProfileCat())
    setHarvest(getSavedHarvest())
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
        if (Number.isFinite(pref?.harvest_count) && pref.harvest_count >= 0) { setHarvest(pref.harvest_count); saveHarvestLocal(pref.harvest_count) }
        setUnlockAll(pref?.unlock_all === true)
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
    if (!farmCatUnlocked(key, { harvest, unlockAll })) return // 아직 해금 전
    setFarmCat(key)
    saveFarmCatLocal(key)
    // user_prefs.farm_cat 컬럼이 없으면 upsert만 실패하고 기기(localStorage) 저장은 유지됨
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, farm_cat: key })
  }

  async function changeProfileCat(key) {
    if (!catUnlocked(key, { harvest, unlockAll })) return // 아직 해금 전
    setProfileCat(key)
    saveProfileCatLocal(key)
    if (user?.id) await supabase.from('user_prefs').upsert({ user_id: user.id, profile_cat: key })
  }

  if (loading) return <LoadingCat />

  return (
    <>
      <div className="p-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <NavIcon name="user" color="var(--ac)" size={20} />
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
              <div style={{ fontSize:10, fontWeight:700, color:'var(--acTx)', marginTop:3 }}>
                🌾 수확한 작물 {harvest}개 · {(FARM_CATS.find(c => c.key === farmCat) || FARM_CATS[0]).cropName} 재배 중
              </div>
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
        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10 }}>
          {unlockAll ? '🎁 모든 냥이가 열려 있어요! 마음껏 골라보세요' : `냥밭에서 작물을 수확하면 새 얼굴이 열려요 🥕 (지금 ${harvest}개)`}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:20 }}>
          {PIXEL_CATS_BY_UNLOCK.map(k => {
            const on = profileCat === k
            const locked = !catUnlocked(k, { harvest, unlockAll })
            return (
              <div key={k} onClick={() => changeProfileCat(k)}
                style={{ cursor: locked ? 'default' : 'pointer', aspectRatio:'1', borderRadius:12, position:'relative', overflow:'hidden', background: on ? 'var(--acBg)' : '#fff', border: on ? '2px solid var(--ac)' : '1.5px solid var(--g2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={pixelCatImg(k)} alt={k} width={40} height={40}
                  style={{ imageRendering:'pixelated', display:'block', opacity: locked ? 0.25 : 1, filter: locked ? 'grayscale(1)' : 'none' }} />
                {locked && (
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
                    <span style={{ fontSize:13 }}>🔒</span>
                    <span style={{ fontSize:8, fontWeight:800, color:'var(--tm)' }}>{catUnlockLabel(k)}</span>
                  </div>
                )}
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
        <div style={{ fontSize:11, color:'var(--tmu)', marginBottom:10 }}>
          {unlockAll ? '냥밭을 돌봐줄 고양이 한 마리를 골라요 🎁 (모든 농부냥이 열려 있어요!)' : '냥밭을 돌봐줄 고양이 한 마리를 골라요 🥕 (작물 12개 수확하면 농부 냥냥이가 열려요)'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
          {FARM_CATS.map(c => {
            const on = farmCat === c.key
            const locked = !farmCatUnlocked(c.key, { harvest, unlockAll })
            return (
              <div key={c.key} onClick={() => changeFarmCat(c.key)}
                style={{ cursor: locked ? 'default' : 'pointer', position:'relative', overflow:'hidden', background: on ? 'var(--acBg)' : '#fff', border: on ? '2px solid var(--ac)' : '1.5px solid var(--g2)', borderRadius:14, padding:'12px 4px 9px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <img src={c.img} alt={c.name} width={44} style={{ imageRendering:'pixelated', display:'block', opacity: locked ? 0.25 : 1, filter: locked ? 'grayscale(1)' : 'none' }} />
                <span style={{ fontSize:10, fontWeight: on?800:700, color: on?'var(--acTx)':'var(--td)', opacity: locked ? 0.4 : 1 }}>{c.name}</span>
                <span style={{ fontSize:9, color:'var(--tmu)', opacity: locked ? 0.4 : 1 }}>{c.desc}</span>
                {locked && (
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, background:'rgba(255,255,255,0.35)' }}>
                    <span style={{ fontSize:15 }}>🔒</span>
                    <span style={{ fontSize:9, fontWeight:800, color:'var(--tm)' }}>{farmCatUnlockLabel(c.key)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <StudentNav active="settings" />
    </>
  )
}
