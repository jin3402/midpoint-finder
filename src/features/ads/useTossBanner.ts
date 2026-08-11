import { useCallback, useEffect, useState } from 'react'
import { TossAds, type TossAdsAttachBannerOptions } from '@apps-in-toss/web-framework'

/**
 * 배너 광고 SDK 초기화와 배너 부착을 함께 처리하는 훅.
 * 여러 컴포넌트에서 호출해도 안전하며, 이미 초기화된 경우 중복 초기화를 시도하지 않습니다.
 */
export function useTossBanner() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    if (isInitialized) return

    if (!TossAds.initialize.isSupported()) {
      setIsSupported(false)
      console.warn('배너 광고 기능을 사용할 수 없는 환경이에요.')
      return
    }

    setIsSupported(true)
    TossAds.initialize({
      callbacks: {
        onInitialized: () => setIsInitialized(true),
        onInitializationFailed: (error) => {
          console.error('배너 광고 SDK 초기화 실패:', error)
        },
      },
    })
  }, [isInitialized])

  const attachBanner = useCallback(
    (adGroupId: string, element: HTMLElement, options?: TossAdsAttachBannerOptions) => {
      if (!isInitialized) return
      return TossAds.attachBanner(adGroupId, element, options)
    },
    [isInitialized],
  )

  return { isInitialized, isSupported, attachBanner }
}
