// The course forecast for the booking pages (GET /api/weather: next 7 days from the National Weather Service).
// Fetched once per page load and shared; when it's unavailable the pages simply show no forecast.
//   const { forecastFor } = useForecast()
//   forecastFor('2026-11-07') → { date, high, low, forecast, precipChance, kind, icon, short, label } | null
//     short: "72°" · label: "Mostly Sunny, high 72°, 20% chance of rain" (for screen readers and text)
import { ref } from 'vue'
import IconSun from '~icons/material-symbols/sunny-rounded'
import IconPartly from '~icons/material-symbols/partly-cloudy-day-rounded'
import IconCloud from '~icons/material-symbols/cloud-rounded'
import IconRain from '~icons/material-symbols/rainy-rounded'
import IconStorm from '~icons/material-symbols/thunderstorm-rounded'
import IconSnow from '~icons/material-symbols/weather-snowy-rounded'
import IconFog from '~icons/material-symbols/foggy-rounded'
import IconWind from '~icons/material-symbols/air-rounded'

export const WEATHER_ICONS = {
  sun: IconSun, partly: IconPartly, cloud: IconCloud, rain: IconRain, storm: IconStorm, snow: IconSnow, fog: IconFog, wind: IconWind,
}

const days = ref({})
let request = null

function load() {
  request ??= fetch('/api/weather')
    .then(res => (res.ok ? res.json() : { days: [] }))
    .then(data => { days.value = Object.fromEntries((data.days ?? []).map(d => [d.date, d])) })
    .catch(() => { /* no forecast: nothing shown */ })
  return request
}

export function useForecast() {
  load()
  function forecastFor(date) {
    const d = days.value[date]
    if (!d?.forecast) return null
    return {
      ...d,
      icon: WEATHER_ICONS[d.kind] ?? IconSun,
      short: d.high != null ? `${d.high}°` : '',
      label: [d.forecast, d.high != null ? `high ${d.high}°` : null, d.precipChance ? `${d.precipChance}% chance of rain` : null]
        .filter(Boolean).join(', '),
    }
  }
  return { forecastFor, ready: load }
}
