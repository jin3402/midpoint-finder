import { act, fireEvent, render, screen } from '@testing-library/react'
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KakaoMaps } from '../../types/kakao'
import MiddlePointFinder from './MiddlePointFinder'

vi.mock('../ads/useFullScreenAd', () => ({
  useFullScreenAd: () => ({ showAd: async () => 'skipped' }),
}))
vi.mock('../promotion/usePromotionReward', () => ({
  usePromotionReward: () => ({ grantOnce: async () => ({ status: 'unsupported' }) }),
}))

const COORDS: Record<string, { x: string; y: string }> = {
  강남역: { x: '127.0276', y: '37.4979' },
  서울역: { x: '126.9707', y: '37.5547' },
}

/** 테스트에 필요한 만큼만 흉내 낸 Kakao Maps SDK. load() 이후에 services와 생성자가 생겨요. */
function fakeKakaoMaps() {
  const Status = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' }
  class Places {
    keywordSearch(keyword: string, callback: (data: unknown[], status: string) => void) {
      const coords = COORDS[keyword]
      if (!coords) return callback([], Status.ZERO_RESULT)
      callback([{ place_name: keyword, ...coords }], Status.OK)
    }
    categorySearch(_code: string, callback: (data: unknown[], status: string, page: unknown) => void) {
      callback(
        [{ id: '1', place_name: '테스트 식당', x: '127', y: '37.5', distance: '120' }],
        Status.OK,
        { hasNextPage: false },
      )
    }
  }
  class Geocoder {
    coord2RegionCode(_lng: number, _lat: number, callback: (result: unknown[], status: string) => void) {
      callback(
        [
          {
            region_type: 'H',
            region_1depth_name: '서울특별시',
            region_2depth_name: '중구',
            region_3depth_name: '명동',
          },
        ],
        Status.OK,
      )
    }
  }
  const maps: Record<string, unknown> = {
    load: (callback: () => void) => {
      Object.assign(maps, {
        services: { Places, Geocoder, Status, SortBy: { DISTANCE: 'distance' } },
        Map: class {
          setBounds() {}
          panTo() {}
        },
        LatLng: class {
          lat: number
          lng: number
          constructor(lat: number, lng: number) {
            this.lat = lat
            this.lng = lng
          }
        },
        LatLngBounds: class {
          extend() {}
        },
        Marker: class {
          setMap() {}
        },
        MarkerImage: class {},
        Size: class {},
      })
      callback()
    },
  }
  return maps as unknown as KakaoMaps
}

beforeEach(() => {
  vi.stubEnv('VITE_KAKAO_MAP_APPKEY', 'test-key')
  delete window.kakao
  document.getElementById('kakao-maps-sdk')?.remove()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('MiddlePointFinder', () => {
  it('입력 화면에서 SDK를 불러와, 결과 화면으로 가기 전에도 출발지를 검색할 수 있다', async () => {
    const { container } = render(
      <TDSMobileAITProvider>
        <MiddlePointFinder />
      </TDSMobileAITProvider>,
    )

    // 이전 코드는 결과 화면에서만 SDK를 주입해서, 입력 화면의 검색이 항상
    // "지도 장소 검색 서비스를 불러오지 못했어요."로 끝났어요.
    const script = document.getElementById('kakao-maps-sdk')
    expect(script).not.toBeNull()

    await act(async () => {
      window.kakao = { maps: fakeKakaoMaps() }
      script!.dispatchEvent(new Event('load'))
    })

    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0], { target: { value: '강남역' } })
    fireEvent.change(inputs[1], { target: { value: '서울역' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '중간지점 찾기' }))
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(await screen.findByText('← 다시 검색하기')).toBeTruthy()
    expect(await screen.findByText('대략적인 위치: 서울특별시 중구 명동')).toBeTruthy()
    expect(await screen.findByText('테스트 식당')).toBeTruthy()
  }, 20_000)
})
