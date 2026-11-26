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

// Só no site publicado: (1) tira o script que silencia avisos do servidor de desenvolvimento (lá ele não tem
// função e atrasava a primeira pintura); (2) manda o navegador baixar a tela de entrada junto com o app,
// em vez de esperar o app rodar para descobrir que precisa dela.
function productionHtmlPlugin(): Plugin {
  return {
    name: 'production-html-tweaks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const cleaned = html.replace(/\s*<script src="\/vite-websocket-guard\.js"><\/script>/, '');
        const loginChunk = Object.values(ctx.bundle ?? {}).find(
          (item) => item.type === 'chunk' && item.facadeModuleId?.replace(/\\/g, '/').endsWith('/components/auth/LoginPage.tsx')
        );
        if (!loginChunk) return cleaned;
        return {
          html: cleaned,
          tags: [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${loginChunk.fileName}` }, injectTo: 'head' }],
        };
      },
    },
  };
}

export default defineConfig(() => {
  return {
    // Identifica a versão publicada (código curto do commit na Vercel) para o app mostrar qual versão está rodando.
    define: {
      __APP_BUILD__: JSON.stringify({
        sha: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7),
        builtAt: new Date().toISOString(),
      }),
    },
    plugins: [
      disableViteClientWebSocketPlugin(),
      productionHtmlPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png', 'brand-mark.webp'],
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
          // Fica fora da instalação inicial (baixa só quando usado e depois fica guardado): gerador de PDF e suas
          // bibliotecas, ícones grandes de instalação e fontes de alfabetos que o app não usa (~1 MB a menos na 1ª visita).
          globIgnores: [
            '**/assets/{jspdf,html2canvas,purify,index.es,reportPdfGenerator,tripPdfGenerator}*',
            'vite-websocket-guard.js',
            'pwa-*.png',
            '**/assets/*-{latin-ext,cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
          ],
          runtimeCaching: [
            {
              // Arquivos com código de versão no nome nunca mudam: o que ficou fora da instalação é guardado no 1º uso.
              urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'assets-on-demand',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 180 },
                cacheableResponse: { statuses: [200] },
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
    build: {
      rolldownOptions: {
        output: {
          // React em pacote próprio: muda pouco entre versões, então o aparelho reaproveita o que já baixou.
          codeSplitting: {
            groups: [{ name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
          },
        },
      },
    },
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
