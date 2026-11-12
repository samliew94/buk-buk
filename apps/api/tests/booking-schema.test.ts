import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { URL } from 'node:url'
import { createApp } from '../src/index'
import { Guid } from '../src/value-objects/Guid'
import { DateTime } from 'luxon'
import { MyDateTime } from '../src/utils/MyDateTime'
import { QueryReservations } from '../src/reservation/QueryReservations'

const reportedInput = {
  business_id: '01a19f40-3132-76b0-8d17-3a042ee0cad6',
  customer_id: '01a19f8c-6b54-77b1-9be1-cf21636fb304',
  from: '2026-11-03T04:00:00',
  duration: 60,
  room_category_id: '01a19f54-1365-7150-a7f7-1f7d82a546c3',
}

function fixture() {
  // Site-specific configuration migrations (0014+) require ST3 seed data.
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const migrations = new URL('../migrations/', import.meta.url)
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql') && name < '0014').sort()) {
    db.exec(readFileSync(new URL(name, migrations), 'utf8'))
  }
  db.exec(`
    INSERT INTO business (id, name) VALUES ('business-1', 'Hotel');
    INSERT OR IGNORE INTO room_category VALUES ('room-1', 'business-1', 'Room', NULL, 0);
    INSERT INTO room VALUES ('room-1', 'room-1', 'Room', 0);
    INSERT INTO customer (id, name, phone) VALUES ('customer-1', 'Guest', '0123456789');
  `)
  const d1 = {
    prepare(sql: string) {
      const statement = db.prepare(sql)
      return {
        bind(...values: Array<string | number | null>) {
          return {
            async run() {
              const result = statement.run(...values)
              return { success: true, meta: { changes: Number(result.changes) } }
            },
            async first() { return statement.get(...values) ?? null },
            async all() { return { success: true, results: statement.all(...values) } },
          }
        },
      }
    },
  } as unknown as D1Database
  const app = createApp()
  return { db, pay: (orderId: string, body: string) => app.request('/v1/demo-payment-orders/' + orderId, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
  }, { DB: d1 }), webhook: (paymentId: string) => app.request('/webhook/payment/demo', {
    method: 'POST', body: JSON.stringify({ order_id: 'demo-order-1', reference_id: paymentId, status: 'paid' }),
  }, { DB: d1 }), queryReservations: new QueryReservations(d1), reservations: (from: string, to: string) => app.request('/v1/reservations', {
    method: 'QUERY', body: JSON.stringify({ business_id: 'business-1', from, to }),
  }, { DB: d1 }), create: (input = {
      business_id: 'business-1', customer_id: 'customer-1', room_category_id: 'room-1',
      from: '2026-11-03T10:00:00+08:00', duration: 60,
    }) => app.request('/v1/bookings', {
    method: 'POST', body: JSON.stringify(input),
  }, { DB: d1 }) }
}

test('migrations support booking creation with reservations and optional demo payment', async (t) => {
  const { db, create } = fixture()
  t.after(() => db.close())
  const noPayment = await create()
  assert.equal(noPayment.status, 201)
  const first = await noPayment.json() as { booking_id: string; payment_url: null }
  assert.equal(first.payment_url, null)
  assert.equal(db.prepare('SELECT customer_id FROM booking WHERE id = ?').get(first.booking_id)!.customer_id, 'customer-1')
  assert.equal(db.prepare('SELECT status FROM booking WHERE id = ?').get(first.booking_id)!.status, 'confirmed')
  const reservation = db.prepare('SELECT * FROM room_reservation WHERE booking_id = ?').get(first.booking_id)!
  assert.equal(reservation.room_id, 'room-1')
  assert.equal(reservation.from, '2026-11-03T02:00:00.000Z')
  assert.equal(reservation.to, '2026-11-03T03:00:00.000Z')
  assert.equal(db.prepare('SELECT count(*) AS count FROM payment').get()!.count, 0)

  db.exec(`INSERT INTO upfront_payment_policy VALUES ('business-1', 10);
    INSERT INTO business_payment_gateway VALUES ('business-1');`)
  const withPayment = await create({
    business_id: 'business-1', customer_id: 'customer-1', room_category_id: 'room-1',
    from: '2026-11-03T11:00:00+08:00', duration: 60,
  })
  assert.equal(withPayment.status, 201)
  const second = await withPayment.json() as { booking_id: string; payment_url: null }
  assert.equal(db.prepare('SELECT status FROM booking WHERE id = ?').get(second.booking_id)!.status, 'confirmed')
  assert.equal(db.prepare('SELECT count(*) AS count FROM payment').get()!.count, 0)
  assert.equal(db.prepare('SELECT count(*) AS count FROM demo_payment_order').get()!.count, 0)
  assert.equal(second.payment_url, null)
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
})

test('temporary booking bypass accepts conflicts with confirmed and pending reservations', async (t) => {
  const { db, create } = fixture()
  t.after(() => db.close())
  assert.equal((await create()).status, 201)
  db.exec(`
    INSERT OR IGNORE INTO room_category VALUES ('room-2', 'business-1', 'Second room', NULL, 1);
    INSERT INTO room VALUES ('room-2', 'room-2', 'Second room', 1);
    INSERT INTO upfront_payment_policy VALUES ('business-1', 10);
    INSERT INTO business_payment_gateway VALUES ('business-1');
  `)
  let created = 0
  for (const status of ['confirmed', 'pending']) {
    db.prepare('UPDATE booking SET status = ?').run(status)
    const response = await create({
      business_id: 'business-1', customer_id: 'customer-1', room_category_id: 'room-1',
      from: '2026-11-03T10:30:00+08:00', duration: 60,
    })
    assert.equal(response.status, 201)
    created++
    const body = await response.json() as { booking_id: string }
    assert.equal(db.prepare('SELECT room_id FROM room_reservation WHERE booking_id = ?').get(body.booking_id)!.room_id, 'room-1')
    for (const [table, expected] of [
      ['booking', 1 + created], ['room_reservation', 1 + created], ['payment', 0], ['demo_payment_order', 0],
    ] as const) {
      assert.equal(db.prepare(`SELECT count(*) AS count FROM ${table}`).get()!.count, expected)
    }
  }
  db.exec("UPDATE booking SET status = 'cancelled'")
  assert.equal((await create()).status, 201)
})

test('reported booking payload persists a one-hour reservation using Kuala Lumpur time', async (t) => {
  const { db, create } = fixture()
  t.after(() => db.close())
  db.prepare('INSERT INTO business (id, name) VALUES (?, ?)').run(reportedInput.business_id, 'Reported business')
  db.prepare('INSERT INTO customer (id, name, phone) VALUES (?, ?, ?)').run(reportedInput.customer_id, 'Guest', '0123456789')
  db.prepare('INSERT INTO room_category VALUES (?, ?, ?, NULL, 0)').run(reportedInput.room_category_id, reportedInput.business_id, 'Room')
  db.prepare('INSERT INTO room VALUES (?, ?, ?, 0)').run(reportedInput.room_category_id, reportedInput.room_category_id, 'Room')

  const response = await create(reportedInput)
  assert.equal(response.status, 201)
  const body = await response.json() as { booking_id: string; payment_url: null }
  assert.deepEqual(body, { booking_id: body.booking_id, payment_url: null })
  const reservation = db.prepare('SELECT * FROM room_reservation WHERE booking_id = ?').get(body.booking_id)!
  assert.equal(typeof reservation.id, 'string')
  assert.equal(reservation.room_id, reportedInput.room_category_id)
  assert.equal(reservation.from, '2026-11-02T20:00:00.000Z')
  assert.equal(reservation.to, '2026-11-02T21:00:00.000Z')
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
})

test('reservation query reads reservation dates and booking details from the migrated schema', async (t) => {
  const { db, create, reservations } = fixture()
  t.after(() => db.close())
  const created = await create()
  assert.equal(created.status, 201)
  const { booking_id: bookingId } = await created.json() as { booking_id: string }
  const booking = db.prepare('SELECT * FROM booking WHERE id = ?').get(bookingId)!
  assert.equal(booking.expire_at, DateTime.fromISO(booking.created_at as string).plus({ minutes: 10 }).toUTC().toISO())
  // Each reserved room is returned even when booking and interval match.
  db.exec(`INSERT OR IGNORE INTO room_category VALUES ('room-2', 'business-1', 'Second room', NULL, 1);
    INSERT INTO room VALUES ('room-2', 'room-2', 'Second room', 1)`)
  db.prepare(`INSERT INTO room_reservation VALUES ('second-room', ?, 'room-2', ?, ?, 'room-2')`).run(
    bookingId, '2026-11-03T02:00:00.000Z', '2026-11-03T03:00:00.000Z',
  )
  const response = await reservations('2026-11-03T10:00:00+08:00', '2026-11-03T12:00:00+08:00')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), ['room-1', 'room-2'].map(roomId => ({
    room_id: roomId, room_category_id: roomId, id: bookingId, customer_id: 'customer-1', status: booking.status,
    created_at: booking.created_at,
    expire_at: DateTime.fromISO(booking.created_at as string).plus({ minutes: 10 }).toUTC().toISO(), from: '2026-11-03T02:00:00.000Z', to: '2026-11-03T03:00:00.000Z',
  })))
  // Retain the existing strict upper bound and inclusive lower bound.
  for (const [from, to] of [
    ['2026-11-03T10:00:00+08:00', '2026-11-03T11:00:00+08:00'],
    ['2026-11-03T10:01:00+08:00', '2026-11-03T12:00:00+08:00'],
    ['2026-11-04T00:00:00+08:00', '2026-11-05T00:00:00+08:00'],
  ]) {
    const empty = await reservations(from, to)
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), [])
  }
})

test('queryByDate selects reservations overlapping 24 hours from the supplied UTC timestamp', async (t) => {
  const { db, queryReservations } = fixture()
  t.after(() => db.close())
  db.exec("INSERT INTO booking VALUES ('booking-1', 'customer-1', 'pending', '2025-12-31T23:55:00.123+08:00', '2025-12-31T16:12:00.123Z')")
  const intervals = [
    ['2025-12-31T16:00:00.000Z', '2025-12-31T17:00:00.000Z'],
    ['2026-01-01T15:00:00.000Z', '2026-01-01T16:00:00.000Z'],
    ['2025-12-31T15:00:00.000Z', '2025-12-31T17:00:00.000Z'],
    ['2026-01-01T15:00:00.000Z', '2026-01-01T17:00:00.000Z'],
    ['2026-01-01T16:00:00.000Z', '2026-01-01T17:00:00.000Z'],
    ['2025-12-31T15:00:00.000Z', '2025-12-31T16:00:00.000Z'],
  ]
  for (const [i, [from, to]] of intervals.entries()) {
    db.prepare('INSERT INTO room_reservation VALUES (?, ?, ?, ?, ?, ?)').run(
      `reservation-${i}`, 'booking-1', 'room-1', from, to, 'room-1',
    )
  }
  // Malaysian January 1 starts at 16:00 UTC on December 31.
  const date = new MyDateTime(DateTime.fromISO('2025-12-31T16:00:00Z', { setZone: true }))
  const result = await queryReservations.queryByDate(Guid.from('business-1'), date)
  assert.deepEqual(result.results.map(row => [row.from, row.to]).sort(), intervals.slice(0, 4).sort())
  assert.ok(result.results.every(row => row.expire_at === '2025-12-31T16:12:00.123Z'))
  const empty = await queryReservations.queryByDate(Guid.from('business-1'), new MyDateTime(DateTime.utc(2026, 11, 5)))
  assert.deepEqual(empty.results, [])
})

test('booking and payment schema rejects invalid references', (t) => {
  const { db } = fixture()
  t.after(() => db.close())
  db.exec("INSERT INTO booking VALUES ('booking-1', 'customer-1', 'pending', '2026-11-03T00:00:00.000Z', '2026-11-03T00:10:00.000Z')")
  for (const sql of [
    "INSERT INTO booking VALUES ('bad', 'missing', 'pending', 'now', '2026-11-03T00:10:00.000Z')",
    "INSERT INTO payment VALUES ('bad', 'missing', 0, 'pending', 'now')",
    "INSERT INTO demo_payment_order VALUES ('bad', 'missing', 1, 'pending', 'now')",
    "INSERT INTO upfront_payment_policy VALUES ('missing', 1)",
    "INSERT INTO business_payment_gateway VALUES ('missing')",
    `INSERT INTO room_reservation VALUES ('bad', 'booking-1', 'missing', 'a', 'b', 'missing')`,
    `INSERT INTO room_reservation VALUES ('bad', 'missing', 'room-1', 'a', 'b', 'room-1')`,
  ]) assert.throws(() => db.exec(sql), sql)
})

test('demo success retains pending payment, inserts paid payment and confirms only its booking', async (t) => {
  const { db, webhook } = fixture()
  t.after(() => db.close())
  db.exec(`
    INSERT INTO booking VALUES ('booking-1', 'customer-1', 'pending', '2026-11-07T00:00:00Z', '2026-11-07T00:10:00.000Z');
    INSERT INTO booking VALUES ('booking-2', 'customer-1', 'pending', '2026-11-07T00:00:00Z', '2026-11-07T00:10:00.000Z');
    INSERT INTO payment VALUES ('payment-1', 'booking-1', 11.5, 'pending', '2026-11-07T00:00:00Z');
  `)
  assert.equal((await webhook('missing')).status, 404)
  assert.equal(db.prepare('SELECT status FROM booking WHERE id = ?').get('booking-1')!.status, 'pending')
  assert.equal((await webhook('payment-1')).status, 204)
  const payments = db.prepare('SELECT * FROM payment WHERE booking_id = ?').all('booking-1')
  assert.equal(payments.length, 2)
  assert.equal(payments.find(p => p.id === 'payment-1')!.status, 'pending')
  const paid = payments.find(p => p.status === 'paid')!
  assert.ok(paid)
  assert.notEqual(paid.id, 'payment-1')
  assert.equal(paid.price, 11.5)
  assert.ok(Number.isFinite(Date.parse(String(paid.created_at))))
  assert.equal(db.prepare('SELECT status FROM booking WHERE id = ?').get('booking-1')!.status, 'confirmed')
  assert.equal(db.prepare('SELECT status FROM booking WHERE id = ?').get('booking-2')!.status, 'pending')
})

for (const status of ['paid', 'cancelled', 'rejected']) {
  test(`guest demo payment API completes ${status} workflow with pre-existing payment records`, async (t) => {
    const { db, create, pay } = fixture()
    t.after(() => db.close())
    // Existing pending payments remain payable while new bookings bypass payment.
    db.exec(`INSERT INTO booking VALUES ('payment-booking','customer-1','pending','now','2099-01-01T00:00:00.000Z');
      INSERT INTO payment VALUES ('original-payment','payment-booking',1.5,'pending','now');
      INSERT INTO demo_payment_order VALUES ('demo-order','original-payment',1.5,'pending','now');`)
    const bookingId = 'payment-booking'
    const original = db.prepare('SELECT * FROM payment WHERE id = ?').get('original-payment')!
    const orderId = 'demo-order'
    for (const invalid of ['{', 'null', '[]', '{}', '{"status":"pending"}']) {
      assert.equal((await pay(orderId, invalid)).status, 400)
    }
    assert.equal((await pay('missing', JSON.stringify({ status }))).status, 404)
    assert.equal(db.prepare('SELECT status FROM booking WHERE id = ?').get(bookingId)!.status, 'pending')
    assert.equal(db.prepare('SELECT status FROM demo_payment_order WHERE id = ?').get(orderId)!.status, 'pending')
    const paid = await pay(orderId, JSON.stringify({ status, reference_id: 'untrusted' }))
    assert.equal(paid.status, 200)
    assert.deepEqual(await paid.json(), { id: orderId, reference_id: original.id, booking_id: bookingId, price: 1.5, status })
    assert.equal(db.prepare('SELECT status FROM demo_payment_order WHERE id = ?').get(orderId)!.status, status)
    assert.equal(db.prepare('SELECT status FROM booking WHERE id = ?').get(bookingId)!.status, status === 'paid' ? 'confirmed' : 'cancelled')
    assert.equal(db.prepare('SELECT status FROM payment WHERE id = ?').get(original.id)!.status, 'pending')
    const outcome = db.prepare('SELECT * FROM payment WHERE booking_id = ? AND id != ?').get(bookingId, original.id)!
    assert.equal(outcome.status, status)
    assert.equal(outcome.price, 1.5)
  })
}
