'use client'
// 비회원 소개 페이지(/intro) — "여기서 배우고 싶다"는 마음이 들게 하는 한 장.
// 수업·시간은 현재 등록 정보를 옮겨 적은 것이라, 수업 시간이 바뀌면 여기도 고쳐야 한다.
// ⚠️ 테마 변수(--ac 등)를 쓰지 않고 이 페이지 전용 색을 쓴다 — 방문자 테마(유리 등)에 따라 글씨가 흐려지지 않게.
// ⚠️ 후기·수강생 수 같은 숫자는 지어내지 않는다(사실만).
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { loadStudioProfile, mapLinks, EMPTY_STUDIO } from '../../lib/studioProfile'

const K = {
  bg: '#FBF6EE',        // 미색 바탕
  bgWarm: '#F6EADB',    // 첫 화면 그라데이션 아래쪽
  card: '#FFFFFF',
  line: '#E8DCC8',
  ink: '#241F1A',       // 본문 글씨 — 진하게
  sub: '#5C5248',       // 보조 글씨 — 따뜻한 짙은 갈색
  accent: '#C0562C',    // 테라코타
  accentSoft: '#FAE7D8',
  sage: '#6D7C4E',      // 두 번째 색 — "처음 시작" 표식
  sageSoft: '#EAEEDC',
}

const SHADOW = '0 2px 10px rgba(80,58,40,0.055), 0 10px 26px -12px rgba(80,58,40,0.10)'

const COURSES = [
  { key: 'draw',     level: 'first', name: '기초 드로잉',   for: '처음 시작하는 분',    line: '관찰하는 법부터, 그리는 법까지',      time: '회당 2시간', price: '190,000원' },
  { key: 'color',    level: 'first', name: '색채 기초',     for: '채색이 처음인 분',    line: '감이 아니라 순서로 색을 읽어요',      time: '회당 2시간', price: '190,000원' },
  { key: 'value',    level: 'first', name: '명암의 이해',   for: '처음 시작하는 분',    line: '빛과 그림자로 덩어리를 세워요 (유화)', time: '회당 2시간', price: '190,000원' },
  { key: 'anat',     level: 'deep',  name: '인체 드로잉',   for: '인물을 그리고 싶은 분', line: '뼈와 근육 구조로 인체를 이해해요',    time: '회당 2시간', price: '190,000원' },
  { key: 'portrait', level: 'deep',  name: '인물화',        for: '깊이 파고들고 싶은 분', line: '이목구비 구조부터 나만의 피부색까지',  time: '회당 3시간', price: '230,000원' },
  { key: 'sculpt',   level: 'deep',  name: '조소 기초 두상', for: '손으로 만들고 싶은 분', line: '덩어리에서 시작해 두상을 완성해요',   time: '회당 3시간', price: '260,000원' },
]

// 수업별 정기 시간 — 한눈에 보기용 요약(정확한 시간은 예약 달력)
const TIMES = [
  ['기초 드로잉', [['화 · 수', '2시 · 4시 · 7시'], ['목', '2시 · 4시'], ['토', '11시 30분'], ['일', '12시 · 4시']]],
  ['색채 기초', [['화 · 수 · 목', '2시 · 4시 · 7시'], ['토', '11시 30분 · 4시'], ['일', '12시 · 4시']]],
  ['명암의 이해', [['화 · 수 · 목', '2시 · 4시 · 7시'], ['토', '11시 30분 · 4시'], ['일', '12시 · 4시']]],
  ['인물화', [['화 · 수 · 목', '2시 · 7시'], ['일', '12시 · 4시']]],
  ['인체 드로잉', [['토', '5시']]],
  ['조소 기초 두상', [['수', '6시 30분'], ['토', '11시']]],
  ['원데이 체험', [['수', '2시 · 7시'], ['토', '11시 30분']]],
]

const POINTS = [
  ['👀', '원리로 배워요', '따라 그리기가 아니라, 왜 그렇게 보이는지부터 알려 드려요.'],
  ['🤝', '한 사람씩 봐요', '한 수업에 4~5명. 매번 내 그림에 대한 이야기를 들어요.'],
  ['🗓', '내 속도로 와요', '언제든 시작하고, 원하는 날을 앱에서 골라 와요.'],
]

const STEPS = [
  ['가입하기', '1분이면 끝나요.'],
  ['수강권 받기', '원하는 수업과 시작일을 정해요.'],
  ['앱에서 예약하기', '달력에서 날짜와 시간을 골라요.'],
  ['수업 오기', '끝나면 피드백과 작품 사진이 기록에 남아요.'],
]

const FAQ = [
  ['그림을 처음 그려 봐요.', '괜찮아요. 기초 드로잉·색채 기초·명암의 이해는 처음인 분 기준이에요. 원데이 체험으로 먼저 와 보셔도 좋아요.'],
  ['요일이 정해져 있나요?', '아니요. 앱 달력에서 원하는 날짜와 시간을 골라 예약해요.'],
  ['못 가게 되면요?', '수업 4시간 전까지 앱에서 취소하면 횟수가 그대로 돌아와요.'],
  ['수업 끝나고 더 그려도 되나요?', '네. 여유롭게 30분~1시간 정도 더 연습하다 가셔도 돼요.'],
  ['재료는요?', '기본 재료는 스튜디오에 있어요.'],
]

export default function IntroPage() {
  const [faq, setFaq] = useState(-1)
  const [sheet, setSheet] = useState(false)
  const [tab, setTab] = useState('all')          // 수업 필터: 전체 / 처음 / 더 깊이
  const [studio, setStudio] = useState(EMPTY_STUDIO)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadStudioProfile().then(({ profile }) => setStudio(profile)) }, [])

  const links = mapLinks(studio)
  const courses = COURSES.filter(c => tab === 'all' || c.level === tab)

  async function shareLocation() {
    const text = [studio.address, studio.address_detail].filter(Boolean).join(' ')
    try {
      if (navigator.share) { await navigator.share({ title: '2호선 스튜디오 오시는 길', text, url: links.naver }); return }
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  return (
    <div style={{ background: K.bg, minHeight: '100vh', color: K.ink, paddingBottom: 124,
      fontFamily: '-apple-system, "Apple SD Gothic Neo", "Pretendard", sans-serif', wordBreak: 'keep-all' }}>

      {/* ── 첫 화면 ── */}
      <section style={{ position: 'relative', overflow: 'hidden',
        background: `linear-gradient(170deg, #FFFCF6 0%, ${K.bgWarm} 100%)`, padding: '20px 22px 34px' }}>
        {/* 배경 오라 — 따뜻한 느낌만 주고 글씨는 안 가린다 */}
        <div aria-hidden style={{ position: 'absolute', top: -110, right: -90, width: 290, height: 290, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(192,86,44,0.13), rgba(192,86,44,0))' }} />
        <div aria-hidden style={{ position: 'absolute', top: 120, left: -120, width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(109,124,78,0.14), rgba(109,124,78,0))' }} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/pixel-cats/18-studio.png" alt="" style={{ width: 30, height: 30, imageRendering: 'pixelated' }} />
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.2px' }}>2호선 스튜디오</span>
          </div>
          <Link href="/login" style={{ fontSize: 14.5, fontWeight: 700, color: K.sub, textDecoration: 'none',
            border: `1px solid ${K.line}`, borderRadius: 999, padding: '7px 14px', background: 'rgba(255,255,255,0.7)' }}>로그인</Link>
        </div>

        <div style={{ position: 'relative', marginTop: 30 }}>
          <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 800, color: K.sage,
            background: K.sageSoft, borderRadius: 999, padding: '6px 13px', letterSpacing: '-0.1px' }}>
            4~5명 소수 · 초보 환영
          </span>
          <h1 style={{ fontSize: 33, fontWeight: 800, lineHeight: 1.38, margin: '14px 0 12px', letterSpacing: '-0.8px' }}>
            그림은 재능보다<br />
            <span style={{ color: K.accent }}>보는 법</span>에서 시작해요
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.75, color: K.sub, margin: 0 }}>
            드로잉·색채·유화·조소를 차근차근.<br />
            오늘 처음 연필을 잡는 분도 괜찮아요.
          </p>

          <Link href="/signup" style={{ ...cta, marginTop: 22 }}>가입하고 시작하기</Link>
          <button onClick={() => setSheet(true)} style={ghost}>시간표 먼저 보기</button>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {[['4주', '4회 · 주 1회'], ['2시간', '수업 + 연습'], ['월·금', '쉬는 날']].map(([big, small]) => (
              <div key={big} style={{ flex: 1, background: 'rgba(255,255,255,0.78)', border: `1px solid ${K.line}`,
                borderRadius: 14, padding: '11px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{big}</div>
                <div style={{ fontSize: 11.5, color: K.sub, marginTop: 2, fontWeight: 600 }}>{small}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 화실 사진 — 관리자 「화실소개」에서 올린 사진 ── */}
      {studio.photos.length > 0 && (
        <section style={{ padding: '22px 0 4px' }}>
          <div onScroll={e => { const el = e.currentTarget; setPhotoIdx(Math.round(el.scrollLeft / (el.clientWidth * 0.86))) }}
            style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '0 22px', scrollbarWidth: 'none' }}>
            {studio.photos.map(ph => (
              <figure key={ph.url} style={{ margin: 0, flex: '0 0 86%', scrollSnapAlign: 'center', position: 'relative' }}>
                <img src={ph.url} alt={ph.caption || '화실 사진'}
                  style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 20, display: 'block', boxShadow: SHADOW }} />
                {ph.caption && (
                  <figcaption style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 13, fontWeight: 700, color: '#fff',
                    background: 'rgba(36,31,26,0.55)', borderRadius: 999, padding: '6px 12px', backdropFilter: 'blur(4px)' }}>{ph.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
          {studio.photos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
              {studio.photos.map((ph, i) => (
                <span key={ph.url} style={{ width: i === photoIdx ? 18 : 6, height: 6, borderRadius: 9,
                  background: i === photoIdx ? K.accent : K.line, transition: 'width .2s' }} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 이런 곳이에요 ── */}
      <Section title="이런 곳이에요">
        <div style={{ display: 'grid', gap: 10 }}>
          {POINTS.map(([icon, t, d]) => (
            <div key={t} style={{ ...cardBox, display: 'flex', gap: 13, alignItems: 'flex-start', padding: '16px 16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: K.sageSoft, display: 'grid', placeItems: 'center', fontSize: 19, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 3 }}>{t}</div>
                <div style={bodyText}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 원데이 체험 — 진입 장벽 낮추기, 수업 앞에 둔다 ── */}
      <section style={{ padding: '26px 22px 0' }}>
        <div style={{ background: `linear-gradient(145deg, ${K.accentSoft}, #FFF4EA)`, border: `1px solid #F0D6C1`,
          borderRadius: 22, padding: '18px 18px 16px', boxShadow: SHADOW }}>
          <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
            <img src="/farm/cat-bucket.png" alt="" style={{ width: 52, height: 52, imageRendering: 'pixelated' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: K.accent }}>망설여지면 하루만</div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 3px' }}>원데이 체험</div>
              <div style={{ fontSize: 14.5, color: K.sub, fontWeight: 600 }}>수요일 · 토요일 · 재료 준비 없이</div>
            </div>
          </div>
          <Link href="/signup" style={{ ...cta, background: '#fff', color: K.accent, border: `1.5px solid ${K.accent}`,
            marginTop: 14, fontSize: 16, padding: '14px' }}>체험 먼저 해볼게요</Link>
        </div>
      </section>

      {/* ── 수업 ── */}
      <Section title="수업">
        <p style={{ ...bodyText, margin: '0 0 12px' }}>
          모두 <b style={{ color: K.ink }}>4주 4회</b>, 주 1회예요. 수업 뒤 30분~1시간 더 연습하다 가셔도 돼요.
        </p>
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
          {[['all', '전체'], ['first', '처음이에요'], ['deep', '더 깊이']].map(([v, label]) => (
            <button key={v} onClick={() => setTab(v)} style={{
              padding: '9px 15px', borderRadius: 999, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
              border: `1px solid ${tab === v ? K.ink : K.line}`,
              background: tab === v ? K.ink : 'rgba(255,255,255,0.8)', color: tab === v ? '#fff' : K.sub }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 11 }}>
          {courses.map(c => {
            const first = c.level === 'first'
            return (
              <div key={c.key} style={{ ...cardBox, padding: '17px 18px 15px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: '5px 11px',
                  color: first ? K.sage : K.accent, background: first ? K.sageSoft : K.accentSoft }}>{c.for}</span>
                <div style={{ fontSize: 20, fontWeight: 800, margin: '9px 0 5px', letterSpacing: '-0.3px' }}>{c.name}</div>
                <div style={bodyText}>{c.line}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginTop: 13, paddingTop: 12, borderTop: `1px dashed ${K.line}` }}>
                  <span style={{ fontSize: 14.5, color: K.sub, fontWeight: 600 }}>4주 4회 · {c.time}</span>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>{c.price}</span>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── 시작하는 법 ── */}
      <Section title="시작하는 법">
        <div style={{ ...cardBox, padding: '6px 18px' }}>
          {STEPS.map(([t, d], i) => (
            <div key={t} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '15px 0',
              borderTop: i ? `1px solid ${K.line}` : 'none' }}>
              <div style={{ width: 27, height: 27, borderRadius: 999, background: i === 0 ? K.accent : K.accentSoft,
                color: i === 0 ? '#fff' : K.accent, fontSize: 14, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{t}</div>
                <div style={{ ...bodyText, fontSize: 15 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 여는 시간 ── */}
      <Section title="여는 시간">
        <div style={{ ...cardBox, padding: '4px 18px' }}>
          {[['화 · 수 · 목', '오후 2시 · 4시 · 저녁 7시'], ['토 · 일', '낮 11시 ~ 오후'], ['월 · 금', '쉬어요']].map(([d, t], i) => (
            <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0',
              borderTop: i ? `1px solid ${K.line}` : 'none', fontSize: 16.5 }}>
              <span style={{ fontWeight: 800 }}>{d}</span>
              <span style={{ color: i === 2 ? K.sub : K.ink, fontWeight: 600 }}>{t}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setSheet(true)} style={{ display: 'block', width: '100%', marginTop: 10, padding: '14px',
          borderRadius: 14, border: `1px solid ${K.line}`, background: '#fff', color: K.ink, fontSize: 15.5, fontWeight: 800,
          fontFamily: 'inherit', cursor: 'pointer', boxShadow: SHADOW }}>
          수업별 시간표 보기
        </button>
      </Section>

      {/* ── 오시는 길 — 관리자 「화실소개」에서 입력 ── */}
      {studio.address && (
        <Section title="오시는 길">
          <div style={{ ...cardBox, overflow: 'hidden', padding: 0 }}>
            <iframe title="화실 위치 지도" src={links.embed} loading="lazy" style={{ width: '100%', height: 190, border: 0, display: 'block' }} />
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5 }}>{studio.address}</div>
              {studio.address_detail && <div style={{ ...bodyText, color: K.ink }}>{studio.address_detail}</div>}
              {studio.directions && <div style={{ ...bodyText, marginTop: 8, whiteSpace: 'pre-line' }}>{studio.directions}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <a href={links.naver} target="_blank" rel="noreferrer" style={mapBtn}>네이버 지도</a>
                <a href={links.kakao} target="_blank" rel="noreferrer" style={mapBtn}>카카오맵</a>
                <button onClick={shareLocation} style={{ ...mapBtn, border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>{copied ? '복사됨' : '공유'}</button>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── 자주 묻는 질문 ── */}
      <Section title="자주 묻는 질문">
        <div style={{ ...cardBox, padding: '2px 18px' }}>
          {FAQ.map(([q, a], i) => (
            <div key={q} style={{ borderTop: i ? `1px solid ${K.line}` : 'none' }}>
              <button onClick={() => setFaq(faq === i ? -1 : i)}
                style={{ width: '100%', textAlign: 'left', padding: '16px 0', border: 'none', background: 'none', fontFamily: 'inherit',
                  fontSize: 16, fontWeight: 700, color: K.ink, display: 'flex', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}>
                {q}<span style={{ color: K.accent, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{faq === i ? '−' : '+'}</span>
              </button>
              {faq === i && <div style={{ ...bodyText, paddingBottom: 15 }}>{a}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* ── 마지막 한마디 ── */}
      <section style={{ padding: '30px 22px 6px', textAlign: 'center' }}>
        <img src="/pixel-cats/01-happy.png" alt="" style={{ width: 54, height: 54, imageRendering: 'pixelated' }} />
        <p style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.6, margin: '10px 0 0' }}>
          오늘 시작하면<br />한 달 뒤엔 그림 네 장이 남아요
        </p>
      </section>

      {/* ── 하단 고정 버튼 ── */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390,
        padding: '16px 18px 22px', background: `linear-gradient(rgba(251,246,238,0), ${K.bg} 32%)` }}>
        <Link href="/signup" style={cta}>가입하고 시작하기</Link>
        <button onClick={() => setSheet(true)} style={{ ...ghost, marginTop: 8, marginBottom: 0 }}>먼저 시간표만 볼게요</button>
      </div>

      {/* ── 시간표 한눈에 보기 — 아래에서 올라오는 시트 ── */}
      {sheet && (
        <div onClick={() => setSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(36,31,26,0.4)', zIndex: 50,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 390, maxHeight: '86vh', overflowY: 'auto', background: K.bg,
            borderRadius: '24px 24px 0 0', padding: '12px 22px 22px' }}>
            <div style={{ width: 40, height: 5, borderRadius: 9, background: K.line, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>시간표</h2>
              <button onClick={() => setSheet(false)} style={{ border: 'none', background: 'none', fontSize: 15, fontWeight: 700, color: K.sub, fontFamily: 'inherit', cursor: 'pointer' }}>닫기</button>
            </div>
            <p style={{ fontSize: 14.5, color: K.sub, margin: '6px 0 14px' }}>월·금은 쉬어요. 원하는 날짜·시간을 골라 신청해요.</p>
            {TIMES.map(([name, rows]) => (
              <div key={name} style={{ ...cardBox, padding: '13px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 5 }}>{name}</div>
                {rows.map(([d, t]) => (
                  <div key={d} style={{ display: 'flex', gap: 12, fontSize: 15.5, padding: '3px 0' }}>
                    <span style={{ width: 86, fontWeight: 700, color: K.accent, flexShrink: 0 }}>{d}</span>
                    <span style={{ color: K.sub, fontWeight: 600 }}>{t}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ position: 'sticky', bottom: -22, margin: '0 -22px -22px', padding: '12px 22px 22px',
              background: `linear-gradient(rgba(251,246,238,0), ${K.bg} 30%)` }}>
              <Link href="/student" style={cta}>수업 신청하러 가기</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ padding: '28px 22px 0' }}>
      <h2 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.4px' }}>{title}</h2>
      {children}
    </section>
  )
}

const cardBox = { background: K.card, border: `1px solid ${K.line}`, borderRadius: 20, boxShadow: SHADOW }
const cta = { display: 'block', textAlign: 'center', padding: '17px', borderRadius: 16, background: K.accent,
  color: '#fff', fontSize: 17.5, fontWeight: 800, textDecoration: 'none', boxShadow: '0 8px 20px -8px rgba(192,86,44,0.55)' }
const ghost = { display: 'block', width: '100%', textAlign: 'center', marginTop: 10, padding: '4px', fontSize: 15, fontWeight: 700,
  color: K.sub, background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }
const mapBtn = { flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 12, background: K.accentSoft, color: K.accent, fontSize: 14.5, fontWeight: 800, textDecoration: 'none' }
const bodyText = { fontSize: 15.5, lineHeight: 1.7, color: K.sub }
