// Greens fee and cart rates, shared by the booking flow, the Rates page and the Functions (no @/ imports,
// no browser APIs). The prices live on the POS products tagged with Product.rateKey, so the register and online
// booking charge the same amounts; Admin → Settings → Rates edits them. Weekend rates apply on Saturdays,
// Sundays and the dates in CourseSettings.holidayDates.

export const RATE_KEYS = ['WEEKDAY_9', 'WEEKDAY_18', 'WEEKEND_9', 'WEEKEND_18', 'CART']

// Used when a rate product is missing (not set up yet, or deactivated)
export const DEFAULT_RATES = {
  WEEKDAY_9: 2000,
  WEEKDAY_18: 3000,
  WEEKEND_9: 3000,
  WEEKEND_18: 4000,
  CART: 1200,
}

// Product name, category and description for each rate (migration 11 and seed-pos.sql create them this way)
export const RATE_PRODUCTS = {
  WEEKDAY_9:  { name: 'Weekday 9 Holes',          category: 'Greens Fees', description: 'Mon–Fri. Per player.' },
  WEEKDAY_18: { name: 'Weekday 18 Holes',         category: 'Greens Fees', description: 'Mon–Fri. Per player.' },
  WEEKEND_9:  { name: 'Weekend/Holiday 9 Holes',  category: 'Greens Fees', description: 'Sat–Sun and holidays. Per player.' },
  WEEKEND_18: { name: 'Weekend/Holiday 18 Holes', category: 'Greens Fees', description: 'Sat–Sun and holidays. Per player.' },
  CART:       { name: 'Cart Fee',                 category: 'Cart Fees',   description: 'Per rider.' },
}

export const RATE_LABELS = {
  WEEKDAY_9: 'Weekday 9 holes',
  WEEKDAY_18: 'Weekday 18 holes',
  WEEKEND_9: 'Weekend/holiday 9 holes',
  WEEKEND_18: 'Weekend/holiday 18 holes',
  CART: 'Cart (per rider)',
}

/** A full { key: cents } map: the given rates, with defaults for any that are missing. */
export function withDefaultRates(rates = {}) {
  return Object.fromEntries(RATE_KEYS.map(k => [k, Number.isInteger(rates[k]) ? rates[k] : DEFAULT_RATES[k]]))
}

/** "YYYY-MM-DD" (course date) → true on Saturday, Sunday or a listed holiday. */
export function isWeekendRate(ymd, holidayDates = []) {
  if (holidayDates.includes(ymd)) return true
  const [y, m, d] = ymd.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 || day === 6
}

/** The greens fee rate key for a date and a 9- or 18-hole round. */
export function greensRateKey(ymd, holes = 18, holidayDates = []) {
  return `${isWeekendRate(ymd, holidayDates) ? 'WEEKEND' : 'WEEKDAY'}_${Number(holes) === 9 ? 9 : 18}`
}

/**
 * Price of an online booking: per player, the greens fee plus the cart fee when riding.
 * → { greensKey, greensCents, cartCents, perPlayerCents, totalCents }
 */
export function bookingPrice({ rates, holidayDates = [], ymd, holes = 18, players = 1, cart = false }) {
  const all = withDefaultRates(rates)
  const greensKey = greensRateKey(ymd, holes, holidayDates)
  const greensCents = all[greensKey]
  const cartCents = cart ? all.CART : 0
  const perPlayerCents = greensCents + cartCents
  return { greensKey, greensCents, cartCents, perPlayerCents, totalCents: perPlayerCents * Number(players) }
}
