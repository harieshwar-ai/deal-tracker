import { copyFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { prerenderItems } from './scripts/prerender-items.mjs'

export default defineConfig({
  base: '/deal-tracker/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/deal-tracker/' })
            res.end()
            return
          }
          next()
        })
      },
      async closeBundle() {
        if (process.env.VITEST) return
        try {
          copyFileSync('dist/index.html', 'dist/404.html')
        } catch {
          // The dev server does not emit dist/index.html.
          return
        }
        try {
          await prerenderItems('dist')
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error'
          console.warn(`Item prerender skipped (${message}). The default preview still ships.`)
        }
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
