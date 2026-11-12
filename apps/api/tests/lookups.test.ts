import { test } from 'node:test'
import assert from 'node:assert/strict'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { createApp } from '../src/index'

test('booking and demo order GET lookups return snake_case records and null for missing IDs', async (t) => {
  // Site-specific configuration migrations (0014+) require ST3 seed data.
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  const migrations = new URL('../migrations/', import.meta.url)
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql') && name < '0014').sort()) {
    db.exec(readFileSync(new URL(name, migrations), 'utf8'))
  }
  db.exec(`
    INSERT INTO customer (id, name, phone) VALUES ('customer-1', 'Guest', '0123');
    INSERT INTO booking VALUES ('booking-1', 'customer-1', 'pending', '2026-11-07T00:00:00.000Z', '2026-11-07T00:10:00.000Z');
    INSERT INTO payment VALUES ('payment-1', 'booking-1', 1.5, 'pending', '2026-11-07T00:00:00.000Z');
    INSERT INTO demo_payment_order VALUES ('order-1', 'payment-1', 1.5, 'pending', '2026-11-07T00:00:00.000Z');
  `)
  const d1 = {
    prepare(sql: string) {
      return { bind(...values: string[]) {
        return {
          async first() { return db.prepare(sql).get(...values) ?? null },
          async all() { return { results: db.prepare(sql).all(...values) } },
        }
      } }
    },
  } as unknown as D1Database
  const app = createApp()
  const env = { DB: d1 }
  const expected = [
    ['/v1/bookings/booking-1', { id: 'booking-1', customer_id: 'customer-1', status: 'pending', created_at: '2026-11-07T00:00:00.000Z', expire_at: '2026-11-07T00:10:00.000Z', reservations: [] }],
    ['/v1/demo-payment-orders/order-1', { id: 'order-1', reference_id: 'payment-1', price: 1.5, status: 'pending', created_at: '2026-11-07T00:00:00.000Z' }],
    ['/v1/bookings/missing', null],
    ['/v1/demo-payment-orders/missing', null],
  ] as const
  for (const [path, record] of expected) {
    const response = await app.request(path, {}, env)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), record)
  }
  db.exec(`
    INSERT INTO business (id, name) VALUES ('business-1', 'Venue');
    INSERT OR IGNORE INTO room_category VALUES ('room-1', 'business-1', 'Family Room', 'FR', 1);
    INSERT INTO room VALUES ('room-1', 'room-1', 'Family Room', 1);
    INSERT OR IGNORE INTO room_category VALUES ('room-2', 'business-1', 'Studio', 'ST', 0);
    INSERT INTO room VALUES ('room-2', 'room-2', 'Studio', 0);
    INSERT INTO room_reservation VALUES ('reservation-1', 'booking-1', 'room-1', '2026-11-07T02:00:00.000Z', '2026-11-07T03:30:30.000Z', 'room-1');
    INSERT INTO room_reservation VALUES ('reservation-2', 'booking-1', 'room-2', '2026-11-07T02:00:00.000Z', '2026-11-07T03:00:00.000Z', 'room-2');
    INSERT INTO booking VALUES ('booking-2', 'customer-1', 'confirmed', '2026-11-07T00:00:00.000Z', '2026-11-07T00:10:00.000Z');
    INSERT INTO room_reservation VALUES ('other-reservation', 'booking-2', 'room-1', '2026-11-08T02:00:00.000Z', '2026-11-08T03:00:00.000Z', 'room-1');
  `)
  const booking = await (await app.request('/v1/bookings/booking-1', {}, env)).json() as { reservations: unknown[] }
  assert.deepEqual(booking.reservations, [
    { id: 'reservation-2', room_id: 'room-2', room_name: 'Studio', room_category_id: 'room-2', room_category_name: 'Studio', room_category_acronym: 'ST', from: '2026-11-07T02:00:00.000Z', to: '2026-11-07T03:00:00.000Z', duration: 60 },
    { id: 'reservation-1', room_id: 'room-1', room_name: 'Family Room', room_category_id: 'room-1', room_category_name: 'Family Room', room_category_acronym: 'FR', from: '2026-11-07T02:00:00.000Z', to: '2026-11-07T03:30:30.000Z', duration: 90.5 },
  ])
  db.exec("UPDATE booking SET status = 'confirmed'; UPDATE demo_payment_order SET status = 'paid'")
  assert.equal((await (await app.request('/v1/bookings/booking-1', {}, env)).json() as { status: string }).status, 'confirmed')
  assert.equal((await (await app.request('/v1/demo-payment-orders/order-1', {}, env)).json() as { status: string }).status, 'paid')
})
