import { DateTime } from 'luxon'
import { BadRequestError } from '../errors'

function readCalendarDate(value: unknown, field: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestError('expected YYYY-MM-DD | field: ' + field)
  }
  const day = DateTime.fromISO(value, { zone: 'Asia/Kuala_Lumpur' })
  if (!day.isValid || day.toISODate() !== value) {
    throw new BadRequestError('invalid calendar date | field: ' + field)
  }
  return day
}

export function readCalendarDateRange(body: Record<string, unknown>, resource: string) {
  if (Object.keys(body).some(key => !['business_id', 'date', 'from', 'to'].includes(key))) {
    throw new BadRequestError('unsupported filter | resource: ' + resource)
  }
  const legacy = 'date' in body
  if (legacy && ('from' in body || 'to' in body)) {
    throw new BadRequestError('date cannot be combined with from or to | resource: ' + resource)
  }
  const from = legacy ? readCalendarDate(body.date, 'date') : readCalendarDate(body.from, 'from')
  const to = legacy ? from : readCalendarDate(body.to, 'to')
  if (to.toMillis() < from.toMillis() || to.toMillis() >= from.plus({ years: 1 }).toMillis()) {
    throw new BadRequestError('expected a date from the start through the day before its anniversary | field: to')
  }
  return { from, to }
}
