import { defineConfig } from '@apps-in-toss/web-framework/config'

/**
 * 앱인토스 미니앱 런타임(WebView) 설정. (SDK 3.x)
 *
 * SDK 2.x에서 바뀐 점
 * - `brand`는 `primaryColor`만 남아요. 앱 이름(displayName)과 아이콘은 이제 콘솔에서 관리해요.
 * - `web.commands`가 없어졌어요. 웹 빌드는 package.json의 `build` 스크립트가 직접 실행하고,
 *   `ait build`는 `webBundleDir`(기본값 `dist`)에 쌓인 산출물을 그대로 .ait로 묶어요.
 * - 개발 서버 host/port는 vite.config.ts의 `server` 설정을 따라가요.
 */
export default defineConfig({
  // 콘솔에 등록한 앱 ID(고유 키)
  appName: 'midpoint-finder',

  brand: {
    // 토스 사용자에게 가장 익숙하고 신뢰감을 주는 '토스 블루' 컬러를 사용하여 직관적인 UI를 제공합니다.
    primaryColor: '#3182f6'
  },

  // 지도 앱 특성상 사용자의 현재 위치를 받아와야 한다면, 
  // 추후 콘솔에서 권한을 설정하고 배열 안에 해당 권한을 추가해 주시면 됩니다.
  permissions: []
})