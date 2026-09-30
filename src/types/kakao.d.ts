/**
 * 이 앱에서 쓰는 Kakao Maps JavaScript SDK(`libraries=services`)의 최소 타입이에요.
 * https://apis.map.kakao.com/web/documentation/
 */

export type KakaoLatLng = unknown
export interface KakaoLatLngBounds {
  extend(position: KakaoLatLng): void
}

export interface KakaoMarker {
  setMap(map: KakaoMap | null): void
  setPosition(position: KakaoLatLng): void
  setImage(image: KakaoMarkerImage): void
}

export type KakaoMarkerImage = unknown
export type KakaoSize = unknown

export interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds): void
  panTo(position: KakaoLatLng): void
}

export interface KakaoMaps {
  load: (callback: () => void) => void
  services?: KakaoServices
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level?: number },
  ) => KakaoMap
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  Marker: new (options: {
    position: KakaoLatLng
    image?: KakaoMarkerImage
  }) => KakaoMarker
  MarkerImage?: new (imageSrc: string, size: KakaoSize) => KakaoMarkerImage
  Size?: new (width: number, height: number) => KakaoSize
}

export type KakaoStatus = 'OK' | 'ZERO_RESULT' | 'ERROR'

export interface KakaoPlacesResult {
  id?: string
  place_name?: string
  address_name?: string
  road_address_name?: string
  category_name?: string
  category_group_name?: string
  distance?: string
  place_url?: string
  x: string
  y: string
}

export interface KakaoPagination {
  hasNextPage?: boolean
}

export type KakaoSortBy = unknown

export interface KakaoKeywordSearchOptions {
  /** 검색 중심 좌표 (카카오 `LatLng` 인스턴스). */
  location?: KakaoLatLng
  /** 중심으로부터 반경(m). */
  radius?: number
  /** 페이지당 결과 수 (기본 15). */
  size?: number
  page?: number
}

export interface KakaoCategorySearchOptions extends KakaoKeywordSearchOptions {
  sort?: KakaoSortBy
}

export type KakaoPlacesCallback = (
  data: KakaoPlacesResult[],
  status: KakaoStatus,
  pagination?: KakaoPagination,
) => void

export interface KakaoPlaces {
  keywordSearch: (
    keyword: string,
    callback: KakaoPlacesCallback,
    options?: KakaoKeywordSearchOptions,
  ) => void
  categorySearch: (
    categoryCode: string,
    callback: KakaoPlacesCallback,
    options?: KakaoCategorySearchOptions,
  ) => void
}

export interface KakaoRegionCodeResult {
  /** H: 행정동, B: 법정동 */
  region_type: 'H' | 'B'
  region_1depth_name?: string
  region_2depth_name?: string
  region_3depth_name?: string
}

export interface KakaoCoord2AddressResult {
  address?: { address_name?: string } | null
  road_address?: { address_name?: string } | null
}

export interface KakaoGeocoder {
  coord2RegionCode: (
    lng: number,
    lat: number,
    callback: (result: KakaoRegionCodeResult[], status: KakaoStatus) => void,
  ) => void
  coord2Address: (
    lng: number,
    lat: number,
    callback: (result: KakaoCoord2AddressResult[], status: KakaoStatus) => void,
  ) => void
}

export interface KakaoServicesStatus {
  readonly OK: KakaoStatus
  readonly ZERO_RESULT: KakaoStatus
  readonly ERROR: KakaoStatus
}

export interface KakaoServices {
  Geocoder: new () => KakaoGeocoder
  Places: new () => KakaoPlaces
  Status: KakaoServicesStatus
  SortBy: { DISTANCE: KakaoSortBy; ACCURACY: KakaoSortBy }
}

declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMaps
    }
  }
}

export {}
