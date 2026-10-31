import { useAuthStore } from '@/stores/auth'

/**
 * fetch() for our own /api endpoints: sends the bearer token and JSON body, and throws an
 * Error with the API's `error` message on a non-2xx response (plus `status` and the API's
 * optional `code`, e.g. APPROVAL_REQUIRED).
 */
export async function apiFetch(url, { method = 'GET', body } = {}) {
  const auth = useAuthStore()
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.getToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error || res.statusText), { status: res.status, code: data.code })
  }
  return res.json()
}
