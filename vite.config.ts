import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,    // 네트워크 상의 다른 기기(휴대폰) 접속 허용
    port: 5173,    // 앱인토스 기본 포트 사용
    strictPort: true // 포트가 이미 사용 중일 때 에러를 내어 혼선 방지
  }
})