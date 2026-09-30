import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { grantPromotionReward } from '@apps-in-toss/web-framework'
import { usePromotionReward } from './usePromotionReward'

vi.mock('@apps-in-toss/web-framework', () => ({ grantPromotionReward: vi.fn() }))

const grant = vi.mocked(grantPromotionReward)

afterEach(() => {
  localStorage.clear()
  grant.mockReset()
})

describe('usePromotionReward', () => {
  it('한 번 지급받으면 같은 기기에서는 다시 요청하지 않는다', async () => {
    grant.mockResolvedValue({ key: 'reward-key' } as never)
    const { result } = renderHook(() => usePromotionReward('CODE', 3))

    await expect(result.current.grantOnce()).resolves.toEqual({ status: 'granted', key: 'reward-key' })
    await expect(result.current.grantOnce()).resolves.toEqual({ status: 'already-granted' })
    expect(grant).toHaveBeenCalledTimes(1)
    expect(grant).toHaveBeenCalledWith({ params: { promotionCode: 'CODE', amount: 3 } })
  })

  it('localStorage 접근이 막힌 환경에서도 예외 없이 동작한다', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    grant.mockResolvedValue({ key: 'reward-key' } as never)
    const { result } = renderHook(() => usePromotionReward('CODE_2', 3))

    await expect(result.current.grantOnce()).resolves.toEqual({ status: 'granted', key: 'reward-key' })
  })
})
