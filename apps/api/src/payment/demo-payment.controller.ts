import { Guid } from '../value-objects/Guid'
import { Hono } from 'hono'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'
import { DemoPaymentStatus } from './demo-payment-status.enum'

export const demoPayments = new Hono<AppEnv>()

demoPayments.get('/:orderId', async (c) => {
  const order = await c.get('dependencies').queryDemoPaymentOrder.query(Guid.from(c.req.param('orderId')))
  return c.json(order)
})

demoPayments.put('/:orderId', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: demo payment order')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: demo payment order')
  }
  const status = (body as Record<string, unknown>).status
  if (status !== DemoPaymentStatus.PAID && status !== DemoPaymentStatus.CANCELLED && status !== DemoPaymentStatus.REJECTED) {
    throw new BadRequestError('expected paid, cancelled or rejected | field: status')
  }
  const result = await c.get('dependencies').submitDemoPayment.exec(c.req.param('orderId'), status)
  return c.json(result)
})
