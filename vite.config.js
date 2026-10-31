import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev only: parse .env ourselves so edits apply without a restart
// (Vite's loadEnv lets already-loaded values win over the file).
function readDotEnv() {
  const out = {}
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
      if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch {}
  return out
}

// Dev only: serve the /api/*.js Vercel functions from the Vite dev server, so
// `npm run dev` works end to end without `vercel dev`. Not used in production builds.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url && req.url.match(/^\/api\/([\w-]+)/)
        if (!m) return next()
        try {
          Object.assign(process.env, readDotEnv()) // re-read .env on every call
          let raw = ''
          for await (const chunk of req) raw += chunk
          req.body = raw ? JSON.parse(raw) : {}
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          await mod.default(req, res)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Local API error', detail: String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
})
