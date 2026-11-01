// Build step run at the end of `vite build` (the deer-run:prerender plugin in vite.config.js, so the Cloudflare Pages
// build command `vite build` runs it too; or by hand: npm run prerender). Writes one HTML file per public route with that page's head tags
// already in it, plus dist/sitemap.xml, so crawlers and social card scrapers (which don't run JavaScript) see the
// real title, description, canonical, Open Graph / Twitter tags and JSON-LD.
//
// Head-only prerender: the body is still the empty #app shell that the SPA renders into. The tags come from
// src/lib/seo.js, the same module App.vue's useHead uses, and unhead adopts the prerendered tags on load (matching
// them by name/property, rel=canonical and the JSON-LD script id) rather than adding duplicates.
//
// Routes come from src/router/index.js itself, loaded through Vite's SSR module loader with vue-router and every
// '@/…' import stubbed out (the views are lazy imports that are never called), so the router stays the one list of
// public pages and their meta.
//
// File layout (Cloudflare Pages "auto-trailing-slash" HTML handling): dist/rates.html is served at /rates, and
// /rates.html and /rates/ redirect (308) to /rates. A dist/rates/index.html would instead be served at /rates/ with
// /rates redirecting to it, which doesn't match the app's links or the canonical URLs (no trailing slash). The home
// page is dist/index.html, which is also what the `/* /index.html 200` SPA fallback in public/_redirects serves for
// every other URL (portals, /tournaments/:id, 404s): those get the home page's head until the app replaces it, and
// /admin, /staff, /account are disallowed in robots.txt anyway. Static files win over the fallback rule.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { absoluteUrl, headTags, pageSeo } from '../src/lib/seo.js'
import { photos } from '../src/data/photos.js'

const root = fileURLToPath(new URL('..', import.meta.url))

// The hero photo each page renders first (its LCP element: PageHero `photo`, HomeHero on the home page), preloaded
// from the HTML so the browser fetches it while the app's JavaScript loads instead of after the page renders.
// Keep in step with the views. The AVIF source is the one every current browser picks. HERO_SIZES must match the
// <picture>'s sizes (PageHero.vue, HomeHero.vue), or the browser downloads a second file.
const HERO_SIZES = { home: '100vw', page: '(max-width: 767px) 50vw, 100vw' }
const HERO_PHOTOS = {
  '/': 'course-hero',
  '/scorecard': 'course-hero',
  '/rates': 'course-3',
  '/memberships': 'course-4',
  '/tournaments': 'course-2-wide',
  '/contact': 'course-5',
  '/book': 'course-5-wide',
}

// The Playfair Display faces the page's first screen uses (vite.config.js preloads Lato 400/700 on every page),
// preloaded so the headline doesn't wait for them (font-display: swap still hides text for up to 100 ms) or reflow
// when they arrive after the first paint
function pageFonts(path) {
  if (path === '/') return ['playfair-display-latin-400-normal', 'playfair-display-latin-400-italic'] // HomeHero <h1>
  if (HERO_PHOTOS[path]) return ['playfair-display-latin-700-normal', 'playfair-display-latin-700-italic'] // PageHero <h1>: bold, <em>
  return ['playfair-display-latin-400-normal'] // headline-size titles
}

// ── Load the router's route list ────────────────────────────────────────────
// Stubs: createRouter just hands back its routes; '@/…' imports (the auth store, lazy views) are empty modules.
function routerStubs() {
  const STUB = '\0prerender-stub:'
  return {
    name: 'deer-run:prerender-stubs',
    enforce: 'pre',
    // vue-router is rewritten in the source: Vite's SSR loader would otherwise import the real package from
    // node_modules (externalized) without asking resolveId, and createWebHistory needs `window`
    transform(code, id) {
      if (id.endsWith('/src/router/index.js')) return code.replace(/from\s+['"]vue-router['"]/g, `from '${STUB}vue-router'`)
    },
    resolveId(id) {
      if (id === `${STUB}vue-router`) return id
      // A lazy view becomes a module that only names its file (the route's `viewFile`, for the chunk preloads)
      if (id.startsWith('@/views/')) return `${STUB}view:src/${id.slice(2)}`
      if (id.startsWith('@/')) return `${STUB}empty`
    },
    load(id) {
      if (id === `${STUB}vue-router`) {
        return 'export const createWebHistory = () => null\n' +
          'export const createRouter = options => ({ options, beforeEach() {}, afterEach() {} })\n'
      }
      if (id.startsWith(`${STUB}view:`)) return `export default { viewFile: ${JSON.stringify(id.slice(`${STUB}view:`.length))} }\n`
      if (id === `${STUB}empty`) return 'export const useAuthStore = () => ({})\nexport default {}\n'
    },
  }
}

async function loadRoutes() {
  const server = await createServer({
    root,
    configFile: false, // not vite.config.js: no Vue/icon plugins needed, nothing to compile but the router file
    logLevel: 'error',
    appType: 'custom',
    // Own cache dir and no dependency scan, so a running dev server's node_modules/.vite is left alone
    cacheDir: join(root, 'node_modules/.vite-prerender'),
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [routerStubs()],
  })
  try {
    const mod = await server.ssrLoadModule('/src/router/index.js')
    const routes = mod.default.options.routes
    for (const r of routes) {
      if (typeof r.component === 'function') r.viewFile = (await r.component()).default?.viewFile
    }
    return routes
  } finally {
    await server.close()
  }
}

// ── Which routes to prerender ───────────────────────────────────────────────
// Top-level routes only (the admin/staff children are portals), skipping redirects, the catch-all and dynamic
// routes, except the hole pages (1–18). /tournaments/:id would need the events API at build time, so it's left
// to the SPA.
function publicPages(routes) {
  const pages = []
  for (const r of routes) {
    if (r.redirect || r.children || !r.component) continue
    if (r.path === '/course/hole/:n(\\d+)') {
      for (let n = 1; n <= 18; n++) pages.push({ path: `/course/hole/${n}`, params: { n: String(n) }, meta: r.meta, viewFile: r.viewFile })
      continue
    }
    if (r.path.includes(':')) continue
    pages.push({ path: r.path, params: {}, meta: r.meta || {}, viewFile: r.viewFile })
  }
  return pages.filter(p => pageSeo(p).indexable)
}

// ── HTML ────────────────────────────────────────────────────────────────────
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const attrs = obj => Object.entries(obj).map(([k, v]) => ` ${k}="${escapeHtml(v)}"`).join('')

function headHtml(tags) {
  const lines = [`<title>${escapeHtml(tags.title)}</title>`]
  for (const m of tags.meta) lines.push(`<meta${attrs(m)} />`)
  for (const l of tags.link) lines.push(`<link${attrs(l)} />`)
  for (const { innerHTML, ...rest } of tags.script) lines.push(`<script${attrs(rest)}>${innerHTML}</script>`)
  return lines.map(l => `    ${l}`).join('\n')
}

// Preloads for what the page needs before it can render: its hero photo, its headline fonts and its view's chunks
// (otherwise found only after the main bundle has run, one round trip later). `views` maps a view's source file to
// its chunk files beyond the main bundle (from the deer-run:prerender plugin; absent when run by hand, then nothing
// is preloaded); `assets` lists dist/assets. Note dist/index.html is also the SPA fallback, so portal and 404 pages
// get the home page's preloads too.
function preloadHtml(page, views, assets) {
  if (!views) return ''
  const lines = []
  const hero = photos[HERO_PHOTOS[page.path]]
  if (hero) {
    const srcset = hero.widths.map(w => `/images/photos/${HERO_PHOTOS[page.path]}-${w}.avif ${w}w`).join(', ')
    const imagesizes = page.path === '/' ? HERO_SIZES.home : HERO_SIZES.page
    lines.push(`<link${attrs({ rel: 'preload', as: 'image', type: 'image/avif', imagesrcset: srcset, imagesizes, fetchpriority: 'high' })}>`)
  }
  for (const face of pageFonts(page.path)) {
    const f = assets.find(a => a.startsWith(`${face}-`) && a.endsWith('.woff2'))
    if (f) lines.push(`<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin="">`)
  }
  const view = views[page.viewFile]
  for (const f of view?.js ?? []) lines.push(`<link rel="modulepreload" crossorigin href="/${f}">`)
  for (const f of view?.css ?? []) lines.push(`<link rel="preload" as="style" crossorigin href="/${f}">`)
  return lines.map(l => `    ${l}\n`).join('')
}

// index.html's static <title> and description are replaced by the page's own (theme-color, icons and the bundle
// links stay as they are)
// (the page's tags go where the <title> was, near the top of <head>; the preloads go at the end of <head>)
function renderPage(template, page, views, assets) {
  if (!/<title>[\s\S]*?<\/title>/i.test(template)) throw new Error('prerender: dist/index.html has no <title>')
  return template
    .replace(/\n?[ \t]*<meta\s+name="(description|robots)"[^>]*>/gi, '')
    .replace(/[ \t]*<title>[\s\S]*?<\/title>/i, () => headHtml(headTags(pageSeo(page))))
    .replace(/[ \t]*<\/head>/i, m => preloadHtml(page, views, assets) + m)
}

function outFile(dist, path) {
  return path === '/' ? join(dist, 'index.html') : join(dist, `${path.slice(1)}.html`)
}

function sitemap(pages) {
  const urls = pages
    .filter(p => p.meta.sitemap !== false)
    .map(p => `  <url><loc>${escapeHtml(absoluteUrl(p.path))}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

// ── Run ─────────────────────────────────────────────────────────────────────
/** Prerenders into `dist` (default apps/web/dist, which must already hold the built index.html). `views`: see preloadHtml. */
export async function prerender({ dist = join(root, 'dist'), views } = {}) {
  const template = await readFile(join(dist, 'index.html'), 'utf8')
  const pages = publicPages(await loadRoutes())
  if (!pages.some(p => p.path === '/')) throw new Error('prerender: no home route found in src/router/index.js')
  const assets = await readdir(join(dist, 'assets'))

  for (const page of pages) {
    const file = outFile(dist, page.path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, renderPage(template, page, views, assets))
  }
  await writeFile(join(dist, 'sitemap.xml'), sitemap(pages))
  return { pages: pages.length, urls: pages.filter(p => p.meta.sitemap !== false).length }
}

// node scripts/prerender.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pages, urls } = await prerender()
  console.log(`prerender: ${pages} pages + sitemap.xml (${urls} URLs)`)
}
