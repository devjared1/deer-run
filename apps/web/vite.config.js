import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'

// Preloads the two fonts the first paint needs (Playfair Display 700 for headlines, Lato 400 for text). Their
// file names are hashed at build time, so the links are added to index.html from the bundle.
function preloadFonts() {
  const wanted = [/playfair-display-latin-700-normal-[\w-]+\.woff2$/, /lato-latin-400-normal-[\w-]+\.woff2$/]
  return {
    name: 'deer-run:preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter(f => wanted.some(re => re.test(f)))
        return files.map(f => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `/${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head',
        }))
      },
    },
  }
}

// After the bundle is written: one HTML file per public route with its head tags, plus sitemap.xml
// (scripts/prerender.mjs). A plugin rather than an npm script so the Cloudflare Pages build command (`vite build`)
// runs it too.
function prerenderPages() {
  let outDir
  return {
    name: 'deer-run:prerender',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
    async closeBundle() {
      const { prerender } = await import('./scripts/prerender.mjs')
      const { pages, urls } = await prerender({ dist: outDir })
      console.log(`deer-run:prerender: ${pages} pages, sitemap.xml with ${urls} URLs`)
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    // Material Symbols as tree-shaken inline SVG components: import IconGolf from '~icons/material-symbols/golf-course-rounded'
    // Custom icons in the same style (golf cart, bunker) live in src/assets/icons: '~icons/deer/golf-cart'
    Icons({
      compiler: 'vue3',
      scale: 1, // 1em: size icons with font size or w-/h- classes
      defaultClass: 'app-icon',
      customCollections: { deer: FileSystemIconLoader('./src/assets/icons') },
    }),
    preloadFonts(),
    prerenderPages(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    // API calls go to the Pages Functions that `npm run dev:pages` runs with wrangler on :8788.
    // With `npm run dev` alone they fail with a proxy error instead of returning index.html.
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  }
})
