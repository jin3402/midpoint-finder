/**
 * 앱인토스 SDK의 `isSupported()`는 토스 앱 밖(일반 브라우저, 로컬 개발)에서
 * "... is not a constant handler" 예외를 던져요. 렌더링이나 effect에서 그대로
 * 부르면 화면 전체가 멈추므로, 예외는 "지원하지 않음"으로 처리해요.
 */
export function isSupportedSafely(check: () => boolean): boolean {
  try {
    return check()
  } catch {
    return false
  }
}
