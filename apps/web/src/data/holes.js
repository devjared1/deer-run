/**
 * 18-hole scorecard data for Deer Run Golf Course.
 * yards index: [0]=Black, [1]=Blue, [2]=Red, [3]=Gold (the order of data/teeSets.js)
 *
 * Shape of a hole (fields marked ? are optional and only rendered when present, so the course can fill them in):
 *   hole        1–18
 *   name        hole name (❓ to confirm with the course, see TODO.md → Housekeeping)
 *   par         3 | 4 | 5
 *   hdcp        stroke index (men's)
 *   hdcpLadies? ladies' stroke index; the scorecard shows a second handicap row only when every hole has it
 *   yards       yardage per tee, in teeSets order
 *   water       water in play
 *   bunkers     number of bunkers (0 = none)
 *   mountain    elevated terrain / elevation change
 *   signature   one of the course's signature holes
 *   dogleg?     'left' | 'right': drawn on the hole diagram
 *   tip?        a short playing tip from the pro (plain text)
 *   description? a sentence or two about the hole (plain text)
 *   photo?      a photo name from data/photos.js (rendered with ResponsivePicture)
 *
 * Imported by src/lib/pace.js (shared with the Functions), so no '@/' imports here.
 */
export const holes = [
  { hole: 1,  name: 'Opening Act',    par: 4, hdcp: 7,  yards: [420, 385, 345, 320], water: false, bunkers: 2, mountain: false, signature: false },
  { hole: 2,  name: 'The Long Draw',  par: 5, hdcp: 3,  yards: [545, 510, 470, 450], water: false, bunkers: 3, mountain: false, signature: false },
  { hole: 3,  name: 'Lakeside Short', par: 3, hdcp: 15, yards: [185, 165, 145, 130], water: true,  bunkers: 2, mountain: false, signature: false },
  { hole: 4,  name: 'The Ridgeline',  par: 4, hdcp: 1,  yards: [435, 400, 360, 335], water: false, bunkers: 2, mountain: true,  signature: false },
  { hole: 5,  name: 'Creek Bend',     par: 4, hdcp: 11, yards: [390, 360, 330, 310], water: true,  bunkers: 1, mountain: false, signature: false },
  { hole: 6,  name: 'Forest Run',     par: 5, hdcp: 5,  yards: [555, 520, 475, 455], water: false, bunkers: 3, mountain: true,  signature: false },
  { hole: 7,  name: 'Island Approach',par: 3, hdcp: 17, yards: [175, 155, 140, 125], water: true,  bunkers: 3, mountain: false, signature: true  },
  { hole: 8,  name: 'The Dogleg',     par: 4, hdcp: 9,  yards: [415, 385, 350, 325], water: false, bunkers: 2, mountain: false, signature: false },
  { hole: 9,  name: 'Halfway Home',   par: 4, hdcp: 13, yards: [407, 377, 342, 318], water: false, bunkers: 1, mountain: false, signature: false },
  { hole: 10, name: 'The Turn',       par: 4, hdcp: 8,  yards: [428, 393, 355, 330], water: false, bunkers: 2, mountain: false, signature: false },
  { hole: 11, name: 'Bankhead Climb', par: 5, hdcp: 4,  yards: [552, 518, 478, 458], water: false, bunkers: 2, mountain: true,  signature: false },
  { hole: 12, name: 'Postcard Hole',  par: 3, hdcp: 16, yards: [190, 170, 150, 135], water: true,  bunkers: 4, mountain: false, signature: true  },
  { hole: 13, name: 'Deer Crossing',  par: 4, hdcp: 2,  yards: [438, 403, 363, 338], water: false, bunkers: 3, mountain: true,  signature: false },
  { hole: 14, name: 'The Pines',      par: 4, hdcp: 10, yards: [405, 372, 338, 315], water: false, bunkers: 2, mountain: true,  signature: false },
  { hole: 15, name: 'Trouble Water',  par: 5, hdcp: 6,  yards: [548, 514, 474, 454], water: true,  bunkers: 3, mountain: false, signature: true  },
  { hole: 16, name: 'Short but Nasty',par: 3, hdcp: 18, yards: [178, 158, 143, 128], water: false, bunkers: 4, mountain: false, signature: false },
  { hole: 17, name: 'Sunday Drive',   par: 4, hdcp: 12, yards: [432, 397, 357, 332], water: false, bunkers: 2, mountain: false, signature: false },
  { hole: 18, name: 'The Closer',     par: 4, hdcp: 14, yards: [407, 372, 337, 318], water: true,  bunkers: 3, mountain: false, signature: false },
]

export const frontNine = holes.slice(0, 9)
export const backNine  = holes.slice(9)

/** The hole with this number (1–18), or null. */
export const getHole = n => holes[Number(n) - 1] ?? null

/** Total par of a list of holes (all 18 by default). */
export const totalPar = (list = holes) => list.reduce((sum, h) => sum + h.par, 0)

/** Total yards of a list of holes from one tee (index into teeSets). */
export const totalYards = (teeIndex, list = holes) => list.reduce((sum, h) => sum + (h.yards[teeIndex] ?? 0), 0)

/** True when every hole has a ladies' handicap (hdcpLadies). */
export const hasLadiesHandicap = holes.every(h => h.hdcpLadies != null)

/** The hazards / features on a hole, in legend order: [{ key, label }]. */
export function holeFeatures(h) {
  const list = []
  if (h.water) list.push({ key: 'water', label: 'Water hazard' })
  if (h.bunkers > 0) list.push({ key: 'bunker', label: h.bunkers === 1 ? '1 bunker' : `${h.bunkers} bunkers` })
  if (h.mountain) list.push({ key: 'mountain', label: 'Elevated terrain' })
  if (h.signature) list.push({ key: 'signature', label: 'Signature hole' })
  return list
}
