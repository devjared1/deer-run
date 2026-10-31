// Full local dev: Pages Functions (wrangler, :8788) + Vite dev server (:5173) together.
// Open http://localhost:5173. Vite forwards /api/* to wrangler (server.proxy in vite.config.js).
//
// Why not `wrangler pages dev --proxy 5173 -- vite`: because wrangler.toml sets
// pages_build_output_dir, Wrangler 4 always serves that directory and refuses a proxy command
// ("Specify either a directory OR a proxy command, not both"). So the API runs on its own and
// Vite proxies to it instead.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

// wrangler serves dist/ alongside the Functions; it only needs to exist for local dev
mkdirSync('dist', { recursive: true })

const processes = [
  spawn('npx', ['wrangler', 'pages', 'dev', '--port', '8788'], { stdio: 'inherit', shell: true }),
  spawn('npx', ['vite'], { stdio: 'inherit', shell: true }),
]

// If either stops, stop the other
function stopAll(code) {
  for (const p of processes) if (p.exitCode === null) p.kill()
  process.exit(code)
}
for (const p of processes) p.on('exit', (code) => stopAll(code ?? 0))
process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
