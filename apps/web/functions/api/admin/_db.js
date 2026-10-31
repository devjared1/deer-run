// PostgREST returns at most 1,000 rows per request; page through larger results
const PAGE = 1000

/** Runs `makeQuery()` (a fresh, ordered select each time) page by page and returns every row. */
export async function fetchAll(makeQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return rows
  }
}
