// The round setup form (RoundSetupFields.vue) ↔ the API's { cartNumbers, ownCart, startHole, roundHoles }.

// SegmentedButton options for the two toggles
export const START_HOLE_OPTIONS = [{ value: 1, label: 'Hole 1' }, { value: 10, label: 'Hole 10' }]
export const ROUND_HOLE_OPTIONS = [{ value: 18, label: '18 holes' }, { value: 9, label: '9 holes' }]

export function setupForm(booking = {}) {
  return {
    cartText: (booking.cartNumbers || []).join(', '),
    ownCart: !!booking.ownCart,
    startHole: booking.startHole ?? 1,
    roundHoles: booking.roundHoles ?? 18,
  }
}

/** "12, 14" or "12 14" → ['12', '14'] */
export function cartList(text) {
  return [...new Set(String(text || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean))]
}

export function setupPayload(form) {
  return { cartNumbers: cartList(form.cartText), ownCart: form.ownCart, startHole: form.startHole, roundHoles: form.roundHoles }
}

/** "Carts 12, 14", "Own cart", "Cart 7 + own cart", or '' */
export function cartsLabel(booking) {
  const carts = booking.cartNumbers || []
  const label = carts.length ? `Cart${carts.length === 1 ? '' : 's'} ${carts.join(', ')}` : ''
  if (!booking.ownCart) return label
  return label ? `${label} + own cart` : 'Own cart / walking'
}
