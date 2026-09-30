import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

type CategorySearch = (
  code: string,
  callback: (data: unknown[], status: string, page: unknown) => void,
) => void

const defaultCategorySearch: CategorySearch = (_code, callback) => {
  callback(
    [{ id: '1', place_name: '테스트 식당', x: '127', y: '37.5', distance: '120' }],
    'OK',
    { hasNextPage: false },
  )
}

/** 테스트에 필요한 만큼만 흉내 낸 Kakao Maps SDK. load() 이후에 services와 생성자가 생겨요. */
function fakeKakaoMaps(categorySearch: CategorySearch = defaultCategorySearch) {
  const Status = { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' }
  class Places {
    keywordSearch(keyword: string, callback: (data: unknown[], status: string) => void) {
      const coords = COORDS[keyword]
      if (!coords) return callback([], Status.ZERO_RESULT)
      callback([{ place_name: keyword, ...coords }], Status.OK)
    }
    categorySearch(code: string, callback: (data: unknown[], status: string, page: unknown) => void) {
      categorySearch(code, callback)
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
  cleanup()
  vi.unstubAllEnvs()
})

/** SDK가 이미 준비된 상태에서 두 출발지로 결과 화면까지 이동해요. */
async function renderResultStep(maps: KakaoMaps) {
  maps.load(() => {})
  window.kakao = { maps }
  const view = render(
    <TDSMobileAITProvider>
      <MiddlePointFinder />
    </TDSMobileAITProvider>,
  )
  const inputs = view.container.querySelectorAll('input')
  fireEvent.change(inputs[0], { target: { value: '강남역' } })
  fireEvent.change(inputs[1], { target: { value: '서울역' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '중간지점 찾기' }))
  })
  await screen.findByText('← 다시 검색하기')
  return view
}

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

  it('카테고리를 빠르게 바꿔도 늦게 끝난 이전 검색 결과가 덮어쓰지 않는다', async () => {
    let releaseRestaurants = () => {}
    const restaurantsGate = new Promise<void>((resolve) => {
      releaseRestaurants = resolve
    })
    const categorySearch: CategorySearch = (code, callback) => {
      const name = code === 'CE7' ? '테스트 카페' : '테스트 식당'
      const respond = () =>
        callback([{ id: code, place_name: name, x: '127', y: '37.5', distance: '50' }], 'OK', {
          hasNextPage: false,
        })
      // 맛집(FD6) 검색은 카페 검색이 끝난 뒤에 응답하게 해요.
      if (code === 'FD6') void restaurantsGate.then(respond)
      else respond()
    }
    await renderResultStep(fakeKakaoMaps(categorySearch))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '카페' }))
    })
    expect(await screen.findByText('테스트 카페')).toBeTruthy()

    await act(async () => {
      releaseRestaurants()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(screen.queryByText('테스트 식당')).toBeNull()
    expect(screen.getByText('테스트 카페')).toBeTruthy()
  }, 20_000)
})
