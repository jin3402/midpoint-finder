import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TossAds } from '@apps-in-toss/web-framework'
import { useTossBanner } from './useTossBanner'

vi.mock('@apps-in-toss/web-framework', () => ({
  TossAds: {
    initialize: Object.assign(vi.fn(), { isSupported: vi.fn() }),
    attachBanner: vi.fn(),
  },
}))

describe('useTossBanner', () => {
  it('토스 앱 밖에서 isSupported()가 예외를 던지면 미지원으로 보고 초기화하지 않는다', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(TossAds.initialize.isSupported).mockImplementation(() => {
      throw new Error('fetchTossAd_isSupported is not a constant handler')
    })

    const { result } = renderHook(() => useTossBanner())
    expect(result.current.isSupported).toBe(false)
    expect(TossAds.initialize).not.toHaveBeenCalled()
  })

  it('지원하는 환경에서는 한 번 초기화한다', () => {
    vi.mocked(TossAds.initialize.isSupported).mockReturnValue(true)
    const { result } = renderHook(() => useTossBanner())
    expect(result.current.isSupported).toBe(true)
    expect(TossAds.initialize).toHaveBeenCalledTimes(1)
  })
})
