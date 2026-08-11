import { defineConfig } from '@apps-in-toss/web-framework/config'

/**
 * 앱인토스 미니앱 런타임(WebView) 설정.
 * - 실제 배포/샌드박스 테스트 전에는 `appName`, `brand.displayName`, `brand.icon`, `permissions`를 콘솔 설정에 맞춰 변경하세요.
 */
export default defineConfig({
  appName: 'midpoint-finder', // 콘솔에 등록한 앱 ID(고유 키)
  brand: {
    displayName: '중간지점찾기',
    // 토스 사용자에게 가장 익숙하고 신뢰감을 주는 '토스 블루' 컬러를 사용하여 직관적인 UI를 제공합니다.
    primaryColor: '#3182f6',
    // 콘솔의 앱 정보에 업로드된 이미지를 우클릭해 복사한 링크. 로컬 파일 경로가 아닌 URL을 사용해야 해요.
    icon: 'https://static.toss.im/appsintoss/32373/6e54ecbf-880b-4f61-a0d2-2c7627ba4ced.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  // 지도 앱 특성상 사용자의 현재 위치를 받아와야 한다면, 
  // 추후 콘솔에서 권한을 설정하고 배열 안에 해당 권한을 추가해 주시면 됩니다.
  permissions: [],
})