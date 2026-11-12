import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/index'
import { createDependencies } from '../src/dependencies'
import { Guid } from '../src/value-objects/Guid'

const input = {
  business_id: 'business-1', customer_id: 'customer-1',
  from: '2026-11-03T10:00:00+08:00', duration: 60, room_category_id: 'family',
}
const range = { business_id: 'business-1', from: input.from, to: '2026-11-03T12:00:00+08:00' }

function fixture(paymentUrl: string | null = null) {
  const calls: unknown[][] = []
  const app = createApp(env => ({
    ...createDependencies(env),
    createBooking: { exec: async (businessId, customerId, from, duration, roomCategoryId) => {
      calls.push([businessId.value, customerId.value, from.toUtcIso(), duration.value.as('minutes'), roomCategoryId.value])
      return { booking_id: Guid.from('booking-1'), payment_url: paymentUrl }
    } },
    queryReservations: { queryByDate: async (businessId, date) => {
      calls.push(['queryByDate', businessId.value, date.toUtcIso()])
      return { results: [{ id: 'booking-1', room_id: 'room-1', room_category_id: 'family', customer_id: 'customer-1', status: 'confirmed', created_at: 'now', expire_at: 'deadline', from: 'start', to: 'end' }], success: true, meta: {} } as unknown as D1Result<Record<string, unknown>>
    }, query: async (businessId, from, to) => {
      calls.push([businessId.value, from.toUTC().toISO(), to.toUTC().toISO()])
      return { results: [{ id: 'booking-1', room_id: 'room-1', room_category_id: 'family', customer_id: 'customer-1', status: 'confirmed', created_at: 'now', expire_at: 'deadline', from: 'start', to: 'end' }], success: true, meta: {} } as unknown as D1Result<Record<string, unknown>>
    } },
  }))
  return { calls, request: (path: string, method: string, body?: string) => app.request(path, { method, body }, {}) }
}

test('POST bookings passes value objects to CreateBooking and serializes its result', async () => {
  for (const paymentUrl of [null, 'https://example.com/payment']) {
    const { request, calls } = fixture(paymentUrl)
    const response = await request('/v1/bookings', 'POST', JSON.stringify(input))
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { booking_id: 'booking-1', payment_url: paymentUrl })
    assert.deepEqual(calls, [['business-1', 'customer-1', '2026-11-03T02:00:00.000Z', 60, 'family']])
  }
})

test('QUERY reservations uses JSON dates and returns snake_case records without D1 metadata', async () => {
  const { request, calls } = fixture()
  const response = await request('/v1/reservations?from=ignored&to=ignored', 'QUERY', JSON.stringify(range))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), [{ id: 'booking-1', room_id: 'room-1', room_category_id: 'family', customer_id: 'customer-1', status: 'confirmed', created_at: 'now', expire_at: 'deadline', from: 'start', to: 'end' }])
  assert.deepEqual(calls, [['business-1', '2026-11-03T02:00:00.000Z', '2026-11-03T04:00:00.000Z']])
})

test('QUERY reservations routes a UTC day-start timestamp to queryByDate', async () => {
  const { request, calls } = fixture()
  const response = await request('/v1/reservations?date=ignored', 'QUERY', JSON.stringify({ business_id: 'business-1', date: '2025-12-31T16:00:00Z' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), [{ id: 'booking-1', room_id: 'room-1', room_category_id: 'family', customer_id: 'customer-1', status: 'confirmed', created_at: 'now', expire_at: 'deadline', from: 'start', to: 'end' }])
  assert.deepEqual(calls, [['queryByDate', 'business-1', '2025-12-31T16:00:00.000Z']])
})

test('QUERY reservations prioritizes a provided range over date', async () => {
  const { request, calls } = fixture()
  const response = await request('/v1/reservations', 'QUERY', JSON.stringify({ ...range, date: '2026-11-03' }))
  assert.equal(response.status, 200)
  assert.deepEqual(calls, [['business-1', '2026-11-03T02:00:00.000Z', '2026-11-03T04:00:00.000Z']])
})

test('booking routes reject invalid input before invoking use cases', async () => {
  const { request, calls } = fixture()
  for (const [path, method, valid, invalid] of [
    ['/v1/bookings', 'POST', input, [
      { ...input, business_id: ' ' }, { ...input, customer_id: null },
      { ...input, from: '2026-11-03' }, { ...input, from: 'invalid' },
      ...[null, 0, -1, '60'].map(duration => ({ ...input, duration })),
      ...[null, [], [' '], [1]].map(roomCategoryId => ({ ...input, room_category_id: roomCategoryId })),
    ]],
    ['/v1/reservations', 'QUERY', range, [
      { ...range, from: null }, { ...range, to: 'invalid' },
      { ...range, to: range.from }, { ...range, to: '2026-11-02T10:00:00+08:00' },
      ...[null, 42, '', '2026-02-30T16:00:00Z', '2026-11-03', '2026-1-3', '2025-12-31T16:00:00', '2026-01-01T00:00:00+08:00'].map(date => ({ date })),
      { date: '2026-11-03', from: range.from },
      { date: '2026-11-03', to: range.to },
    ]],
  ] as const) {
    const missingFields = Object.keys(valid).map(key => {
      const body = { ...valid } as Record<string, unknown>
      delete body[key]
      return body
    })
    for (const body of [undefined, '{', 'null', '[]', '{}', ...[...invalid, ...missingFields].map(value => JSON.stringify(value))]) {
      const response = await request(path, method, body)
      assert.equal(response.status, 400, `${method}: ${body}`)
      assert.equal(typeof (await response.json() as { error: string }).error, 'string')
    }
  }
  assert.deepEqual(calls, [])
})

test('reservations support QUERY CORS preflight', async () => {
  const app = createApp()
  const response = await app.request('/v1/reservations', { method: 'OPTIONS', headers: {
    Origin: 'https://example.com', 'Access-Control-Request-Method': 'QUERY',
    'Access-Control-Request-Headers': 'content-type',
  } }, {})
  assert.equal(response.status, 204)
  assert.ok(response.headers.get('access-control-allow-methods')?.split(',').includes('QUERY'))
  assert.equal(response.headers.get('access-control-allow-headers'), 'content-type')
})

test('retired availability routes return 404', async () => {
  const { request, calls } = fixture()
  for (const path of ['/v1/availabilities', '/v1/bookings/availability']) {
    const response = await request(path, 'QUERY', JSON.stringify(range))
    assert.equal(response.status, 404)
  }
  assert.deepEqual(calls, [])
})

// Legacy names cannot satisfy required snake_case fields, even in mixed bodies.
test('booking and reservation validation rejects camelCase replacements', async () => {
  const { request, calls } = fixture()
  for (const [path, method, valid, fields] of [
    ['/v1/bookings', 'POST', input, ['business_id', 'customer_id', 'room_category_id']],
    ['/v1/reservations', 'QUERY', range, ['business_id']],
  ] as const) {
    for (const field of fields) {
      const body: Record<string, unknown> = { ...valid }
      body[field.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = body[field]
      delete body[field]
      const response = await request(path, method, JSON.stringify(body))
      assert.equal(response.status, 400)
      assert.match((await response.json() as { error: string }).error, new RegExp(field))
    }
  }
  assert.deepEqual(calls, [])
})
