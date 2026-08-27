// 역할 체계 단일 소스 (2026-08-09)
//
//   owner(=role 'admin') ⊃ teacher(=role 'teacher') ⊃ (없음)
//   student / artist 는 별개 트랙.
//
// ⚠️ 강사와 오너를 문자열로 직접 비교하지 말고 이 함수들을 쓸 것.
//    예전엔 강사 = 'admin' 이라 강사도 수강권 부여·회원 삭제가 됐다.
//    양승민 쌤처럼 오너 겸 강사인 경우가 있어 admin 은 강사 기능을 항상 포함한다.

export const ROLE = { OWNER: 'admin', TEACHER: 'teacher', STUDENT: 'student', ARTIST: 'artist' }

const roleOf = u => (typeof u === 'string' ? u : u?.user_metadata?.role) || ''

// 오너(스튜디오 총괄) — 수강권 부여·회원 삭제·정산·잠금일 등 운영 전권
export const isOwner = u => roleOf(u) === ROLE.OWNER

// 강사 업무 권한 — 오너도 포함(오너 겸 강사)
export const isTeacher = u => {
  const r = roleOf(u)
  return r === ROLE.TEACHER || r === ROLE.OWNER
}

// 직원(강사·관리자)으로 가입했지만 아직 오너 승인 전인가.
// ⚠️ approved 는 예전엔 저장만 되고 아무도 검사하지 않아, 강사 가입 즉시 권한이 생겼다.
// ⚠️ 관리자까지 포함하는 이유: 관리자 가입은 승인 전에도 세션이 생기므로, 여기서 막지 않으면
//    승인 전에 운영 전권(수강권 부여·회원 삭제)이 열린다. RLS 의 is_admin() 도 같은 규칙을
//    쓴다(approved = false 는 관리자로 치지 않는다) — 한쪽만 막으면 반쪽만 막힌다.
export const isPendingStaff = u => {
  const r = roleOf(u)
  if (r !== ROLE.TEACHER && r !== ROLE.OWNER) return false
  const a = typeof u === 'string' ? true : u?.user_metadata?.approved
  return a === false
}

// 부르던 이름 유지(호출부 호환)
export const isPendingTeacher = isPendingStaff

// 오너만 가능한 운영 기능
export const canManageMembers = isOwner   // 회원 삭제·수강권 부여
export const canManageSchedule = isOwner  // 수업 개설·잠금일
export const canSeeFinance = isOwner      // 입금·정산

// 로그인 후 도착할 홈
export function homePathFor(u) {
  const r = roleOf(u)
  if (r === ROLE.OWNER) return '/admin'
  if (r === ROLE.TEACHER) return '/teacher'
  if (r === ROLE.ARTIST) return '/artist'
  return '/student'
}
