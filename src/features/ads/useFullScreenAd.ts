import { useCallback, useEffect, useRef } from 'react'
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'
import { isSupportedSafely } from './isSupported'

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
 * 전면형 광고를 미리 로드하고, 요청 시 표시하는 훅.
 * load → show → (다음 load) 순서를 지키며, 미지원/실패 시 앱 흐름을 막지 않습니다.
 * 로드 상태는 ref로만 들고 있어서 광고가 로드될 때 화면을 다시 그리지 않아요.
 */
export function useFullScreenAd(adGroupId: string = DEFAULT_INTERSTITIAL_AD_GROUP_ID) {
  const isLoadedRef = useRef(false)
  const unregisterLoadRef = useRef<(() => void) | null>(null)

  const preload = useCallback(() => {
    if (!isSupportedSafely(() => loadFullScreenAd.isSupported())) return

    unregisterLoadRef.current?.()
    unregisterLoadRef.current = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === 'loaded') isLoadedRef.current = true
      },
      onError: (error) => {
        console.error('전면 광고 로드 실패:', error)
        isLoadedRef.current = false
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
      if (!isLoadedRef.current || !isSupportedSafely(() => showFullScreenAd.isSupported())) {
        resolve('skipped')
        return
      }

      const finish = (result: ShowAdResult) => {
        isLoadedRef.current = false
        preload()
        resolve(result)
      }

      showFullScreenAd({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === 'dismissed') finish('shown')
          else if (event.type === 'failedToShow') finish('skipped')
        },
        onError: (error) => {
          console.error('전면 광고 표시 실패:', error)
          finish('skipped')
        },
      })
    })
  }, [adGroupId, preload])

  return { showAd }
}
