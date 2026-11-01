import { relative, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'

// Preloads the two fonts every page's first paint needs (Lato 400 for text, Lato 700 for labels and the nav). Their
// file names are hashed at build time, so the links are added to index.html from the bundle. The Playfair Display
// faces a page's headline uses differ per page, so scripts/prerender.mjs adds those to each page's HTML.
function preloadFonts() {
  const wanted = [/lato-latin-400-normal-[\w-]+\.woff2$/, /lato-latin-700-normal-[\w-]+\.woff2$/]
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
// It also gets each lazy view's chunks (the view's own chunk, the shared chunks it imports and their CSS, minus what
// the main bundle already loads), so every page's HTML can preload them.
function prerenderPages() {
  let outDir, root
  let views = {}
  return {
    name: 'deer-run:prerender',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    writeBundle(_options, bundle) {
      const chunks = new Map(Object.values(bundle).filter(c => c.type === 'chunk').map(c => [c.fileName, c]))
      const walk = (file, seen = new Set()) => {
        if (!seen.has(file)) {
          seen.add(file)
          for (const f of chunks.get(file)?.imports ?? []) walk(f, seen)
        }
        return seen
      }
      const main = new Set([...chunks.values()].filter(c => c.isEntry).flatMap(c => [...walk(c.fileName)]))
      views = {}
      for (const c of chunks.values()) {
        if (!c.isDynamicEntry || !c.facadeModuleId?.endsWith('.vue')) continue
        const js = [...walk(c.fileName)].filter(f => !main.has(f))
        const css = js.flatMap(f => [...(chunks.get(f).viteMetadata?.importedCss ?? [])])
        views[relative(root, c.facadeModuleId).replace(/\\/g, '/')] = { js, css }
      }
    },
    async closeBundle() {
      const { prerender } = await import('./scripts/prerender.mjs')
      const { pages, urls } = await prerender({ dist: outDir, views })
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
