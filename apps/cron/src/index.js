// Daily jobs for deerrun.golf, run by a Cloudflare cron trigger (see wrangler.toml).
// Each job is a POST to a protected endpoint on the site, authenticated with the shared CRON_SECRET.

const JOBS = [
  '/api/internal/memberships', // renewal reminders + move lapsed members to GUEST
  '/api/internal/statements', // house account statements for last month (only creates what's missing) + autopay,
  //                             then overdue reminders and late fees
  '/api/internal/bookings', // release unpaid online bookings past their 30-minute hold that nobody viewed
  '/api/internal/pace', // learn per-hole times from the last 60 days of position reports
]

async function runJobs(env) {
  const results = []
  for (const path of JOBS) {
    try {
      const res = await fetch(new URL(path, env.SITE_URL), {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      })
      const body = await res.text()
      results.push({ path, status: res.status, body: body.slice(0, 2000) })
      if (!res.ok) console.error(`${path} failed: ${res.status} ${body}`)
      else console.log(`${path}: ${body}`)
    } catch (e) {
      results.push({ path, error: e.message })
      console.error(`${path} failed: ${e.message}`)
    }
  }
  return results
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runJobs(env))
  },
}
