import { defineConfig } from '@apps-in-toss/web-framework/config'

/**
 * 앱인토스 미니앱 런타임(WebView) 설정.
 * - 실제 배포/샌드박스 테스트 전에는 `appName`, `brand.displayName`, `brand.icon`, `permissions`를 콘솔 설정에 맞춰 변경하세요.
 */
export default defineConfig({
  appName: 'midpoint-finder', // 콘솔에 등록한 앱 ID(고유 키)
  brand: {
    displayName: '중간지점찾기',
    primaryColor: '#3182f6',
    icon: 'public/icon.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  permissions: [],
})

