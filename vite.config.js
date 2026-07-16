import { defineConfig } from 'vite';

export default defineConfig({
  base: '/taiwan-stocks-bubble-chart/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
