import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  // 開発時だけ Misskey API を dev サーバー経由で叩く（ブラウザによっては
  // localhost からのクロスオリジン要求が中継で落ちるため）。本番は直接叩く。
  server: {
    proxy: {
      '^/misskey-api/': {
        target: 'https://misskey.io',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/misskey-api\/[^/]+/, ''),
        router: (req: { url?: string }) => {
          const matched = req.url?.match(/^\/misskey-api\/([^/]+)/)
          return matched ? `https://${matched[1]}` : 'https://misskey.io'
        },
        configure: (proxy: { on: (event: string, cb: (proxyReq: { removeHeader: (n: string) => void }) => void) => void }) => {
          proxy.on('proxyReq', (proxyReq) => {
            // ブラウザ由来のヘッダを落として素の HTTP 要求として中継する
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
            proxyReq.removeHeader('sec-fetch-mode')
            proxyReq.removeHeader('sec-fetch-site')
            proxyReq.removeHeader('sec-fetch-dest')
          })
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Decoskey — MFM decorator',
        short_name: 'Decoskey',
        description: 'Misskey の文字装飾 (MFM) をボタン操作で作れるプレビュー付きエディタ',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d1017',
        theme_color: '#0d1017',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^/]+\/(emoji|files|proxy)\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'emoji-images',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/media\.misskeyusercontent\.jp\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'emoji-images-io',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
