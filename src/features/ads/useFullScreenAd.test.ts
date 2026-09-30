import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'
import { useFullScreenAd } from './useFullScreenAd'

vi.mock('@apps-in-toss/web-framework', () => ({
  loadFullScreenAd: Object.assign(vi.fn(() => () => {}), { isSupported: vi.fn(() => true) }),
  showFullScreenAd: Object.assign(vi.fn(), { isSupported: vi.fn(() => true) }),
}))

const load = vi.mocked(loadFullScreenAd)
const show = vi.mocked(showFullScreenAd)

beforeEach(() => {
  load.mockClear()
  show.mockClear()
})

describe('useFullScreenAd', () => {
  it('광고가 아직 로드되지 않았으면 기다리지 않고 건너뛴다', async () => {
    const { result } = renderHook(() => useFullScreenAd('ad-id'))
    await expect(result.current.showAd()).resolves.toBe('skipped')
    expect(show).not.toHaveBeenCalled()
  })

  it('로드된 광고를 보여주고, 닫히면 다음 광고를 미리 로드한다', async () => {
    const { result } = renderHook(() => useFullScreenAd('ad-id'))
    load.mock.calls.at(-1)![0].onEvent({ type: 'loaded' } as never)
    const loadsBefore = load.mock.calls.length

    const shown = result.current.showAd()
    show.mock.calls.at(-1)![0].onEvent({ type: 'dismissed' } as never)

    await expect(shown).resolves.toBe('shown')
    expect(load.mock.calls.length).toBe(loadsBefore + 1)
  })
})
