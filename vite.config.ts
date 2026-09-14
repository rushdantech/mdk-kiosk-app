import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { openaiProxy } from './server/openai-proxy.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey =
    process.env.VITE_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    env.VITE_OPENAI_API_KEY ||
    env.OPENAI_API_KEY ||
    ''
  return {
    base: process.env.VITE_BASE || env.VITE_BASE || '/',
    plugins: [vue(), openaiProxy(apiKey)],
    define: {
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(apiKey),
    },
    server: {
      port: 5173,
    },
  }
})
