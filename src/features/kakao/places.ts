import type {
  KakaoGeocoder,
  KakaoLatLng,
  KakaoPlaces,
  KakaoPlacesResult,
  KakaoServicesStatus,
  KakaoSortBy,
} from '../../types/kakao'
import type { LatLng } from '../middle-point/geo'

/** 추천 장소는 최대 이만큼 모아요. */
export const MAX_RECOMMENDATIONS = 50

/**
 * 카카오 카테고리 검색은 한 조건당 최대 45개(15개 × 3페이지)만 줘서,
 * 반경을 넓혀 가며 여러 번 조회해요. 20000m가 카테고리 검색의 최대 반경이에요.
 */
export const RECOMMENDATION_RADIUS_STEPS_M = [3000, 6000, 10000, 15000, 20000]

const PAGE_SIZE = 15
const MAX_PAGES = 3

/** 추천 장소를 구분하는 키예요. (id가 없으면 이름+좌표로 대체) */
export function getPlaceKey(place: KakaoPlacesResult) {
  return String(place.id ?? `${place.place_name}-${place.x}-${place.y}`)
}

/** 키워드(주소·장소명)로 검색해 첫 번째 결과의 좌표를 돌려줘요. 못 찾으면 null이에요. */
export function searchPlaceCoords(
  places: KakaoPlaces,
  Status: KakaoServicesStatus,
  query: string,
): Promise<LatLng | null> {
  const keyword = query.trim()
  if (!keyword) return Promise.resolve(null)

  return new Promise((resolve) => {
    places.keywordSearch(keyword, (data, status) => {
      if (status === Status.OK && data.length > 0) {
        const lat = Number(data[0].y)
        const lng = Number(data[0].x)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          resolve({ lat, lng })
          return
        }
      }
      resolve(null)
    })
  })
}

interface CollectNearbyPlacesOptions {
  places: KakaoPlaces
  Status: KakaoServicesStatus
  center: KakaoLatLng
  categoryCode: string
  sortBy: KakaoSortBy
  /** true를 돌려주면 그 자리에서 검색을 멈추고 null을 돌려줘요. (더 최신 검색이 시작된 경우) */
  isStale?: () => boolean
}

/**
 * 중심 좌표 주변의 카테고리 장소를 반경을 넓혀 가며 모아요.
 * 장소 id로 중복을 없애고, 가까운 순으로 최대 MAX_RECOMMENDATIONS개를 돌려줘요.
 */
export async function collectNearbyPlaces({
  places,
  Status,
  center,
  categoryCode,
  sortBy,
  isStale = () => false,
}: CollectNearbyPlacesOptions): Promise<KakaoPlacesResult[] | null> {
  const fetchPage = (radius: number, page: number) =>
    new Promise<{ data: KakaoPlacesResult[]; hasMore: boolean }>((resolve) => {
      places.categorySearch(
        categoryCode,
        (data, status, pagination) => {
          if (status !== Status.OK) {
            resolve({ data: [], hasMore: false })
            return
          }
          // pagination이 hasNextPage를 주지 않는 경우에 대비해 결과 개수로도 판단해요.
          const hasMore =
            typeof pagination?.hasNextPage === 'boolean'
              ? pagination.hasNextPage
              : data.length >= PAGE_SIZE
          resolve({ data, hasMore })
        },
        { location: center, radius, sort: sortBy, page, size: PAGE_SIZE },
      )
    })

  const seen = new Set<string>()
  const collected: KakaoPlacesResult[] = []

  for (const radius of RECOMMENDATION_RADIUS_STEPS_M) {
    if (collected.length >= MAX_RECOMMENDATIONS) break

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, hasMore } = await fetchPage(radius, page)
      if (isStale()) return null

      for (const place of data) {
        const key = getPlaceKey(place)
        if (seen.has(key)) continue
        seen.add(key)
        collected.push(place)
      }

      if (!hasMore || data.length < PAGE_SIZE || collected.length >= MAX_RECOMMENDATIONS) break
    }
  }

  const distanceOf = (place: KakaoPlacesResult) =>
    Number(place.distance ?? Number.MAX_SAFE_INTEGER)

  return collected
    .slice()
    .sort((a, b) => distanceOf(a) - distanceOf(b))
    .slice(0, MAX_RECOMMENDATIONS)
}

/**
 * 좌표의 지역 이름을 구해요. 행정동(H) 이름을 우선 쓰고,
 * 지역 코드 조회가 실패하면 주소 조회로 한 번 더 시도해요.
 */
export function resolveRegionName(
  geocoder: KakaoGeocoder,
  Status: KakaoServicesStatus,
  point: LatLng,
): Promise<string | null> {
  return new Promise((resolve) => {
    geocoder.coord2RegionCode(point.lng, point.lat, (result, status) => {
      if (status === Status.OK && result.length > 0) {
        const region = result.find((item) => item.region_type === 'H') ?? result[0]
        const regionText = [
          region.region_1depth_name,
          region.region_2depth_name,
          region.region_3depth_name,
        ]
          .filter(Boolean)
          .join(' ')
        resolve(regionText || null)
        return
      }

      geocoder.coord2Address(point.lng, point.lat, (addressResult, addressStatus) => {
        if (addressStatus !== Status.OK || addressResult.length === 0) {
          resolve(null)
          return
        }
        const first = addressResult[0]
        resolve(first.address?.address_name || first.road_address?.address_name || null)
      })
    })
  })
}
