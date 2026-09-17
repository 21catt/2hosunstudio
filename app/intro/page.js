'use client'
// 비회원 소개 페이지(/intro) — 수업 구성·시작하는 법·시간표를 한 장에.
// 수업·시간은 현재 등록 정보를 옮겨 적은 것이라, 수업 시간이 바뀌면 여기도 고쳐야 한다.
// 테마 변수(--ac 등)를 쓰지 않고 이 페이지 전용 색을 쓴다 — 방문자 테마(유리 등)에 따라 글씨가 흐려지지 않게.
import { useState } from 'react'
import Link from 'next/link'

const K = {
  bg: '#FAF5EC',      // 미색 바탕
  card: '#FFFDF8',
  line: '#EADFCD',
  ink: '#2A241F',     // 본문 글씨 — 진하게
  sub: '#5A5048',     // 보조 글씨 — 연한 회색 대신 따뜻한 짙은 갈색
  accent: '#B4552F',  // 테라코타
  accentSoft: '#F4E4D6',
}

const COURSES = [
  { key: 'draw', name: '기초 드로잉', for: '처음 시작하는 분', line: '관찰하는 법부터, 그리는 법까지', time: '회당 2시간', price: '190,000원' },
  { key: 'color', name: '색채 기초', for: '채색이 처음인 분', line: '감이 아니라 순서로 색을 읽어요', time: '회당 2시간', price: '190,000원' },
  { key: 'value', name: '명암의 이해', for: '처음 시작하는 분', line: '빛과 그림자로 덩어리를 세워요 (유화)', time: '회당 2시간', price: '190,000원' },
  { key: 'anat', name: '인체 드로잉', for: '인물을 그리고 싶은 분', line: '뼈와 근육 구조로 인체를 이해해요', time: '회당 2시간', price: '190,000원' },
  { key: 'portrait', name: '인물화', for: '깊이 파고들고 싶은 분', line: '이목구비 구조부터 나만의 피부색까지', time: '회당 3시간', price: '230,000원' },
  { key: 'sculpt', name: '조소 기초 두상', for: '손으로 만들고 싶은 분', line: '덩어리에서 시작해 두상을 완성해요', time: '회당 3시간', price: '260,000원' },
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

  return (
    <div style={{ background: K.bg, minHeight: '100vh', color: K.ink, paddingBottom: 110,
      fontFamily: '-apple-system, "Apple SD Gothic Neo", "Pretendard", sans-serif', wordBreak: 'keep-all' }}>

      {/* 첫 화면 */}
      <section style={{ padding: '26px 24px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>2호선 스튜디오</div>
          <Link href="/login" style={{ fontSize: 15, fontWeight: 700, color: K.sub, textDecoration: 'none' }}>로그인</Link>
        </div>

        <img src="/pixel-cats/18-studio.png" alt="" style={{ width: 72, height: 72, imageRendering: 'pixelated', marginTop: 34 }} />
        <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.4, margin: '14px 0 14px', letterSpacing: '-0.5px' }}>
          그림은 재능보다<br />보는 법에서 시작해요
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: K.sub, margin: 0 }}>
          드로잉·색채·유화·조소를<br />4~5명 소수로 차근차근 배우는<br />작은 미술 스튜디오입니다.
        </p>
      </section>

      {/* 이런 곳이에요 */}
      <Section title="이런 곳이에요">
        {[
          ['원리로 배워요', '따라 그리기가 아니라, 왜 그렇게 보이는지부터 알려 드려요.'],
          ['한 사람씩 봐요', '한 수업에 4~5명. 매번 내 그림에 대한 이야기를 들어요.'],
          ['내 속도로 와요', '언제든 시작하고, 원하는 날을 앱에서 골라 와요.'],
        ].map(([t, d]) => (
          <div key={t} style={{ padding: '16px 0', borderTop: `1px solid ${K.line}` }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{t}</div>
            <div style={bodyText}>{d}</div>
          </div>
        ))}
      </Section>

      {/* 수업 */}
      <Section title="수업">
        <p style={{ ...bodyText, margin: '0 0 14px' }}>모두 <b style={{ color: K.ink }}>4주 4회</b>, 주 1회 소수 정예로 진행해요.<br />수업 뒤 30분~1시간 정도 더 연습하다 가셔도 돼요.</p>
        {COURSES.map(c => (
          <div key={c.key} style={{ background: K.card, border: `1px solid ${K.line}`, borderRadius: 18, padding: '18px 18px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: K.accent }}>{c.for}</div>
            <div style={{ fontSize: 20, fontWeight: 800, margin: '3px 0 6px' }}>{c.name}</div>
            <div style={bodyText}>{c.line}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${K.line}`, fontSize: 15, color: K.sub }}>
              <span>{c.time}</span>
              <span style={{ fontWeight: 800, color: K.ink }}>{c.price}</span>
            </div>
          </div>
        ))}
        <div style={{ background: K.accentSoft, borderRadius: 18, padding: '18px', display: 'flex', gap: 14, alignItems: 'center' }}>
          <img src="/farm/cat-bucket.png" alt="" style={{ width: 56, height: 56, imageRendering: 'pixelated' }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>원데이 체험</div>
            <div style={{ ...bodyText, fontSize: 15 }}>하루만 먼저 경험해 볼 수 있어요.<br />수요일 · 토요일</div>
          </div>
        </div>
      </Section>

      {/* 시작하는 법 */}
      <Section title="시작하는 법">
        {[
          ['가입하기', '1분이면 끝나요.'],
          ['수강권 받기', '원하는 수업과 시작일을 정해요.'],
          ['앱에서 예약하기', '달력에서 날짜와 시간을 골라요.'],
          ['수업 오기', '끝나면 피드백과 작품 사진이 기록에 남아요.'],
        ].map(([t, d], i) => (
          <div key={t} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 99, background: K.accent, color: '#fff', fontSize: 16, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{t}</div>
              <div style={bodyText}>{d}</div>
            </div>
          </div>
        ))}
      </Section>

      {/* 여는 시간 */}
      <Section title="여는 시간">
        <div style={{ background: K.card, border: `1px solid ${K.line}`, borderRadius: 18, padding: '4px 18px' }}>
          {[['화 · 수 · 목', '오후 2시 · 4시 · 저녁 7시'], ['토 · 일', '낮 11시 ~ 오후'], ['월 · 금', '쉬어요']].map(([d, t], i) => (
            <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderTop: i ? `1px solid ${K.line}` : 'none', fontSize: 17 }}>
              <span style={{ fontWeight: 800 }}>{d}</span>
              <span style={{ color: i === 2 ? K.sub : K.ink }}>{t}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setSheet(true)} style={{ display: 'block', width: '100%', marginTop: 10, padding: '14px', borderRadius: 14, border: `1px solid ${K.accent}`,
          background: 'none', color: K.accent, fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
          수업별 시간표 보기
        </button>
      </Section>

      {/* 자주 묻는 질문 */}
      <Section title="자주 묻는 질문">
        {FAQ.map(([q, a], i) => (
          <div key={q} style={{ borderTop: `1px solid ${K.line}` }}>
            <button onClick={() => setFaq(faq === i ? -1 : i)}
              style={{ width: '100%', textAlign: 'left', padding: '17px 0', border: 'none', background: 'none', fontFamily: 'inherit',
                fontSize: 17, fontWeight: 700, color: K.ink, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
              {q}<span style={{ color: K.accent, fontSize: 20, lineHeight: 1 }}>{faq === i ? '−' : '+'}</span>
            </button>
            {faq === i && <div style={{ ...bodyText, paddingBottom: 16 }}>{a}</div>}
          </div>
        ))}
      </Section>

      {/* 하단 고정 버튼 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 390,
        padding: '14px 18px 22px', background: `linear-gradient(rgba(250,245,236,0), ${K.bg} 30%)` }}>
        <Link href="/signup" style={{ display: 'block', textAlign: 'center', padding: '17px', borderRadius: 16, background: K.accent,
          color: '#fff', fontSize: 18, fontWeight: 800, textDecoration: 'none' }}>
          가입하고 시작하기
        </Link>
        <button onClick={() => setSheet(true)} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 10, fontSize: 15, fontWeight: 700,
          color: K.sub, background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
          먼저 시간표만 볼게요
        </button>
      </div>

      {/* 시간표 한눈에 보기 — 아래에서 올라오는 시트 */}
      {sheet && (
        <div onClick={() => setSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,31,0.35)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 390, maxHeight: '86vh', overflowY: 'auto', background: K.bg,
            borderRadius: '24px 24px 0 0', padding: '12px 22px 22px' }}>
            <div style={{ width: 40, height: 5, borderRadius: 9, background: K.line, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ fontSize: 23, fontWeight: 800, margin: 0 }}>시간표</h2>
              <button onClick={() => setSheet(false)} style={{ border: 'none', background: 'none', fontSize: 15, fontWeight: 700, color: K.sub, fontFamily: 'inherit', cursor: 'pointer' }}>닫기</button>
            </div>
            <p style={{ fontSize: 15, color: K.sub, margin: '6px 0 14px' }}>월·금은 쉬어요. 원하는 날짜·시간을 골라 신청해요.</p>
            {TIMES.map(([name, rows]) => (
              <div key={name} style={{ background: K.card, border: `1px solid ${K.line}`, borderRadius: 16, padding: '12px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{name}</div>
                {rows.map(([d, t]) => (
                  <div key={d} style={{ display: 'flex', gap: 12, fontSize: 16, padding: '3px 0' }}>
                    <span style={{ width: 86, fontWeight: 700, color: K.accent }}>{d}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ position: 'sticky', bottom: -22, margin: '0 -22px -22px', padding: '12px 22px 22px', background: `linear-gradient(rgba(250,245,236,0), ${K.bg} 30%)` }}>
              <Link href="/student" style={{ display: 'block', textAlign: 'center', padding: '17px', borderRadius: 16, background: K.accent,
                color: '#fff', fontSize: 18, fontWeight: 800, textDecoration: 'none' }}>
                수업 신청하러 가기
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function Section({ title, children }) {
  return (
    <section style={{ padding: '30px 24px 6px' }}>
      <h2 style={{ fontSize: 23, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.3px' }}>{title}</h2>
      {children}
    </section>
  )
}

const bodyText = { fontSize: 16, lineHeight: 1.7, color: K.sub }
