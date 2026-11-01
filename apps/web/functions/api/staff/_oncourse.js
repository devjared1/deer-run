// On-course tracking helpers shared by the tee sheet check-in and /api/staff/oncourse.

import { holeOrder } from '../../../src/lib/pace.js'

const MAX_CARTS = 6
const MAX_CART_LENGTH = 10

/**
 * The round setup fields of a request body: { cartNumbers?, ownCart?, startHole?, roundHoles? } (each optional).
 * Returns { fields } with only the fields that were sent, or { error }.
 */
export function parseRoundSetup(body) {
  const fields = {}
  if (body.cartNumbers !== undefined) {
    if (!Array.isArray(body.cartNumbers)) return { error: 'cartNumbers must be a list' }
    const carts = [...new Set(body.cartNumbers.map(c => String(c ?? '').trim()).filter(Boolean))]
    if (carts.length > MAX_CARTS) return { error: `A group can have at most ${MAX_CARTS} carts` }
    if (carts.some(c => c.length > MAX_CART_LENGTH)) return { error: `Cart numbers are at most ${MAX_CART_LENGTH} characters` }
    fields.cartNumbers = carts
  }
  if (body.ownCart !== undefined) fields.ownCart = !!body.ownCart
  if (body.startHole !== undefined) {
    if (![1, 10].includes(Number(body.startHole))) return { error: 'startHole must be 1 or 10' }
    fields.startHole = Number(body.startHole)
  }
  if (body.roundHoles !== undefined) {
    if (![9, 18].includes(Number(body.roundHoles))) return { error: 'roundHoles must be 9 or 18' }
    fields.roundHoles = Number(body.roundHoles)
  }
  return { fields }
}

/** Clears a reported position that's no longer on the round after startHole / roundHoles change. */
export function dropStalePosition(booking, fields) {
  if (!booking.positionHole) return fields
  const order = holeOrder(fields.startHole ?? booking.startHole, fields.roundHoles ?? booking.roundHoles)
  return order.includes(booking.positionHole) ? fields : { ...fields, positionHole: null, positionStage: null, positionAt: null }
}

/** Resets everything recorded on the course (carts stay). */
export const CLEAR_TRACKING = { teedOffAt: null, positionHole: null, positionStage: null, positionAt: null, finishedAt: null }
