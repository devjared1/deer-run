import { loadForecast } from './_weather.js'

// GET /api/weather — the course forecast for the next 7 days (National Weather Service; see _weather.js):
// → { updatedAt, days: [{ date, high, low, forecast, precipChance, kind }] }, or { days: [] } when it's unavailable
// (the booking pages just leave the forecast out). Public.
export async function onRequestGet() {
  try {
    const data = await loadForecast()
    return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=900' } })
  } catch (e) {
    console.warn('Forecast unavailable:', e.message)
    return Response.json({ days: [], error: 'Forecast unavailable' })
  }
}
