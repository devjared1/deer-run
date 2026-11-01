/**
 * Tee sets, in the order of the yards arrays in data/holes.js.
 *   name, color (legacy hex, not used by the redesigned pages), rating, slope
 *   total: ❓ the published total yards; it doesn't match the sum of the hole yardages in holes.js, so the pages show
 *          the computed sum (totalYards() in holes.js) until the course confirms the numbers
 *   swatchClass / fillClass: literal Tailwind classes for the tee marker (a dot / the SVG diagram), no hex
 *   ratingLadies?, slopeLadies?: shown next to the men's rating/slope when present
 */
export const teeSets = [
  { name: 'Black', color: '#1a1a1a', total: 6745, rating: '72.4', slope: '128', swatchClass: 'bg-neutral-900', fillClass: 'fill-neutral-900' },
  { name: 'Blue',  color: '#2563EB', total: 6242, rating: '70.1', slope: '122', swatchClass: 'bg-blue-600', fillClass: 'fill-blue-600' },
  { name: 'Red',   color: '#DC2626', total: 5612, rating: '67.3', slope: '116', swatchClass: 'bg-red-600', fillClass: 'fill-red-600' },
  { name: 'Gold',  color: '#C4873A', total: 5398, rating: '65.8', slope: '111', swatchClass: 'bg-gold', fillClass: 'fill-gold' },
]

export const defaultTeeIndex = 1 // Blue
