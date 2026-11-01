// Prints MD3 tonal palettes for the brand colors (the HCT palettes Material Theme Builder uses), from which
// src/assets/tokens.css picks its color roles: primary = pine (seed #1E3D2F), secondary = lake, tertiary = clay,
// neutral = warm parchment, plus gold (brand accent), success, warning and error.
// Run with `node scripts/gen-theme.mjs` when the brand colors change, then update tokens.css by hand.
import { argbFromHex, hexFromArgb, Hct, TonalPalette } from '@material/material-color-utilities'

const sources = {
  pine: ['#1E3D2F'],
  lake: ['#4A6670'],
  clay: ['#8C4A2F'],
  gold: ['#C4873A'],
  neutral: ['#F2EBD9', 6],          // parchment hue, low chroma
  neutralVariant: ['#E6DBC4', 10],
  success: ['#2E7D32'],
  warning: ['#B26A00'],
  error: ['#BA1A1A'],
}
const TONES = [0, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100]

for (const [name, [hex, chroma]] of Object.entries(sources)) {
  const hct = Hct.fromInt(argbFromHex(hex))
  const palette = TonalPalette.fromHueAndChroma(hct.hue, chroma ?? Math.max(hct.chroma, 24))
  console.log(`${name.padEnd(15)} (tone of source ${hct.tone.toFixed(0)})`)
  console.log('  ' + TONES.map(t => `${t}:${hexFromArgb(palette.tone(t))}`).join(' '))
}
