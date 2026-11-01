// Shared helpers for the navigation components (NavDrawer, NavRail, BottomNavBar). Plain JS, no '@/' imports.
//
// A nav item:
//   { to, label, icon, badge?, badgeLabel?, exact?, active?, action?, expanded? }
//   to         — RouterLink target (string or route object). Leave it out for a button item (with `action`).
//   label      — visible text (also the accessible name).
//   icon       — an icon component, e.g. import IconDashboard from '~icons/material-symbols/dashboard-rounded'.
//   badge      — a number (shown as a pill, capped at 99+; 0 hides it), a short string, or true (a dot).
//   badgeLabel — what screen readers hear for the badge, e.g. "3 pending requests" (default "3 new").
//   exact      — active only on an exact path match. Root items ('/', '/admin', '/staff') are exact automatically.
//   active     — overrides route matching (e.g. a "More" button that's active while on an overflow page).
//   action     — for button items: the nav component emits `select` with the item ('more' also emits `more`).
//   expanded   — button items: sets aria-expanded (e.g. "More" while its sheet is open).
//
// Sections: [{ title, items }]. A section without a title renders without a heading.

/** The path of a RouterLink target (string, { path }, or null for a { name } target) */
function targetPath(to) {
  if (!to) return null
  if (typeof to === 'string') return to.split(/[?#]/)[0]
  return to.path ?? null
}

/**
 * Whether `item` is the current destination. `route` is the route object (useRoute()) or a path string.
 * Exact match for `exact` items and root items (one path segment or fewer); otherwise a prefix match on whole
 * segments, so /admin/house-accounts/123 activates /admin/house-accounts but /admin/sales-x doesn't match /admin/sales.
 */
export function isActiveRoute(route, item) {
  if (!item) return false
  if (typeof item.active === 'boolean') return item.active
  if (!item.to) return false
  const path = typeof route === 'string' ? route : route?.path
  if (!path) return false

  if (typeof item.to === 'object' && item.to.name && !item.to.path) {
    return typeof route === 'object' && route?.name === item.to.name
  }

  const to = targetPath(item.to).replace(/\/+$/, '') || '/'
  const current = path.replace(/\/+$/, '') || '/'
  const isRoot = to.split('/').filter(Boolean).length <= 1
  if (item.exact || isRoot) return current === to
  return current === to || current.startsWith(`${to}/`)
}

/** True for a button item (no `to`): the nav component renders a <button> and emits `select` */
export function isActionItem(item) {
  return !item.to
}

/** Normalizes the `items` / `sections` props into [{ title, items }] */
export function toSections(items, sections) {
  if (sections?.length) return sections.map(s => ({ title: s.title ?? null, items: s.items ?? [] }))
  return items?.length ? [{ title: null, items }] : []
}

/**
 * Groups a flat list by a field (default `group`) into [{ title, items }], keeping the order in which each group
 * first appears. Items without the field go in an untitled section at that position.
 */
export function groupItems(items, key = 'group') {
  const sections = []
  const byTitle = new Map()
  for (const item of items ?? []) {
    const title = item[key] ?? null
    if (!byTitle.has(title)) {
      const section = { title, items: [] }
      byTitle.set(title, section)
      sections.push(section)
    }
    byTitle.get(title).items.push(item)
  }
  return sections
}

/** Whether the item shows a badge (0, '', null, false hide it) */
export function hasBadge(item) {
  const b = item?.badge
  return b === true || (typeof b === 'number' && b > 0) || (typeof b === 'string' && b !== '')
}

/** Whether the badge is a dot (no text) */
export function isDotBadge(item) {
  return item?.badge === true
}

/** The visible badge text: numbers over 99 become "99+" */
export function badgeText(item) {
  const b = item?.badge
  if (typeof b === 'number') return b > 99 ? '99+' : String(b)
  return typeof b === 'string' ? b : ''
}

/** What screen readers hear for the badge */
export function badgeA11yLabel(item) {
  if (item?.badgeLabel) return item.badgeLabel
  const b = item?.badge
  if (typeof b === 'number') return `${b} new`
  if (typeof b === 'string') return b
  return 'new'
}

/** A stable v-for key */
export function itemKey(item, index = 0) {
  if (typeof item.to === 'string') return item.to
  if (item.to) return JSON.stringify(item.to)
  return `${item.action ?? 'item'}-${item.label ?? index}`
}
