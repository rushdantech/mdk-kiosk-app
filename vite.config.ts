import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { openaiProxy } from './server/openai-proxy.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/',
    plugins: [vue(), openaiProxy(env.OPENAI_API_KEY ?? '')],
    server: {
      port: 5173,
    },
  }
})
