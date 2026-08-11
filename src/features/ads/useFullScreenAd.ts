import { useCallback, useEffect, useRef, useState } from 'react'
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'

/** 개발/테스트 전용 전면형 광고 ID. 운영 빌드에서는 사용하지 마세요. */
export const TEST_INTERSTITIAL_AD_GROUP_ID = 'ait-ad-test-interstitial-id'

/** 콘솔에서 발급한 운영용 전면형 광고 그룹 ID. */
export const PRODUCTION_INTERSTITIAL_AD_GROUP_ID = 'ait.v2.live.0e8b811857594307'

/** 로컬 개발(vite dev)에서는 테스트 ID, 빌드된 앱에서는 운영 ID를 사용해요. */
const DEFAULT_INTERSTITIAL_AD_GROUP_ID = import.meta.env.DEV
  ? TEST_INTERSTITIAL_AD_GROUP_ID
  : PRODUCTION_INTERSTITIAL_AD_GROUP_ID

type ShowAdResult = 'shown' | 'skipped'

/**
 * 전면형/보상형 통합 광고를 미리 로드하고, 요청 시 표시하는 훅.
 * load → show → (다음 load) 순서를 지키며, 미지원/실패 시 앱 흐름을 막지 않습니다.
 */
export function useFullScreenAd(adGroupId: string = DEFAULT_INTERSTITIAL_AD_GROUP_ID) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const isLoadedRef = useRef(false)
  const isSupportedRef = useRef(false)
  const unregisterLoadRef = useRef<(() => void) | null>(null)

  const preload = useCallback(() => {
    if (!loadFullScreenAd.isSupported()) {
      isSupportedRef.current = false
      setIsSupported(false)
      return
    }

    isSupportedRef.current = true
    setIsSupported(true)

    unregisterLoadRef.current?.()
    unregisterLoadRef.current = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          isLoadedRef.current = true
          setIsLoaded(true)
        }
      },
      onError: (error) => {
        console.error('전면 광고 로드 실패:', error)
        isLoadedRef.current = false
        setIsLoaded(false)
      },
    })
  }, [adGroupId])

  useEffect(() => {
    preload()
    return () => {
      unregisterLoadRef.current?.()
      unregisterLoadRef.current = null
    }
  }, [preload])

  const showAd = useCallback((): Promise<ShowAdResult> => {
    return new Promise((resolve) => {
      if (!isSupportedRef.current || !isLoadedRef.current || !showFullScreenAd.isSupported()) {
        resolve('skipped')
        return
      }

      showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          switch (event.type) {
            case 'dismissed':
              isLoadedRef.current = false
              setIsLoaded(false)
              preload()
              resolve('shown')
              break
            case 'failedToShow':
              isLoadedRef.current = false
              setIsLoaded(false)
              preload()
              resolve('skipped')
              break
            default:
              break
          }
        },
        onError: (error) => {
          console.error('전면 광고 표시 실패:', error)
          isLoadedRef.current = false
          setIsLoaded(false)
          preload()
          resolve('skipped')
        },
      })
    })
  }, [adGroupId, preload])

  return { isLoaded, isSupported, showAd }
}
