// Google Maps embed for the course (an <iframe> src). With a real VITE_GOOGLE_MAPS_API_KEY it's the Maps Embed API
// (the .env.example placeholder starts with "your"); without one, Google's keyless embed of the same search, so the
// map still shows in dev and on preview builds.
import { mapsQuery } from '@/data/site'

const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const hasKey = !!key && !/^your/i.test(key)
const q = encodeURIComponent(mapsQuery)

export const mapEmbedUrl = hasKey
  ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${q}&zoom=14`
  : `https://maps.google.com/maps?q=${q}&z=14&output=embed`
