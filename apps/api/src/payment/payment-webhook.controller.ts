import { Hono } from 'hono'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'

export const paymentWebhook = new Hono<AppEnv>()

paymentWebhook.post('/demo', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: payment webhook')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: payment webhook')
  }

  const payload = body as Record<string, unknown>
  await c.get('dependencies').handleDemoPaymentWebhook.exec(payload)
  return c.body(null, 204)
})
