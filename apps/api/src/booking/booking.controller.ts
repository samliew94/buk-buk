import { requireAccessToken } from '../middleware/auth.middleware'
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

bookings.query('/', requireAccessToken, async (c) => {
  const body = await readBody(c.req.raw)
  if (Object.keys(body).some(key => !['business_id', 'date'].includes(key))) {
    throw new BadRequestError('unsupported filter | resource: bookings')
  }
  const businessId = readId(body.business_id, 'business_id')
  const date = body.date
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestError('expected YYYY-MM-DD | field: date')
  }
  const day = DateTime.fromISO(date, { zone: 'Asia/Kuala_Lumpur' })
  if (!day.isValid || day.toISODate() !== date) {
    throw new BadRequestError('invalid calendar date | field: date')
  }
  return c.json(await c.get('dependencies').queryBookings.query(businessId, new MyDateTime(day)))
})

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
  if ('quantity' in body && (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 4)) {
    throw new BadRequestError('quantity must be an integer from 1 to 4 | field: quantity')
  }
  const roomCategoryId = readId(body.room_category_id, 'room_category_id')
  const result = await c.get('dependencies').createBooking.exec(businessId, customerId, from, duration, roomCategoryId, (body.quantity as number | undefined) ?? 1, true)
  return c.json({ booking_id: result.booking_id.value, payment_url: result.payment_url }, 201)
})

bookings.put('/:bookingId', requireAccessToken, async (c) => {
  const body = await readBody(c.req.raw)
  if (Object.keys(body).some(key => key !== 'reservations')) {
    throw new BadRequestError('unsupported field | resource: booking')
  }
  if (!Array.isArray(body.reservations) || body.reservations.length === 0) {
    throw new BadRequestError('expected a nonempty array | field: reservations')
  }
  const reservations = body.reservations.map((entry: unknown, index: number) => {
    const field = 'reservations.' + index
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new BadRequestError('expected an object | field: ' + field)
    }
    const row = entry as Record<string, unknown>
    if (Object.keys(row).some(key => !['room_id', 'from', 'duration'].includes(key))) {
      throw new BadRequestError('unsupported field | field: ' + field)
    }
    const roomId = readId(row.room_id, field + '.room_id')
    const from = readDateTime(row.from, field + '.from')
    if (typeof row.duration !== 'number' || !Number.isFinite(row.duration) || row.duration <= 0) {
      throw new BadRequestError('expected finite positive minutes | field: ' + field + '.duration')
    }
    const to = from.plus({ minutes: row.duration })
    if (!to.isValid || to.toMillis() <= from.toMillis()) {
      throw new BadRequestError('invalid calculated end time | field: ' + field + '.duration')
    }
    return { room_id: roomId.value, from: from.toUTC().toISO()!, to: to.toUTC().toISO()! }
  })
  return c.json(await c.get('dependencies').updateBooking.exec(
    readId(c.req.param('bookingId'), 'booking_id'), reservations))
})
