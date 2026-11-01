// Greens fee and cart prices aren't here: they come from GET /api/rates (the rate products, edited in
// Admin → Settings → Rates). See src/lib/rates.js.

export const rateIncludes = [
  'Weekday rates Monday – Friday',
  'Weekend rates Saturday, Sunday and holidays',
  'Cart fee per rider; walking is welcome',
  'Range balls at checkout',
]

export const additionalFees = [
  { item: 'Driving Range',  price: '$5',  note: 'Bucket of balls' },
  { item: 'Club Rentals',   price: '$20', note: 'Full set available at the Pro Shop' },
  { item: 'Pull Cart',      price: '$5',  note: 'Per round' },
]

export const policies = [
  'Tee times required every day. Book online or call (256) 974-7384.',
  'Collared shirts required. No denim on the course.',
  'Metal spikes not permitted on bent-grass greens.',
  'Pace of play is 4 hours 30 minutes for 18 holes.',
  'Ranger on duty — slow play will be addressed.',
  'No outside alcohol permitted on the course or grounds.',
  'Cancellations accepted up to 24 hours before tee time.',
]
