import type { KakaoMarkerImage, KakaoMaps } from '../../types/kakao'

function toSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 토스 스타일의 핀 모양 SVG 마커 이미지(data URL)를 만들어요. */
export function createTossPinImage(fill: string, label: string) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="46" height="58" viewBox="0 0 46 58">
    <path d="M23 0C12 0 4 8 4 19c0 15 19 39 19 39s19-24 19-39C42 8 34 0 23 0z" fill="${fill}"/>
    <circle cx="23" cy="21" r="11" fill="#ffffff" opacity="0.18"/>
    <text x="23" y="24" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="800" fill="#fff">${label}</text>
  </svg>
  `.trim()
  return toSvgDataUrl(svg)
}

/** 출발지 마커 색상 (인원이 더 많으면 순환해요) */
export const SOURCE_COLORS = ['#3182F6', '#6B7280', '#059669', '#D97706', '#DC2626']
export const MID_MARKER_IMAGE = createTossPinImage('#AA3BFF', 'M')

/** 커스텀 마커 이미지를 만들어요. SDK가 지원하지 않으면 undefined를 돌려줘 기본 마커를 쓰게 해요. */
export function createMarkerImage(
  kakao: KakaoMaps,
  imageSrc: string,
  width = 46,
  height = 58,
): KakaoMarkerImage | undefined {
  try {
    if (!kakao.MarkerImage) return undefined
    const size = kakao.Size ? new kakao.Size(width, height) : { width, height }
    return new kakao.MarkerImage(imageSrc, size)
  } catch {
    return undefined
  }
}
