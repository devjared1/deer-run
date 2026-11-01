// Membership tiers: names (used by products, Admin → Users and the API validator), prices, Pro Shop discount
// (src/lib/pricing.js) and the copy on the Memberships page. Plain JS, no '@/' imports.
export const membershipTiers = [
  {
    name: 'Individual',
    badge: 'Individual',
    tone: 'secondary', // color role of the card's band (MembershipTierCard maps it to token classes)
    featured: false,
    annual: 750,
    monthly: 70,
    proShopDiscountBps: 1000, // 10% off Pro Shop merchandise (src/lib/pricing.js)
    subtitle: 'Single golfer · Unlimited rounds',
    benefits: [
      'Unlimited 18-hole rounds',
      '14-day advance tee time booking',
      '10% Pro Shop discount',
      'Free range balls daily',
      '1 guest round per month at member rate',
    ],
  },
  {
    name: 'Premier',
    badge: 'Best Value',
    tone: 'primary',
    featured: true,
    annual: 1200,
    monthly: 110,
    proShopDiscountBps: 1500,
    subtitle: 'Individual + spouse or partner',
    benefits: [
      '2 golfers unlimited rounds',
      '14-day advance booking for both',
      '15% Pro Shop discount',
      'Unlimited range balls',
      'Monthly club events & socials',
      '2 guest rounds per month at member rate',
    ],
  },
  {
    name: 'Family',
    badge: 'Family Plan',
    tone: 'tertiary',
    featured: false,
    annual: 1650,
    monthly: 150,
    proShopDiscountBps: 1500,
    subtitle: 'Up to 2 adults + dependent children under 18',
    benefits: [
      'Unlimited rounds for the family',
      'Junior lessons discount (20%)',
      '15% Pro Shop discount',
      'Free range balls daily',
      'Priority event registration',
      'Holiday event invitations',
    ],
  },
]

// The Memberships page comparison: one row per benefit, a value per tier name
// (true = included, false = not included, a string = the amount)
export const tierComparison = [
  { label: 'Advance booking window',    values: { Individual: '14 days', Premier: '14 days', Family: '14 days' } },
  { label: 'Unlimited rounds',          values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Cart included every round', values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Range balls included',      values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Member-only events',        values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Spouse / partner',          values: { Individual: false,     Premier: true,      Family: true       } },
  { label: 'Children (under 18)',       values: { Individual: false,     Premier: false,     Family: true       } },
  { label: 'Junior lesson discount',    values: { Individual: false,     Premier: false,     Family: '20%'      } },
  { label: 'Pro Shop discount',         values: { Individual: '10%',     Premier: '15%',     Family: '15%'      } },
  { label: 'Club events & socials',     values: { Individual: false,     Premier: true,      Family: false      } },
]
