// The time clock kiosk (/timeclock on the iPad) talks to /api/kiosk/* with the device token it got when an admin set
// it up (POST /api/admin/kiosks). The token lives in this browser's localStorage; nobody is signed in on the device.

const TOKEN_KEY = 'deerrun.kioskToken'

export function getKioskToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setKioskToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private browsing: the kiosk then has to be set up again after a reload
  }
}

/**
 * fetch() for /api/kiosk/*: sends the device token and a JSON body, and throws an Error with the API's `error`
 * message on a non-2xx response, plus `status`, `code` (e.g. PIN_WRONG, KIOSK_NOT_SET_UP) and `data` (the body).
 * A network failure throws with code 'OFFLINE'.
 */
export async function kioskFetch(url, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Kiosk-Token': getKioskToken() ?? '' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw Object.assign(new Error('Can\'t reach the server. Check the Wi-Fi and try again.'), { code: 'OFFLINE' })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, code: data.code, data })
  }
  return data
}
