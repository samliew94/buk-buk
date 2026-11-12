import { Guid } from '../value-objects/Guid'
import { Hono } from 'hono'
import { DateTime } from 'luxon'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'
import { MyDateTime } from '../utils/MyDateTime'

async function readBody(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: reservations')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: reservations')
  }
  return body as Record<string, unknown>
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

export const reservations = new Hono<AppEnv>()

reservations.query('/', async (c) => {
  const body = await readBody(c.req.raw)
  if (typeof body.business_id !== 'string' || !body.business_id.trim()) throw new BadRequestError('business_id must be a nonblank string | field: business_id')
  const businessId = Guid.from(body.business_id)
  const queryReservations = c.get('dependencies').queryReservations
  let result
  if ('from' in body || 'to' in body) {
    const from = readDateTime(body.from, 'from')
    const to = readDateTime(body.to, 'to')
    if (to.toMillis() <= from.toMillis()) {
      throw new BadRequestError('to must be after from | field: to')
    }
    result = await queryReservations.query(businessId, from, to)
  } else {
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(body.date)) {
      throw new BadRequestError('expected a UTC ISO datetime ending in Z | field: date')
    }
    const date = DateTime.fromISO(body.date, { zone: 'utc' })
    if (!date.isValid) {
      throw new BadRequestError('expected a valid UTC datetime | field: date')
    }
    result = await queryReservations.queryByDate(businessId, new MyDateTime(date))
  }
  return c.json(result.results.map((row) => ({
    id: row.id,
    room_id: row.room_id,
    room_category_id: row.room_category_id,
    customer_id: row.customer_id,
    status: row.status,
    created_at: row.created_at,
    expire_at: row.expire_at,
    from: row.from,
    to: row.to,
  })))
})
