import { formatLocalDate, toUtcIso, COURSE_TZ } from '../../../src/lib/timeclock.js'

// House account statement as a letter-size PDF (attached to statement and reminder emails). Hand-written PDF 1.4
// with the standard Helvetica fonts, so there's no dependency; it has the same contents as the printable page
// (src/components/accounts/StatementDocument.vue).

const PAGE_W = 612
const PAGE_H = 792
const LEFT = 54
const RIGHT = PAGE_W - 54
const BOTTOM = PAGE_H - 72 // lowest row baseline (top-down)

const COLORS = {
  text: '0.239 0.169 0.102', // bark
  gray: '0.45 0.45 0.45',
  light: '0.85 0.85 0.85',
  credit: '0.118 0.239 0.184', // pine
  alert: '0.549 0.29 0.184',   // clay
}

// Helvetica / Helvetica-Bold widths (1/1000 em) for WinAnsi 32–126
const WIDTHS = {
  regular: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556,
    222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
  bold: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667,
    778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278,
    278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584],
}
// WinAnsi codes (and widths) for the non-ASCII characters our text uses
const SPECIAL = {
  '–': [0x96, 556, 556], '—': [0x97, 1000, 1000], '•': [0x95, 350, 350], '·': [0xb7, 278, 278], '…': [0x85, 1000, 1000],
  '‘': [0x91, 222, 278], '’': [0x92, 222, 278], '“': [0x93, 333, 500], '”': [0x94, 333, 500], '−': [0x2d, 333, 333],
}

/** Unicode text → WinAnsi codes (unknown characters become "?"). */
function encode(text) {
  const codes = []
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0)
    if (SPECIAL[ch]) codes.push(SPECIAL[ch][0])
    else if ((c >= 32 && c <= 126) || (c >= 0xa0 && c <= 0xff)) codes.push(c)
    else codes.push(0x3f)
  }
  return codes
}

function widthOf(text, size, bold = false) {
  let units = 0
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0)
    if (SPECIAL[ch]) units += SPECIAL[ch][bold ? 2 : 1]
    else if (c >= 32 && c <= 126) units += WIDTHS[bold ? 'bold' : 'regular'][c - 32]
    else units += 556
  }
  return (units * size) / 1000
}

/** Shortens text with an ellipsis to fit maxWidth points. */
function fit(text, size, maxWidth, bold = false) {
  let s = String(text ?? '')
  if (widthOf(s, size, bold) <= maxWidth) return s
  while (s && widthOf(`${s}…`, size, bold) > maxWidth) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

/** PDF literal string: ( ) \ escaped, bytes outside ASCII as octal. */
function pdfString(text) {
  let out = '('
  for (const c of encode(text)) {
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += `\\${String.fromCharCode(c)}`
    else if (c < 32 || c > 126) out += `\\${c.toString(8).padStart(3, '0')}`
    else out += String.fromCharCode(c)
  }
  return `${out})`
}

/** One page's drawing operations; y is measured from the top of the page. */
class Page {
  constructor() { this.ops = [] }
  text(str, x, y, { size = 9, bold = false, color = COLORS.text, align = 'left' } = {}) {
    const w = widthOf(str, size, bold)
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${left.toFixed(2)} ${(PAGE_H - y).toFixed(2)} Td ${pdfString(str)} Tj ET`)
  }
  line(x1, y1, x2, y2, { color = COLORS.light, width = 0.75 } = {}) {
    this.ops.push(`${color} RG ${width} w ${x1} ${(PAGE_H - y1).toFixed(2)} m ${x2} ${(PAGE_H - y2).toFixed(2)} l S`)
  }
}

/** Assembles pages into PDF bytes, as a binary string (every char < 256). */
function assemble(pages, title) {
  const objects = []
  const add = (body) => { objects.push(body); return objects.length }
  const catalog = add(null)
  const pagesId = add(null)
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const kids = pages.map(page => {
    const stream = page.ops.join('\n')
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`)
  })
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
  const info = add(`<< /Title ${pdfString(title)} /Producer (Deer Run Golf Course) >>`)

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return out
}

const money = (cents) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const longDate = { month: 'long', day: 'numeric', year: 'numeric' }
const shortDate = { month: 'short', day: 'numeric', year: 'numeric' }
const entryDate = (ts) => new Date(toUtcIso(ts)).toLocaleDateString('en-US', { ...shortDate, timeZone: COURSE_TZ })

export function statementPdfFilename(statement) {
  return statement.periodStart.slice(0, 7) === statement.periodEnd.slice(0, 7) && statement.periodStart.endsWith('-01')
    ? `deer-run-statement-${statement.periodStart.slice(0, 7)}.pdf`
    : `deer-run-statement-${statement.periodStart}-to-${statement.periodEnd}.pdf`
}

/**
 * The statement as a PDF, base64-encoded (for a Resend attachment).
 *   statement: { periodStart, periodEnd, openingCents, chargesCents, creditsCents, closingCents, dueDate?, entries }
 *   member:    { name, email }
 *   notice:    optional line printed in the accent color above the activity (e.g. "Past due …")
 */
export function statementPdfBase64(statement, member, { notice = null } = {}) {
  const range = `${formatLocalDate(statement.periodStart, longDate)} – ${formatLocalDate(statement.periodEnd, longDate)}`
  const pages = []
  let page = new Page()
  pages.push(page)

  // Header
  page.text('Deer Run Golf Course', LEFT, 72, { size: 16, bold: true })
  page.text('1175 County Road 100 · Moulton, AL 35650 · (256) 974-7384', LEFT, 88, { color: COLORS.gray })
  page.text('House Account Statement', RIGHT, 72, { size: 13, bold: true, align: 'right' })
  page.text(range, RIGHT, 88, { color: COLORS.gray, align: 'right' })
  page.line(LEFT, 100, RIGHT, 100)

  // Member and summary
  page.text('MEMBER', LEFT, 122, { size: 7.5, color: COLORS.gray })
  page.text(fit(member?.name || member?.email || '', 10, 280, true), LEFT, 136, { size: 10, bold: true })
  if (member?.name && member?.email) page.text(fit(member.email, 9, 280), LEFT, 149, { color: COLORS.gray })

  const labelX = 400
  const rows = [['Previous balance', statement.openingCents], ['Charges', statement.chargesCents], ['Payments & credits', statement.creditsCents]]
  rows.forEach(([label, cents], i) => {
    page.text(label, labelX, 122 + i * 14, { color: COLORS.gray })
    page.text(money(cents), RIGHT, 122 + i * 14, { align: 'right' })
  })
  page.line(labelX, 158, RIGHT, 158, { color: COLORS.gray })
  page.text(statement.closingCents > 0 ? 'Balance due' : 'Balance', labelX, 171, { bold: true })
  page.text(money(statement.closingCents), RIGHT, 171, { bold: true, align: 'right' })
  let y = 171
  if (statement.dueDate && statement.closingCents > 0) {
    y += 14
    page.text('Due by', labelX, y, { color: COLORS.gray })
    page.text(formatLocalDate(statement.dueDate, shortDate), RIGHT, y, { align: 'right' })
  }
  y += 24
  if (notice) {
    page.text(fit(notice, 10, RIGHT - LEFT, true), LEFT, y, { size: 10, bold: true, color: COLORS.alert })
    y += 22
  }

  // Activity
  const descX = LEFT + 90
  const tableHeader = (p, top) => {
    p.text('DATE', LEFT, top, { size: 7.5, bold: true, color: COLORS.gray })
    p.text('DESCRIPTION', descX, top, { size: 7.5, bold: true, color: COLORS.gray })
    p.text('AMOUNT', RIGHT, top, { size: 7.5, bold: true, color: COLORS.gray, align: 'right' })
    p.line(LEFT, top + 6, RIGHT, top + 6)
    return top + 20
  }
  y = tableHeader(page, y)
  const entries = statement.entries ?? []
  for (const e of entries) {
    if (y > BOTTOM) {
      page = new Page()
      pages.push(page)
      page.text(`Deer Run Golf Course — House Account Statement, ${range} (continued)`, LEFT, 60, { color: COLORS.gray })
      y = tableHeader(page, 90)
    }
    page.text(entryDate(e.createdAt), LEFT, y, { color: COLORS.gray })
    page.text(fit(e.description, 9, RIGHT - descX - 90), descX, y)
    page.text(money(e.amountCents), RIGHT, y, { align: 'right', color: e.amountCents < 0 ? COLORS.credit : COLORS.text })
    page.line(LEFT, y + 5, RIGHT, y + 5, { color: '0.93 0.93 0.93', width: 0.5 })
    y += 16
  }
  if (!entries.length) {
    page.text('No activity in this period.', (LEFT + RIGHT) / 2, y + 4, { color: COLORS.gray, align: 'center' })
    y += 20
  }

  // Footer
  if (y + 30 > PAGE_H - 40) {
    page = new Page()
    pages.push(page)
    y = 60
  }
  y += 16
  page.line(LEFT, y, RIGHT, y)
  page.text(statement.closingCents > 0 ? 'Pay online in My Account at deerrun.golf, or at the pro shop.' : 'Nothing is due. Thank you!',
    LEFT, y + 16, { size: 8, color: COLORS.gray })
  page.text('Charges show what was charged to your account at the register; your receipts list the items.', LEFT, y + 28,
    { size: 8, color: COLORS.gray })

  if (pages.length > 1) {
    pages.forEach((p, i) => p.text(`Page ${i + 1} of ${pages.length}`, RIGHT, PAGE_H - 36, { size: 7.5, color: COLORS.gray, align: 'right' }))
  }
  return btoa(assemble(pages, `Deer Run house account statement, ${range}`))
}
