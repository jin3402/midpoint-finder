/** 추천 카테고리와 카카오 카테고리 그룹 코드 */
export const CATEGORY_CODES = {
  맛집: 'FD6',
  카페: 'CE7',
  볼거리: 'AT4',
} as const

export type Category = keyof typeof CATEGORY_CODES

export const CATEGORIES = Object.keys(CATEGORY_CODES) as Category[]
