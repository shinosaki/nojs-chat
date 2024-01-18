import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { openKv } from "@deno/kv";
import App from './app.jsx'

const kv = await openKv('.db/denokv.db')
const app = new Hono()

app.use('*', async (c, next) => {
  c.kv = kv
  await next()
})

app.route('/', App)

const port = 4000
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
