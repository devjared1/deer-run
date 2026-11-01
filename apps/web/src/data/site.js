// Course contact details, hours and links shown in the footer (and later the Contact page, Home "Plan your visit"
// strip and JSON-LD). Plain JS, no '@/' imports, so anything can import it.

export const courseName = 'Deer Run Golf Course'

export const address = {
  street:   '1175 County Road 100',
  locality: 'Moulton',
  region:   'AL',
  postalCode: '35650',
}
export const addressLines = [address.street, `${address.locality}, ${address.region} ${address.postalCode}`]
const addressQuery = encodeURIComponent(`${courseName}, ${addressLines.join(', ')}`)

export const phone = { display: '(256) 974-7384', tel: '+12569747384' }
export const email = 'proshop@deerrun.golf'

// Not yet confirmed by the course (docs/ui-ux-review.md B15): these are the values the footer has always shown.
export const hours = [
  'Open daily · 7:30 AM',
  'Closed Christmas Eve & Day',
]

export const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${addressQuery}`
export const appleMapsUrl = `https://maps.apple.com/?daddr=${addressQuery}`

// The course is owned by the City of Moulton
export const cityPageUrl = 'https://cityofmoultonal.com/deer_run_golf_course'

// Social profiles: { label: 'Facebook', url, icon } (icon: a component, e.g. from '~icons/simple-icons/…').
// Empty until the course confirms which pages are its own; the footer renders nothing while it's empty.
export const social = []
