// The course forecast from the National Weather Service (api.weather.gov: free, no key, US only). Used by
// GET /api/weather (booking flow, confirmation page) and the day-before reminder email.
//   → { updatedAt, days: [{ date, high, low, forecast, precipChance, kind }] } (up to 7 course-local days)
// kind: sun | partly | cloud | rain | storm | snow | fog | wind (the page picks an icon). Cached for an hour at the edge,
// so the NWS isn't asked on every page view.

import { localDate } from '../../src/lib/timeclock.js'

// The course (approximate, same point as the NWS link in bookingFlow.js)
const POINT = '34.48,-87.29'
const CACHE_SECONDS = 3600
const CACHE_KEY = 'https://deerrun.golf/__cache/weather-v1'
const HEADERS = { 'User-Agent': 'deerrun.golf (proshop@deerrun.golf)', Accept: 'application/geo+json' }

export function weatherKind(text = '') {
  const t = text.toLowerCase()
  if (/thunder|t-storm/.test(t)) return 'storm'
  if (/snow|sleet|flurr|ice|freezing/.test(t)) return 'snow'
  if (/rain|shower|drizzle/.test(t)) return 'rain'
  if (/fog|haze|smoke/.test(t)) return 'fog'
  if (/wind|breezy|blustery/.test(t)) return 'wind'
  if (/partly|mostly sunny|mostly clear/.test(t)) return 'partly'
  if (/cloud|overcast/.test(t)) return 'cloud'
  return 'sun'
}

async function fetchForecast() {
  const point = await fetch(`https://api.weather.gov/points/${POINT}`, { headers: HEADERS })
  if (!point.ok) throw new Error(`NWS points ${point.status}`)
  const url = (await point.json())?.properties?.forecast
  if (!url) throw new Error('NWS: no forecast URL')
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`NWS forecast ${res.status}`)
  const periods = (await res.json())?.properties?.periods ?? []

  // Periods are day/night halves; group them by the course date they start on
  const byDate = new Map()
  for (const p of periods) {
    const date = localDate(new Date(p.startTime))
    const day = byDate.get(date) ?? { date, high: null, low: null, forecast: null, precipChance: null, kind: null }
    const chance = p.probabilityOfPrecipitation?.value ?? null
    if (p.isDaytime) {
      day.high = p.temperature
      day.forecast = p.shortForecast
      day.kind = weatherKind(p.shortForecast)
      day.precipChance = Math.max(day.precipChance ?? 0, chance ?? 0)
    } else {
      day.low = p.temperature
      // Tonight only (the page is opened after dark): use the night forecast
      if (!day.forecast) {
        day.forecast = p.shortForecast
        day.kind = weatherKind(p.shortForecast)
        day.precipChance = chance
      }
    }
    byDate.set(date, day)
  }
  return { updatedAt: new Date().toISOString(), days: [...byDate.values()].slice(0, 7) }
}

/** The forecast, from the edge cache when it's fresh. Throws when the NWS can't be reached and nothing is cached. */
export async function loadForecast() {
  const cache = typeof caches !== 'undefined' ? caches.default : null
  const hit = cache ? await cache.match(CACHE_KEY) : null
  if (hit) return hit.json()
  const data = await fetchForecast()
  if (cache) {
    await cache.put(CACHE_KEY, new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CACHE_SECONDS}` },
    })).catch(() => {})
  }
  return data
}

/** "Mostly Sunny, high 72°F, 20% chance of rain" for one date, or null when it isn't in the forecast. */
export function forecastLine(forecast, date) {
  const d = forecast?.days?.find(x => x.date === date)
  if (!d?.forecast) return null
  return [d.forecast, d.high != null ? `high ${d.high}°F` : null, d.precipChance ? `${d.precipChance}% chance of rain` : null]
    .filter(Boolean).join(', ')
}
