// Head tags for search engines and social cards: title, description, robots, canonical, Open Graph, Twitter card
// and the course's JSON-LD. Used by App.vue (useHead, on every navigation) and by scripts/prerender.mjs (writes the
// same tags into dist/<route>.html at build time), so crawlers that don't run JavaScript see the same head as the
// app. Plain JS with relative imports only (no '@/'), so Node can import it.

import { holes } from '../data/holes.js'
import { photos } from '../data/photos.js'
import { address, courseName, phone, email } from '../data/site.js'

export const SITE_URL  = 'https://deerrun.golf'
export const SITE_NAME = courseName
export const DEFAULT_DESCRIPTION =
  '18-hole public golf course nestled at the entrance to the Bankhead National Forest in Moulton, Alabama. Earl Stone design, open since 1980.'
const HOME_TITLE = `${SITE_NAME} — Moulton, Alabama`

// Share image when a route has no meta.ogImage (a name from data/photos.js)
export const DEFAULT_OG_IMAGE = 'course-5-wide'
const OG_IMAGE_WIDTH = 1280 // largest JPEG width at or below this is used (cards are shown at ≤ 1200 px)

// Approximate: the course has no confirmed coordinates yet (docs/ui-ux-review.md B15 covers the unconfirmed details)
export const GEO = { latitude: 34.48, longitude: -87.29 }

/** Absolute URL for a site path ('/rates' → 'https://deerrun.golf/rates'), without query or hash. */
export function absoluteUrl(path = '/') {
  const clean = String(path).split(/[?#]/)[0] || '/'
  return SITE_URL + (clean.startsWith('/') ? clean : `/${clean}`)
}

/** The share image for a photo name: { url, width, height, alt } (falls back to the default photo). */
export function ogImage(name) {
  const key = photos[name] ? name : DEFAULT_OG_IMAGE
  const photo = photos[key]
  const width = Math.max(...photo.widths.filter(w => w <= OG_IMAGE_WIDTH), Math.min(...photo.widths))
  return {
    url: `${SITE_URL}/images/photos/${key}-${width}.jpg`,
    width,
    height: Math.round((photo.height * width) / photo.width),
    alt: photo.alt,
  }
}

// Admin, staff and bare pages (the UI gallery) are never indexed
function isPortal(meta) {
  return !!(meta.requiresAdmin || meta.requiresStaff || meta.bare)
}

// The hole pages share one route; give each its own title and description (the same text HoleView's own useHead
// sets, so the prerendered page and the app agree)
function holeDetails(path, params) {
  if (!path.startsWith('/course/hole/')) return null
  const h = holes.find(x => x.hole === Number(params?.n))
  if (!h) return null
  return {
    title: `Hole ${h.hole} · ${h.name}`,
    description: `Hole ${h.hole} at ${SITE_NAME}: par ${h.par}, ${Math.min(...h.yards)}–${Math.max(...h.yards)} yards, handicap ${h.hdcp}.`,
  }
}

/**
 * Everything the head needs for one page. `route` is a vue-router route (or { path, params, meta } at build time).
 * Returns { title, description, robots, indexable, canonical (null for noindex pages), image, type, jsonLd[] }.
 */
export function pageSeo(route) {
  const meta = route.meta || {}
  const path = String(route.path || '/').split(/[?#]/)[0] || '/'
  const hole = holeDetails(path, route.params)
  const pageTitle = hole?.title || meta.title
  const title = path === '/' || !pageTitle ? HOME_TITLE : `${pageTitle} · ${SITE_NAME}`
  const indexable = !meta.noindex && !isPortal(meta)
  return {
    title,
    description: hole?.description || meta.description || DEFAULT_DESCRIPTION,
    robots: indexable ? 'index, follow' : 'noindex',
    indexable,
    canonical: indexable ? absoluteUrl(path) : null,
    image: ogImage(meta.ogImage),
    type: 'website',
    jsonLd: indexable && path === '/' ? [courseJsonLd()] : [],
  }
}

/**
 * The page's head as tag lists in @unhead/vue's input shape: { title, meta: [{ name|property, content }],
 * link: [{ rel, href }], script: [{ id, type, innerHTML }] }. The prerender script serializes the same lists, so
 * unhead adopts the prerendered tags on load (it matches meta by name/property, the canonical link by rel and the
 * JSON-LD script by id) instead of adding a second copy.
 */
export function headTags(seo) {
  const meta = [
    { name: 'description', content: seo.description },
    { name: 'robots', content: seo.robots },
  ]
  // Social cards only for pages worth sharing (noindex pages keep just title, description and robots)
  if (seo.indexable) {
    meta.push(
      { property: 'og:type', content: seo.type },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:title', content: seo.title },
      { property: 'og:description', content: seo.description },
      { property: 'og:url', content: seo.canonical },
      { property: 'og:image', content: seo.image.url },
      { property: 'og:image:width', content: String(seo.image.width) },
      { property: 'og:image:height', content: String(seo.image.height) },
      { property: 'og:image:alt', content: seo.image.alt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: seo.title },
      { name: 'twitter:description', content: seo.description },
      { name: 'twitter:image', content: seo.image.url },
      { name: 'twitter:image:alt', content: seo.image.alt },
    )
  }
  return {
    title: seo.title,
    meta,
    link: seo.canonical ? [{ rel: 'canonical', href: seo.canonical }] : [],
    script: seo.jsonLd.map((data, i) => ({
      id: `ld-json-${i}`,
      type: 'application/ld+json',
      // '<' escaped so the JSON can never close the <script> element
      innerHTML: JSON.stringify(data).replace(/</g, '\\u003c'),
    })),
  }
}

/**
 * schema.org GolfCourse + LocalBusiness for the home page. openingHoursSpecification is left out on purpose: the hours
 * in data/site.js (hoursByDay) aren't confirmed by the course yet (B15) and include a "Holidays" row schema.org can't
 * express without dates. Add it from hoursByDay once they're confirmed.
 */
export function courseJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['GolfCourse', 'LocalBusiness'],
    '@id': `${SITE_URL}/#course`,
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/images/logo/emblem-480.png`,
    image: [ogImage('course-hero').url, ogImage('course-5-wide').url, ogImage('course-4').url],
    telephone: phone.tel,
    email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.locality,
      addressRegion: address.region,
      postalCode: address.postalCode,
      addressCountry: 'US',
    },
    geo: { '@type': 'GeoCoordinates', latitude: GEO.latitude, longitude: GEO.longitude },
    publicAccess: true,
    potentialAction: {
      '@type': 'ReserveAction',
      name: 'Book a tee time',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/book`,
        actionPlatform: ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform'],
      },
    },
  }
}
