// 수업 나열 공통 순서 — 드로잉 → 페인팅 → 조소 → 자율창작 → 모임.
// 같은 카테고리 안에서는 이름 가나다순. (학생 커리큘럼 페이지의 CAT_ORDER와 동일한 기준)
export const CATEGORY_ORDER = ['drawing', 'painting', 'sculpture', 'free', 'meeting']

export function sortCoursesByCategory(list) {
  return [...list].sort((a, b) => {
    const oa = CATEGORY_ORDER.indexOf(a.category), ob = CATEGORY_ORDER.indexOf(b.category)
    if (oa !== ob) return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob)
    return (a.name || '').localeCompare(b.name || '')
  })
}
