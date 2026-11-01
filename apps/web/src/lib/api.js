import { useAuthStore } from '@/stores/auth'

function authHeaders(json = true) {
  const auth = useAuthStore()
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${auth.getToken()}` }
}

// The API's `error` message, or a readable fallback when the body is empty or not JSON
async function failure(res) {
  const data = await res.json().catch(() => ({}))
  const message = data.error || res.statusText || `Request failed (${res.status})`
  return Object.assign(new Error(message), { status: res.status, code: data.code })
}

/**
 * fetch() for our own /api endpoints: sends the bearer token and JSON body, and throws an
 * Error with the API's `error` message on a non-2xx response (plus `status` and the API's
 * optional `code`, e.g. APPROVAL_REQUIRED).
 */
export async function apiFetch(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res)
  return res.json()
}

/**
 * Downloads a file from an authenticated /api endpoint (CSV exports, statement PDFs). The file name comes from the
 * response's Content-Disposition, else `fallbackName`. Throws like apiFetch on an error response.
 */
export async function apiDownload(url, fallbackName = 'download') {
  const res = await fetch(url, { headers: authHeaders(false) })
  if (!res.ok) throw await failure(res)
  const disposition = res.headers.get('Content-Disposition') || ''
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName
  const href = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href, download: decodeURIComponent(name) })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
