import { openURL } from '@apps-in-toss/web-framework'

/** 검색어로 네이버지도 장소 검색 결과 페이지 링크를 생성해요. (좌표 변환이 필요 없어 항상 정확해요) */
export function buildNaverMapSearchUrl(query: string): string | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  return `https://map.naver.com/p/search/${encodeURIComponent(trimmed)}`
}

/**
 * 카카오 장소 검색 결과에 포함된 `place_url`(장소 상세 페이지 링크)을 우선 사용하고,
 * 없으면 이름/주소로 카카오맵 검색 링크를 만들어요.
 */
export function buildKakaoMapUrl(place: {
  place_url?: string
  place_name?: string
  address_name?: string
  road_address_name?: string
}): string | null {
  if (place.place_url) {
    return place.place_url.startsWith('http') ? place.place_url : `https://${place.place_url}`
  }

  const query = [place.place_name, place.road_address_name || place.address_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  if (!query) return null
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`
}

/**
 * 카카오맵/네이버지도 등 외부 지도 링크를 열어요.
 * 앱인토스 환경에서는 `openURL`로 기기의 기본 브라우저나 지도 앱을 실행하고,
 * 지원하지 않는 환경(일반 웹 브라우저 등)에서는 새 탭으로 열어요.
 */
export async function openExternalMapUrl(url: string): Promise<void> {
  try {
    await openURL(url)
    return
  } catch {
    // openURL을 지원하지 않는 환경이면 새 탭으로 대체해요.
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export type ShareResult = 'shared' | 'copied' | 'failed'

/**
 * 텍스트를 OS 기본 공유 시트로 공유해요. 카카오톡이 설치돼 있다면
 * 사용자가 목록에서 카카오톡을 선택해 바로 공유할 수 있어요.
 * `navigator.share`를 지원하지 않는 환경에서는 클립보드로 복사해요.
 */
export async function shareText(message: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message })
      return 'shared'
    } catch (error) {
      // 사용자가 공유 시트를 취소한 경우엔 실패로 처리하지 않아요.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'shared'
      }
      // navigator.share 자체가 실패하면 클립보드 복사로 대체해요.
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message)
      return 'copied'
    }
  } catch {
    // ignore
  }

  return 'failed'
}
