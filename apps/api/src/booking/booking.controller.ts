import { Hono } from 'hono'
import { DateTime } from 'luxon'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'
import { MyDateTime } from '../utils/MyDateTime'
import { Guid } from '../value-objects/Guid'
import { PositiveDuration } from '../value-objects/PositiveDuration'

async function readBody(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: booking')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: booking')
  }
  return body as Record<string, unknown>
}

function readId(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError('expected a nonblank string | field: ' + field)
  }
  return Guid.from(value)
}

function readDateTime(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new BadRequestError('expected an ISO datetime | field: ' + field)
  }
  const dateTime = DateTime.fromISO(value, { zone: 'Asia/Kuala_Lumpur' })
  if (!value.includes('T') || !dateTime.isValid) {
    throw new BadRequestError('expected an ISO datetime | field: ' + field)
  }
  return dateTime
}

export const bookings = new Hono<AppEnv>()

bookings.get('/:bookingId', async (c) => {
  const booking = await c.get('dependencies').queryBooking.query(Guid.from(c.req.param('bookingId')))
  return c.json(booking)
})

bookings.post('/', async (c) => {
  const body = await readBody(c.req.raw)
  const businessId = readId(body.business_id, 'business_id')
  const customerId = readId(body.customer_id, 'customer_id')
  const from = new MyDateTime(readDateTime(body.from, 'from'))
  if (typeof body.duration !== 'number' || !Number.isFinite(body.duration) || body.duration <= 0) {
    throw new BadRequestError('duration must be a finite positive number of minutes | field: duration')
  }
  const duration = PositiveDuration.fromMinutes(body.duration)
  if (!from.plus(duration).value.isValid) {
    throw new BadRequestError('duration exceeds datetime range | field: duration')
  }
  const roomCategoryId = readId(body.room_category_id, 'room_category_id')
  const result = await c.get('dependencies').createBooking.exec(businessId, customerId, from, duration, roomCategoryId)
  return c.json({ booking_id: result.booking_id.value, payment_url: result.payment_url }, 201)
})
