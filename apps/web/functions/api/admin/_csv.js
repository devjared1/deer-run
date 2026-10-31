// CSV helpers for admin exports (timesheets, sales)

export const dollars = (cents) => (cents / 100).toFixed(2)

export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value)
  // Keep spreadsheet apps from treating text as a formula
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header, rows) {
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function csvResponse(body, filename) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
