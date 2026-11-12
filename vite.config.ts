import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

function disableViteClientWebSocketPlugin(): Plugin {
  return {
    name: 'disable-vite-client-websocket-error',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs') || id.includes('@vite/client')) {
        return {
          code: code.replace(
            /reject\(new Error\(['"`]WebSocket closed without opened\.['"`]\)\)/g,
            'resolve()'
          ),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      disableViteClientWebSocketPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png', 'brand-mark.png'],
        manifest: {
          id: '/',
          name: 'Minhas Economias BR',
          short_name: 'Economias BR',
          description: 'Controle financeiro pessoal e familiar 100% manual e privado para o público brasileiro.',
          theme_color: '#023f3c',
          background_color: '#023f3c',
          lang: 'pt-BR',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(configDirectory, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio preview environment to prevent WebSocket errors and flickering.
      hmr: false,
      watch: null,
    },
  };
});
