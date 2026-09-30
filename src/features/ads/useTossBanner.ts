import { useCallback, useEffect, useState } from 'react'
import { TossAds, type TossAdsAttachBannerOptions } from '@apps-in-toss/web-framework'

/**
 * 배너 광고 SDK 초기화와 배너 부착을 함께 처리하는 훅.
 * 지원 여부는 처음 렌더링할 때 한 번 확인하고, 지원하는 환경에서만 초기화해요.
 */
export function useTossBanner() {
  const [isSupported] = useState(() => TossAds.initialize.isSupported())
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!isSupported) {
      console.warn('배너 광고 기능을 사용할 수 없는 환경이에요.')
      return
    }

    let cancelled = false
    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          if (!cancelled) setIsInitialized(true)
        },
        onInitializationFailed: (error) => {
          console.error('배너 광고 SDK 초기화 실패:', error)
        },
      },
    })
    return () => {
      cancelled = true
    }
  }, [isSupported])

  const attachBanner = useCallback(
    (adGroupId: string, element: HTMLElement, options?: TossAdsAttachBannerOptions) => {
      if (!isInitialized) return
      return TossAds.attachBanner(adGroupId, element, options)
    },
    [isInitialized],
  )

  return { isInitialized, isSupported, attachBanner }
}
