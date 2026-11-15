import { buildNaverMapSearchUrl } from '../share/shareUtils'
import type { KakaoPlacesResult } from '../../types/kakao'

/** 장소 이름과 주소로 네이버지도 검색어를 만들어요. */
export function placeSearchQuery(place: KakaoPlacesResult) {
  const name = place.place_name || '추천 장소'
  const address = place.road_address_name || place.address_name || ''
  return [name, address].filter(Boolean).join(' ')
}

function joinLines(lines: Array<string | null>) {
  return lines.filter((line): line is string => line !== null).join('\n')
}

/** 추천 장소 하나를 공유할 때 쓰는 문구예요. */
export function buildPlaceShareMessage(place: KakaoPlacesResult) {
  const name = place.place_name || '추천 장소'
  const address = place.road_address_name || place.address_name || ''
  const mapUrl = buildNaverMapSearchUrl(placeSearchQuery(place))
  return joinLines([
    `📍 ${name}`,
    address || null,
    mapUrl ? `네이버지도로 보기: ${mapUrl}` : null,
    '',
    '중간지점찾기로 찾은 곳이에요 🙂',
  ])
}

/** 계산한 중간지점(지역명)을 공유할 때 쓰는 문구예요. */
export function buildMidpointShareMessage(regionText: string | null) {
  const mapUrl = regionText ? buildNaverMapSearchUrl(regionText) : null
  return joinLines([
    '📍 우리의 중간지점',
    regionText || null,
    mapUrl ? `네이버지도로 보기: ${mapUrl}` : null,
    '',
    '중간지점찾기로 계산했어요 🙂',
  ])
}
