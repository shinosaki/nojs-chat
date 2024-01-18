import { Hono } from 'hono'
import App from './app.jsx'

const kv = await Deno.openKv()
const app = new Hono()

app.use('*', async (c, next) => {
  c.kv = kv
  await next()
})

app.route('/', App)

Deno.serve(app.fetch)
