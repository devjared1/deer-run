// Course contact details, hours and links shown in the footer and the Contact page (and later the Home "Plan your visit"
// strip and JSON-LD). Plain JS, no '@/' imports, so anything can import it.

export const courseName = 'Deer Run Golf Course'

export const address = {
  street:   '1175 County Road 100',
  locality: 'Moulton',
  region:   'AL',
  postalCode: '35650',
}
export const addressLines = [address.street, `${address.locality}, ${address.region} ${address.postalCode}`]

export const phone = { display: '(256) 974-7384', tel: '+12569747384' }
export const email = 'proshop@deerrun.golf'

// Opening hours: the one source for the Contact page and the footer (and later Home and JSON-LD).
// Not yet confirmed by the course (docs/ui-ux-review.md B15): these are the hours the Contact page has listed.
export const hoursByDay = [
  { days: 'Monday – Friday', hours: '7:30 AM – 5:00 PM' },
  { days: 'Saturday',        hours: '7:00 AM – 5:00 PM' },
  { days: 'Sunday',          hours: '7:30 AM – 5:00 PM' },
  { days: 'Holidays',        hours: '8:00 AM – 4:00 PM' },
]
export const hoursNotes = [
  'Closed Christmas Eve and Christmas Day.',
  'Last tee time 5:00 PM daily.',
  'Hours subject to seasonal change.',
]
// The same hours as short lines, for compact places (footer)
export const hours = [
  ...hoursByDay.map(h => `${h.days} · ${h.hours}`),
  'Closed Christmas Eve & Christmas Day',
]

// Search text for map links and the optional embedded map
export const mapsQuery = `${courseName}, ${addressLines.join(', ')}`
const addressQuery = encodeURIComponent(mapsQuery)
export const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${addressQuery}`
export const appleMapsUrl = `https://maps.apple.com/?daddr=${addressQuery}`

// The course is owned by the City of Moulton
export const cityPageUrl = 'https://cityofmoultonal.com/deer_run_golf_course'

// Social profiles: { label: 'Facebook', url, icon } (icon: a component, e.g. from '~icons/simple-icons/…').
// Empty until the course confirms which pages are its own; the footer renders nothing while it's empty.
export const social = []
