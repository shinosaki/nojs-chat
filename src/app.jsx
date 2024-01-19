/** @jsx jsx */
/** @jsxFrag Fragment */
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { Fragment, jsx } from 'hono/jsx'
import { compress } from 'hono/compress'

const sleep = (t) => new Promise((r) => setTimeout(() => r(), t))

const app = new Hono()

app.get('/', compress(), (c) => {
  return c.html(
    <>
      <iframe src='/send' style='border: none; height: 2rem;' />
      <div style='width: fit-content; border-width: 2px; border-color: rgb(34 211 238); border-style: solid; border-radius: 0.5rem;'>
        <iframe src='/chat' style='border: none; width: 50vw; height: 80vh;' />
      </div>
    </>,
  )
})

app.get('/send', /*compress(),*/ (c) => {
  const { message } = c.req.query()

  return c.html(
    <form method='post'>
      <input name='message' value={message} />
      <button>Send</button>
    </form>,
  )
})

app.post('/send', async (c) => {
  const { message } = await c.req.parseBody()

  const data = { data: message, timestamp: Date.now() }
  const result = await c.kv.atomic()
    .set(['message', data.timestamp], data)
    .sum(['message_count'], BigInt(1))
    .commit()

  return c.redirect(result.ok ? '/send' : '/send?error=Failed to send message.')
})

app.get('/chat', (c) =>
  stream(c, async (s) => {
    c.header('Content-Type', 'text/html; charset=UTF-8')
    c.header('Cache-Control', 'no-cache')

    let isAborted = false
    s.onAbort(() => {
      console.log('Aborted')
      isAborted = true
    })

    await s.writeln('<div style="display: flex; flex-direction: column-reverse;">')

    const messages = c.kv.list({ prefix: ['message'] })
    for await (const message of messages) {
      await s.writeln(<li>{message.value.data}</li>)
    }

    await s.writeln(<li>----- New message -----</li>)

    const getMessageCount = (kv) =>
      kv.get(['message_count']).then((r) => r.value ? Number(r.value.value) : null)

    let count = await getMessageCount(c.kv) ?? 0
    for await (const v of c.kv.watch([['message_count']])) {
      if (isAborted) break

      const latestCount = await getMessageCount(c.kv)

      if (count < latestCount) {
        const messages = c.kv.list({ prefix: ['message'] }, {
          limit: latestCount - count,
          reverse: true,
        })

        for await (const message of messages) {
          await s.writeln(<li>{message.value.data}</li>)
        }

        count = latestCount
      }
    }
  })
)

export default app
