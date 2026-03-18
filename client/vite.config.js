import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5174,
      host: '0.0.0.0',
      allowedHosts: ['onlineattendance.icanacademy.work'],
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:5001',
          changeOrigin: true
        }
      }
    },
    build: {
      // Production build settings
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            query: ['@tanstack/react-query']
          }
        }
      }
    }
  }
})

