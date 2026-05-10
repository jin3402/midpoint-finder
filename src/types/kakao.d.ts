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

export interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds): void
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
  MarkerImage: new (
    imageSrc: string,
    options: { width: number; height: number },
  ) => KakaoMarkerImage
}

export type KakaoGeocodeStatus = 'OK' | 'ZERO_RESULT' | 'ERROR'

export interface KakaoGeocoderResult {
  x: string | number
  y: string | number
  address?: { address_name?: string }
  road_address?: { address_name?: string }
  place_name?: string
}

export interface KakaoGeocoder {
  addressSearch: (
    address: string,
    callback: (results: KakaoGeocoderResult[], status: KakaoGeocodeStatus) => void,
  ) => void
}

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

export interface KakaoKeywordSearchOptions {
  /** 검색 중심 좌표 (카카오 `LatLng` 인스턴스). */
  location?: KakaoLatLng
  /** 중심으로부터 반경(m). */
  radius?: number
  /** 페이지당 결과 수 (기본 15). */
  size?: number
  page?: number
}

export interface KakaoPlaces {
  keywordSearch: (
    keyword: string,
    callback: (data: KakaoPlacesResult[], status: KakaoGeocodeStatus) => void,
    options?: KakaoKeywordSearchOptions,
  ) => void
}

export interface KakaoServicesStatus {
  readonly OK: KakaoGeocodeStatus
  readonly ZERO_RESULT: KakaoGeocodeStatus
  readonly ERROR: KakaoGeocodeStatus
}

export interface KakaoServices {
  Geocoder: new () => KakaoGeocoder
  Places: new () => KakaoPlaces
  Status: KakaoServicesStatus
}

declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMaps
    }
  }
}

export {}

