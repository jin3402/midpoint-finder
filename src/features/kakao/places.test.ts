import { describe, expect, it, vi } from 'vitest'
import type {
  KakaoGeocoder,
  KakaoPlaces,
  KakaoPlacesCallback,
  KakaoPlacesResult,
  KakaoServicesStatus,
} from '../../types/kakao'
import {
  collectNearbyPlaces,
  MAX_RECOMMENDATIONS,
  RECOMMENDATION_RADIUS_STEPS_M,
  resolveRegionName,
  searchPlaceCoords,
} from './places'

const Status: KakaoServicesStatus = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' }

function place(id: string, distance: number): KakaoPlacesResult {
  return { id, place_name: `장소 ${id}`, x: '127', y: '37.5', distance: String(distance) }
}

function placesWith(categorySearch: KakaoPlaces['categorySearch']): KakaoPlaces {
  return { keywordSearch: vi.fn(), categorySearch }
}

describe('searchPlaceCoords', () => {
  it('첫 번째 검색 결과의 좌표를 숫자로 돌려준다', async () => {
    const places: KakaoPlaces = {
      keywordSearch: (_keyword, callback) => callback([{ x: '127.0276', y: '37.4979' }], 'OK'),
      categorySearch: vi.fn(),
    }
    await expect(searchPlaceCoords(places, Status, ' 강남역 ')).resolves.toEqual({
      lat: 37.4979,
      lng: 127.0276,
    })
  })

  it('결과가 없거나 빈 검색어면 null', async () => {
    const places: KakaoPlaces = {
      keywordSearch: (_keyword, callback) => callback([], 'ZERO_RESULT'),
      categorySearch: vi.fn(),
    }
    await expect(searchPlaceCoords(places, Status, '없는곳')).resolves.toBeNull()
    await expect(searchPlaceCoords(places, Status, '   ')).resolves.toBeNull()
  })
})

describe('collectNearbyPlaces', () => {
  const base = { Status, center: {}, categoryCode: 'FD6', sortBy: 'distance' }

  it('반경을 넓혀 가며 모으고, 중복을 없앤 뒤 가까운 순으로 정렬한다', async () => {
    const byRadius: Record<number, KakaoPlacesResult[]> = {
      3000: [place('a', 900), place('b', 100)],
      6000: [place('b', 100), place('c', 2500)],
    }
    const categorySearch = vi.fn<KakaoPlaces['categorySearch']>((_code, callback, options) => {
      callback(byRadius[options!.radius!] ?? [], 'OK', { hasNextPage: false })
    })

    const result = await collectNearbyPlaces({ ...base, places: placesWith(categorySearch) })

    expect(result?.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    // 결과가 50개에 못 미치면 모든 반경 단계를 한 번씩 조회해요.
    expect(categorySearch).toHaveBeenCalledTimes(RECOMMENDATION_RADIUS_STEPS_M.length)
  })

  it('한 반경에서 다음 페이지가 있으면 최대 3페이지까지 넘기고, 50개가 모이면 멈춘다', async () => {
    let next = 0
    const categorySearch = vi.fn((_code: string, callback: KakaoPlacesCallback) => {
      const page = Array.from({ length: 15 }, () => place(String(next++), next))
      callback(page, 'OK', { hasNextPage: true })
    })

    const result = await collectNearbyPlaces({ ...base, places: placesWith(categorySearch) })

    expect(result).toHaveLength(MAX_RECOMMENDATIONS)
    // 3000m 반경 3페이지(45개) + 6000m 반경 1페이지에서 50개를 넘겨 멈춰요.
    expect(categorySearch).toHaveBeenCalledTimes(4)
  })

  it('hasNextPage를 주지 않으면 결과 개수(15개 미만이면 마지막)로 판단한다', async () => {
    const categorySearch = vi.fn((_code: string, callback: KakaoPlacesCallback) => {
      callback([place('only', 10)], 'OK')
    })
    await collectNearbyPlaces({ ...base, places: placesWith(categorySearch) })
    expect(categorySearch).toHaveBeenCalledTimes(RECOMMENDATION_RADIUS_STEPS_M.length)
  })

  it('오류 응답은 빈 결과로 넘기고, 더 최신 검색이 시작되면 null을 돌려준다', async () => {
    const failing = vi.fn((_code: string, callback: KakaoPlacesCallback) => callback([], 'ERROR'))
    await expect(collectNearbyPlaces({ ...base, places: placesWith(failing) })).resolves.toEqual([])

    const ok = vi.fn((_code: string, callback: KakaoPlacesCallback) => callback([place('x', 1)], 'OK'))
    await expect(
      collectNearbyPlaces({ ...base, places: placesWith(ok), isStale: () => true }),
    ).resolves.toBeNull()
    expect(ok).toHaveBeenCalledTimes(1)
  })
})

describe('resolveRegionName', () => {
  it('행정동(H) 이름을 우선 쓴다', async () => {
    const geocoder: KakaoGeocoder = {
      coord2RegionCode: (_lng, _lat, callback) =>
        callback(
          [
            {
              region_type: 'B',
              region_1depth_name: '서울특별시',
              region_2depth_name: '중구',
              region_3depth_name: '충무로1가',
            },
            {
              region_type: 'H',
              region_1depth_name: '서울특별시',
              region_2depth_name: '중구',
              region_3depth_name: '명동',
            },
          ],
          'OK',
        ),
      coord2Address: vi.fn(),
    }
    await expect(resolveRegionName(geocoder, Status, { lat: 37.56, lng: 126.98 })).resolves.toBe(
      '서울특별시 중구 명동',
    )
  })

  it('지역 코드 조회가 실패하면 주소 조회로 한 번 더 시도한다', async () => {
    const geocoder: KakaoGeocoder = {
      coord2RegionCode: (_lng, _lat, callback) => callback([], 'ZERO_RESULT'),
      coord2Address: (_lng, _lat, callback) =>
        callback([{ address: null, road_address: { address_name: '서울 중구 세종대로 110' } }], 'OK'),
    }
    await expect(resolveRegionName(geocoder, Status, { lat: 37.56, lng: 126.98 })).resolves.toBe(
      '서울 중구 세종대로 110',
    )
  })
})
