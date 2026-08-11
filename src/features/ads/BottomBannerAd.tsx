import { useEffect, useRef } from 'react'
import { useTossBanner } from './useTossBanner'

/** 개발/테스트 전용 배너 광고 ID. 운영 빌드에서는 사용하지 마세요. */
export const TEST_BANNER_AD_GROUP_ID = 'ait-ad-test-banner-id'

/** 콘솔에서 발급한 운영용 배너 광고 그룹 ID. */
export const PRODUCTION_BANNER_AD_GROUP_ID = 'ait.v2.live.e8fc7b67020c41e8'

/** 로컬 개발(vite dev)에서는 테스트 ID, 빌드된 앱에서는 운영 ID를 사용해요. */
const DEFAULT_BANNER_AD_GROUP_ID = import.meta.env.DEV ? TEST_BANNER_AD_GROUP_ID : PRODUCTION_BANNER_AD_GROUP_ID

interface BottomBannerAdProps {
  adGroupId?: string
}

/**
 * 화면 하단에 고정 노출되는 배너 광고.
 * 토스 앱 버전이 낮거나 광고를 지원하지 않는 환경에서는 아무것도 렌더링하지 않아요.
 */
export default function BottomBannerAd({ adGroupId = DEFAULT_BANNER_AD_GROUP_ID }: BottomBannerAdProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { isInitialized, isSupported, attachBanner } = useTossBanner()

  useEffect(() => {
    if (!isInitialized || !containerRef.current) return

    const attached = attachBanner(adGroupId, containerRef.current, {
      theme: 'auto',
      tone: 'blackAndWhite',
      variant: 'expanded',
      callbacks: {
        onAdFailedToRender: (payload) => {
          console.error('배너 광고 렌더링 실패:', payload.error.message)
        },
        onNoFill: (payload) => {
          console.warn('표시할 배너 광고가 없어요:', payload.slotId)
        },
      },
    })

    return () => {
      attached?.destroy()
    }
  }, [isInitialized, adGroupId, attachBanner])

  if (!isSupported) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '96px',
        zIndex: 40,
      }}
    />
  )
}
