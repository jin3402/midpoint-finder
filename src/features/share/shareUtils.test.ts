import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildKakaoMapUrl, buildNaverMapSearchUrl, shareText } from './shareUtils'

vi.mock('@apps-in-toss/web-framework', () => ({ openURL: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildNaverMapSearchUrl', () => {
  it('검색어를 인코딩해 네이버지도 검색 링크를 만든다', () => {
    expect(buildNaverMapSearchUrl(' 서울 중구 명동 ')).toBe(
      'https://map.naver.com/p/search/%EC%84%9C%EC%9A%B8%20%EC%A4%91%EA%B5%AC%20%EB%AA%85%EB%8F%99',
    )
  })

  it('빈 검색어면 null', () => {
    expect(buildNaverMapSearchUrl('   ')).toBeNull()
  })
})

describe('buildKakaoMapUrl', () => {
  it('장소 상세 링크가 있으면 그대로 쓰고, 프로토콜이 없으면 https를 붙인다', () => {
    expect(buildKakaoMapUrl({ place_url: 'http://place.map.kakao.com/123' })).toBe(
      'http://place.map.kakao.com/123',
    )
    expect(buildKakaoMapUrl({ place_url: 'place.map.kakao.com/123' })).toBe(
      'https://place.map.kakao.com/123',
    )
  })

  it('상세 링크가 없으면 이름과 주소로 검색 링크를 만든다', () => {
    expect(buildKakaoMapUrl({ place_name: '카페', road_address_name: '서울 중구' })).toBe(
      'https://map.kakao.com/link/search/%EC%B9%B4%ED%8E%98%20%EC%84%9C%EC%9A%B8%20%EC%A4%91%EA%B5%AC',
    )
    expect(buildKakaoMapUrl({})).toBeNull()
  })
})

describe('shareText', () => {
  it('공유 시트를 쓸 수 있으면 공유한다', async () => {
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { share })
    await expect(shareText('hello')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 'hello' })
  })

  it('공유 시트가 없으면 클립보드에 복사한다', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(shareText('hello')).resolves.toBe('copied')
  })

  it('둘 다 실패하면 failed', async () => {
    vi.stubGlobal('navigator', {
      share: vi.fn(async () => {
        throw new Error('boom')
      }),
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('denied')
        }),
      },
    })
    await expect(shareText('hello')).resolves.toBe('failed')
  })
})
