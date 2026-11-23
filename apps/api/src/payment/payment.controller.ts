import { requireAccessToken } from '../middleware/auth.middleware'
import { Hono } from 'hono'
import { readCalendarDateRange } from '../utils/readCalendarDateRange'
import { BadRequestError } from '../errors'
import { Guid } from '../value-objects/Guid'
import { MyDateTime } from '../utils/MyDateTime'
import type { AppEnv } from '../dependencies'

async function readBody(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: payment')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: payment')
  }
  return body as Record<string, unknown>
}

function readId(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError('expected a nonblank string | field: ' + field)
  }
  return Guid.from(value)
}

export const payments = new Hono<AppEnv>()

payments.query('/', requireAccessToken, async (c) => {
  const body = await readBody(c.req.raw)
  const { from, to } = readCalendarDateRange(body, 'payments')
  const businessId = readId(body.business_id, 'business_id')
  return c.json(await c.get('dependencies').queryPayments.query(businessId, new MyDateTime(from), new MyDateTime(to)))
})

payments.get('/:paymentId', async (c) => {
  const payment = await c.get('dependencies').queryPayment.query(c.req.param('paymentId'))
  return c.json(payment)
})
