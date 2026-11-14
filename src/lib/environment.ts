/**
 * 토스 앱 WebView 안에서 실행 중인지 확인해요.
 * 같은 코드를 일반 웹(Vercel)에도 배포하기 때문에, 앱인토스 SDK 호출 전에 이 값으로 분기해요.
 * SDK도 내부적으로 `window.ReactNativeWebView` 유무로 웹뷰 환경을 판단해요.
 */
export function isTossApp(): boolean {
  return typeof window !== 'undefined' && (window as { ReactNativeWebView?: unknown }).ReactNativeWebView != null
}
