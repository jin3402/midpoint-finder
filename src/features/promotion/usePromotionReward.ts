import { useCallback, useRef } from 'react'
import { grantPromotionReward } from '@apps-in-toss/web-framework'

/**
 * "중간지점 공유하면 3원 지급" 프로모션의 콘솔 테스트용 코드예요.
 * 실제 프로모션을 시작하기 전, 토스 앱(QR 코드 테스트)에서 이 코드로 최소 1회 호출해야
 * 콘솔에서 프로모션을 "시작" 상태로 전환할 수 있어요. (샌드박스 앱에서는 호출해도 인정되지 않아요.)
 */
export const TEST_PROMOTION_CODE = 'TEST_01KY9X39YJ4E78XSQB4ZX7M094'

/**
 * 콘솔에서 프로모션 검수가 끝난 뒤 발급되는 "운영용" 프로모션 코드예요. (TEST_ 접두사 없는 코드)
 * 콘솔에서 "시작하기"를 누르기 직전, 이 값을 콘솔에서 확인한 실제 운영용 코드로 교체해 주세요.
 */
export const PRODUCTION_PROMOTION_CODE = 'REPLACE_WITH_PRODUCTION_PROMOTION_CODE'

/** "공유하기" 성공 시 지급할 포인트(원) 금액이에요. */
export const SHARE_PROMOTION_AMOUNT = 3

/**
 * true인 동안에는 항상 TEST_ 코드로 호출해요.
 *
 * 주의: `npm run build`로 만든 .ait는 QR 코드 테스트와 실제 배포 모두 "운영 빌드"라서
 * `import.meta.env.DEV`로는 두 상황을 구분할 수 없어요. 그래서 아래 플래그로 직접 전환해요.
 *
 * 1) 지금처럼 true인 상태로 빌드 → QR 코드 테스트에서 "공유하기" 1회 호출 → 콘솔에 성공 기록 확인
 * 2) 콘솔에서 "시작하기"를 누르기 전, 위 PRODUCTION_PROMOTION_CODE를 실제 코드로 채우고
 *    이 값을 false로 바꾼 뒤 다시 빌드해서 그 .ait로 재배포해 주세요.
 */
const IS_PROMOTION_TEST_PHASE = true

const DEFAULT_PROMOTION_CODE = IS_PROMOTION_TEST_PHASE ? TEST_PROMOTION_CODE : PRODUCTION_PROMOTION_CODE

const STORAGE_KEY_PREFIX = 'midpoint-finder:promotion-reward:'

/** 일부 WebView·사생활 보호 모드에서는 localStorage 접근 자체가 예외를 던져요. */
function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 저장에 실패해도 지급 결과에는 영향이 없어요.
  }
}

export type GrantPromotionRewardOutcome =
  | { status: 'granted'; key: string }
  | { status: 'already-granted' }
  | { status: 'unsupported' }
  | { status: 'error'; errorCode?: string; message?: string }

/**
 * 프로모션 포인트를 "기기당 1회만" 지급하도록 방어 로직을 포함한 훅.
 * 같은 프로모션 코드에 대해 이미 지급을 시도해 성공한 적이 있으면 다시 호출하지 않아요.
 */
export function usePromotionReward(promotionCode: string = DEFAULT_PROMOTION_CODE, amount = SHARE_PROMOTION_AMOUNT) {
  const isRequestingRef = useRef(false)

  const grantOnce = useCallback(async (): Promise<GrantPromotionRewardOutcome> => {
    const storageKey = `${STORAGE_KEY_PREFIX}${promotionCode}`

    if (readStorage(storageKey) || isRequestingRef.current) {
      return { status: 'already-granted' }
    }

    isRequestingRef.current = true
    try {
      const result = await grantPromotionReward({ params: { promotionCode, amount } })

      if (!result) {
        console.warn('[프로모션] 지원하지 않는 앱 버전이에요.')
        return { status: 'unsupported' }
      }

      if (result === 'ERROR') {
        console.error('[프로모션] 포인트 지급 중 알 수 없는 오류가 발생했어요.')
        return { status: 'error' }
      }

      if ('key' in result) {
        writeStorage(storageKey, result.key)
        return { status: 'granted', key: result.key }
      }

      console.error('[프로모션] 포인트 지급 실패:', result.errorCode, result.message)
      return { status: 'error', errorCode: result.errorCode, message: result.message }
    } catch (error) {
      console.error('[프로모션] 호출 중 예외가 발생했어요:', error)
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    } finally {
      isRequestingRef.current = false
    }
  }, [promotionCode, amount])

  return { grantOnce }
}
