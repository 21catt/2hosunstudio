'use client'
// 관리자 — 화실 소개(오시는 길·화실 사진). 비회원 소개 페이지(/intro)에 그대로 보인다.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { compressImage } from '../../../lib/imageCompress'
import { HEADER_BG } from '../../../lib/adminTheme'
import { loadStudioProfile, saveStudioProfile, mapLinks, storagePathOf, STUDIO_PHOTO_MAX, EMPTY_STUDIO } from '../../../lib/studioProfile'

export default function AdminStudioPage() {
  const router = useRouter()
  const [p, setP] = useState(EMPTY_STUDIO)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.user_metadata?.role !== 'admin') { router.push('/login'); return }
      const { profile, error } = await loadStudioProfile()
      if (error) setTableMissing(true)
      setP(profile)
      setLoading(false)
    })
  }, [])

  function set(k, v) { setP(prev => ({ ...prev, [k]: v })); setDirty(true) }

  async function save(next = p) {
    setSaving(true)
    const { error } = await saveStudioProfile(next)
    setSaving(false)
    if (error) { alert('저장하지 못했어요: ' + error.message + '\n\nmigration-studio-profile.sql 을 먼저 실행했는지 확인해 주세요.'); return false }
    setDirty(false)
    return true
  }

  async function upload(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    if (p.photos.length + files.length > STUDIO_PHOTO_MAX) {
      alert(`사진은 최대 ${STUDIO_PHOTO_MAX}장이에요. 지금 ${p.photos.length}장 있어요.`)
      return
    }
    setUploading(true)
    const added = []
    for (const orig of files) {
      const file = await compressImage(orig)
      const ext = (file.name?.split('.').pop() || 'jpg')
      const path = `studio/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('seat-photos').upload(path, file)
      if (error) { alert('업로드 실패: ' + error.message); continue }
      const { data } = supabase.storage.from('seat-photos').getPublicUrl(path)
      added.push({ url: data.publicUrl, caption: '' })
    }
    const next = { ...p, photos: [...p.photos, ...added] }
    setP(next)
    // 사진은 올리는 즉시 저장 — 저장을 잊으면 파일만 남는다
    if (added.length) await save(next)
    setUploading(false)
  }

  async function removePhoto(i) {
    if (!confirm('이 사진을 지울까요?')) return
    const target = p.photos[i]
    const next = { ...p, photos: p.photos.filter((_, j) => j !== i) }
    setP(next)
    if (await save(next)) {
      const path = storagePathOf(target.url)
      if (path) await supabase.storage.from('seat-photos').remove([path])
    }
  }

  function move(i, d) {
    const j = i + d
    if (j < 0 || j >= p.photos.length) return
    const photos = [...p.photos]
    ;[photos[i], photos[j]] = [photos[j], photos[i]]
    set('photos', photos)
  }

  function setCaption(i, v) {
    set('photos', p.photos.map((ph, j) => j === i ? { ...ph, caption: v } : ph))
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 32 }}>🐱</div>

  const links = mapLinks(p)

  return (
    <>
      <div className="header" style={{ background: HEADER_BG }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span onClick={() => router.push('/admin')} style={{ fontSize: 20, fontWeight: 900, color: '#fff', cursor: 'pointer', lineHeight: 1 }} title="홈">‹</span>
          <span className="header-title">화실 소개</span>
        </div>
      </div>

      <div style={{ background: 'var(--page)', borderRadius: '24px 24px 0 0', marginTop: -8, padding: '16px 16px 120px', minHeight: '80vh' }}>
        <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, marginBottom: 14 }}>
          여기서 입력한 위치와 사진은 비회원 소개 페이지(<b>/intro</b>)에 보여요.
          <span onClick={() => window.open('/intro', '_blank')} style={{ color: 'var(--ac)', fontWeight: 800, cursor: 'pointer', marginLeft: 6 }}>소개 페이지 열기 ↗</span>
        </div>

        {tableMissing && (
          <div className="p-card" style={{ padding: 14, marginBottom: 14, border: '1.5px solid #D98A2B', fontSize: 13, lineHeight: 1.6 }}>
            ⚠️ 아직 저장 공간이 없어요. Supabase SQL Editor 에서 <b>migration-studio-profile.sql</b> 을 한 번 실행해 주세요.
          </div>
        )}

        {/* 오시는 길 */}
        <div style={sectionTitle}>📍 오시는 길</div>
        <div className="p-card" style={{ padding: 14, marginBottom: 20 }}>
          <Field label="주소" hint="도로명 주소 — 지도 검색에 쓰여요">
            <input value={p.address} onChange={e => set('address', e.target.value)} placeholder="예) 서울 ○○구 ○○로 00" style={input} />
          </Field>
          <Field label="상세 주소" hint="건물명·층·호수">
            <input value={p.address_detail} onChange={e => set('address_detail', e.target.value)} placeholder="예) ○○빌딩 3층" style={input} />
          </Field>
          <Field label="찾아오는 길" hint="가까운 역·출구·걸어서 몇 분">
            <textarea value={p.directions} onChange={e => set('directions', e.target.value)} rows={3} placeholder="예) 2호선 ○○역 3번 출구에서 걸어서 5분" style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
          <Field label="지도 공유 링크 (선택)" hint="네이버 지도 → 장소 → 공유 → 링크 복사 후 붙여넣기. 비우면 주소로 검색해요">
            <input value={p.map_url} onChange={e => set('map_url', e.target.value)} placeholder="https://naver.me/..." style={input} />
          </Field>
          {p.address && (
            <>
              <iframe title="지도 미리보기" src={links.embed} style={{ width: '100%', height: 180, border: 0, borderRadius: 12, marginTop: 4 }} loading="lazy" />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <a href={links.naver} target="_blank" rel="noreferrer" style={linkBtn}>네이버 지도 확인</a>
                <a href={links.kakao} target="_blank" rel="noreferrer" style={linkBtn}>카카오맵 확인</a>
              </div>
            </>
          )}
        </div>

        {/* 화실 사진 */}
        <div style={sectionTitle}>🖼 화실 사진 <span style={{ fontSize: 12, color: 'var(--tmu)', fontWeight: 700 }}>{p.photos.length}/{STUDIO_PHOTO_MAX} · 첫 장이 대표 사진</span></div>
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          {p.photos.map((ph, i) => (
            <div key={ph.url} className="p-card" style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
              <img src={ph.url} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={ph.caption || ''} onChange={e => setCaption(i, e.target.value)} placeholder="짧은 설명 (선택) 예) 창가 자리" style={{ ...input, marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} style={smallBtn}>↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === p.photos.length - 1} style={smallBtn}>↓</button>
                  <button onClick={() => removePhoto(i)} style={{ ...smallBtn, color: '#c0392b', marginLeft: 'auto' }}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {p.photos.length < STUDIO_PHOTO_MAX && (
          <label style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 14, border: '1.5px dashed var(--g3)', color: 'var(--acTx)', fontWeight: 800, fontSize: 14, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '올리는 중…' : '＋ 사진 올리기 (여러 장 선택 가능)'}
            <input type="file" accept="image/*" multiple onChange={upload} disabled={uploading} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* 저장 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390, padding: '10px 16px 20px', background: 'linear-gradient(transparent, var(--page) 35%)' }}>
        <button onClick={() => save()} disabled={!dirty || saving}
          style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 900, fontFamily: 'inherit',
            background: dirty ? 'var(--ac)' : 'var(--g1)', color: dirty ? '#fff' : 'var(--tmu)', cursor: dirty ? 'pointer' : 'default' }}>
          {saving ? '저장 중…' : dirty ? '저장하기' : '저장됨'}
        </button>
      </div>
    </>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--td)' }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--tmu)', margin: '2px 0 6px' }}>{hint}</div>}
      {children}
    </div>
  )
}

const sectionTitle = { fontSize: 15, fontWeight: 900, color: 'var(--td)', margin: '0 2px 8px' }
const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surf)', fontSize: 14, fontFamily: 'inherit', color: 'var(--td)', outline: 'none' }
const linkBtn = { flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 10, background: 'var(--acBg)', color: 'var(--acTx)', fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }
const smallBtn = { padding: '6px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surf)', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--td)' }
