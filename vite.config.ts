import { copyFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

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
      closeBundle() {
        try {
          copyFileSync('dist/index.html', 'dist/404.html')
        } catch {
          // Tests and the dev server do not emit dist/index.html.
        }
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
