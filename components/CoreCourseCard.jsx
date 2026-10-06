'use client'
import CoreDocView from './CoreDocView'
import CourseWeeklyTimetable from './CourseWeeklyTimetable'
import { hasRichDoc, DEFAULT_CORE_DOC } from '../lib/coreDoc'

// 핵심 내용 화면의 수업 카드 한 장.
//
// 2026-10-06 에 page.js 에서 분리했다 — 미리보기 하니스가 **실제 이 코드**를 렌더해야
// 화면 판단이 거짓이 되지 않기 때문(목업을 따로 두면 곧 어긋난다).
//
// ⚠️ 카드의 overflow 는 hidden 이 아니라 clip — hidden 은 이 카드를 스크롤 컨테이너로
//    만들어 안쪽 CoreDocView 의 모듈 그룹 스티키 헤더를 조용히 죽인다(2026-10-05).
// ⚠️ 색은 테마 변수만. 하드코딩하면 8색 테마 중 하나에서만 맞는다.
export default function CoreCourseCard({ course, isOpen, onToggle, onBook, onSteps, cardRef }) {
  // 저장된 리치 문서 우선 → 없고 텍스트·사진도 없으면 예시 샘플
  const savedRich = hasRichDoc(course.coreDoc)
  const emptyCore = !savedRich && !course.coreContent && course.coreImages.length === 0
  const richDoc = savedRich ? course.coreDoc : (emptyCore ? DEFAULT_CORE_DOC : null)

  const btnPrimary = {
    fontSize: 12.5, padding: '10px 18px', borderRadius: 8, background: 'var(--ac)', color: '#fff',
    border: 'none', cursor: 'pointer', fontFamily: 'Nunito,sans-serif', fontWeight: 800, letterSpacing: -0.2,
  }
  const btnQuiet = {
    fontSize: 12, padding: 0, background: 'none', color: 'var(--tmu)', border: 'none',
    borderBottom: '1.5px solid var(--line)', cursor: 'pointer', fontFamily: 'Nunito,sans-serif', fontWeight: 800, letterSpacing: -0.2,
  }

  return (
    <div ref={cardRef}
      style={{
        borderRadius: 12, marginBottom: 8, background: 'var(--surf)', overflow: 'clip',
        border: `1px solid ${isOpen ? 'var(--ac)' : 'var(--line)'}`,
        boxShadow: isOpen ? '0 2px 14px rgb(var(--ac-rgb) / 0.1)' : 'none', transition: 'border-color 0.15s',
      }}>

      {/* 헤더 — 눌러서 펼치고 접기 */}
      <div onClick={onToggle} style={{ padding: '14px 15px', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: isOpen ? 'var(--acTx)' : 'var(--td)', letterSpacing: -0.35 }}>{course.name}</span>
            {course.isEnrolled && (
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, color: 'var(--surf)', background: 'var(--ac)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>수강 중</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--tmu)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {course.steps.length}회차{course.teacher ? ` · 강사 ${course.teacher}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 18, color: isOpen ? 'var(--ac)' : 'var(--tl)', display: 'inline-block', transition: 'transform 0.18s', transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>›</span>
      </div>

      {/* 펼친 내용 — 리치 문서가 있으면 그것, 없으면 텍스트+사진 */}
      {isOpen && richDoc && (
        <div style={{ borderTop: '1px solid var(--line)', margin: '0 -15px' }}>
          <CoreDocView doc={richDoc} sample={!savedRich} onCta={onSteps} />
          {/* ⚠️ 「회차 보기」 버튼을 여기 두지 말 것 — 바로 위 문서 CTA 가 이미 그 동작이다(중복).
              ⚠️ 예약 버튼은 시간표 **아래**다 — 위에 두면 문서 CTA 와 버튼 둘이 붙어 CTA 가 두 번
                 나온 꼴이 되고, 읽는 순서(내용 → 언제 하나 → 예약)와도 어긋난다. */}
          <div style={{ padding: '18px 15px 18px' }}>
            <CourseWeeklyTimetable schedules={course.schedules} onPickTime={(dw, start) => onBook(dw, start)} />
            <button onClick={() => onBook()} style={{ ...btnPrimary, width: '100%', marginTop: 16, padding: '13px 18px', fontSize: 13.5 }}>
              이 수업 예약하기
            </button>
          </div>
        </div>
      )}

      {isOpen && !richDoc && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '15px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--tm)', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 8 }}>핵심 내용</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: course.coreContent ? 'var(--td)' : 'var(--tmu)' }}>
            {course.coreContent || '핵심 내용을 준비 중이에요 🐾'}
          </div>
          {course.coreImages.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {course.coreImages.map((url, i) => (
                <img key={url + i} src={url} alt="" loading="lazy"
                  style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', display: 'block', marginBottom: 8, boxSizing: 'border-box' }}/>
              ))}
            </div>
          )}
          <CourseWeeklyTimetable schedules={course.schedules} onPickTime={(dw, start) => onBook(dw, start)} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={() => onBook()} style={{ ...btnPrimary, flex: 1 }}>이 수업 예약하기</button>
            <button onClick={onSteps} style={btnQuiet}>회차 보기</button>
          </div>
        </div>
      )}
    </div>
  )
}
