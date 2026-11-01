// Helpers for typing dollar amounts on the NumericKeypad (left key "."): the keypad's v-model is the typed text,
// e.g. "20" or "12.5", which dollarsToCents() reads.

/** Keep at most two digits after the decimal point: "12.345" → "12.34" */
export function trimCents(value) {
  const i = value.indexOf('.')
  return i < 0 ? value : value.slice(0, i + 3)
}

/** Display text for the keypad: "12.5" → "$12.5" (the keypad shows its placeholder while empty) */
export const keypadDollars = value => `$${value}`

/** 4500 → "45.00": text for the keypad after a quick-amount button */
export const centsToKeypad = cents => (cents / 100).toFixed(2)
