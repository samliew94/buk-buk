import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { URL } from 'node:url'
import { DateTime } from 'luxon'
import { EnsureRoomsAvailable } from '../src/room/EnsureRoomsAvailable'
import { BadRequestError, ConflictError } from '../src/errors'
import { Guid } from '../src/value-objects/Guid'
import { MyDateTime } from '../src/utils/MyDateTime'

test('room availability checks overlap, blocking status, room and interval boundaries', async (t) => {
  // Site-specific configuration migrations 0014–0016 require ST3 seed data.
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  const migrations = new URL('../migrations/', import.meta.url)
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql') && (name < '0014' || name.startsWith('0017'))).sort()) {
    db.exec(readFileSync(new URL(name, migrations), 'utf8'))
  }
  db.exec(`
    INSERT INTO business (id, name) VALUES ('business-1', 'Hotel');
    INSERT OR IGNORE INTO room_category VALUES ('room-1', 'business-1', 'Room', NULL, 0);
    INSERT INTO room VALUES ('room-1', 'room-1', 'Room', 0);
    INSERT INTO customer (id, name, phone) VALUES ('customer-1', 'Guest', '0123');
    INSERT INTO booking (business_id, id, customer_id, status, created_at, expire_at) VALUES ('business-1', 'booking-1', 'customer-1', 'confirmed', '2026-11-07T00:00:00.000Z', '2026-11-07T00:10:00.000Z');
    INSERT INTO room_reservation VALUES ('reservation-1', 'booking-1', 'room-1', '2026-11-07T02:00:00.000Z', '2026-11-07T03:00:00.000Z', 'room-1');
  `)
  const d1 = {
    prepare(sql: string) {
      return { bind(...values: string[]) {
        return { async first() { return db.prepare(sql).get(...values) ?? null } }
      } }
    },
  } as unknown as D1Database
  const ensure = new EnsureRoomsAvailable(d1)
  const date = (time: string) => new MyDateTime(DateTime.fromISO('2026-11-07T' + time + '+08:00'))
  const check = (from: string, to: string, room = 'room-1') =>
    ensure.exec(date(from), date(to), [Guid.from(room)])

  await assert.rejects(
    ensure.exec(date('10:00'), date('11:00'), [Guid.from('room-2'), Guid.from('room-1')]),
    (error: unknown) => error instanceof ConflictError && error.message.includes('room_id: room-1'),
  )
  await ensure.exec(date('10:00'), date('11:00'), [])

  for (const [from, to] of [
    ['10:00', '11:00'], ['09:30', '10:30'], ['10:30', '11:30'],
    ['09:00', '12:00'], ['10:15', '10:45'],
  ]) {
    await assert.rejects(check(from, to), ConflictError)
  }
  await check('09:00', '10:00')
  await check('11:00', '12:00')
  await check('10:00', '11:00', 'room-2')
  db.exec("UPDATE booking SET status = 'cancelled'")
  await check('10:00', '11:00')
  db.exec("UPDATE booking SET status = 'pending', expire_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+10 minutes')")
  await assert.rejects(check('10:00', '11:00'), ConflictError)
  db.exec("UPDATE booking SET expire_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
  await check('10:00', '11:00')
  assert.equal(db.prepare('SELECT status FROM booking').get()!.status, 'pending')
  db.exec("UPDATE booking SET status = 'confirmed'")
  await assert.rejects(check('10:00', '11:00'), ConflictError)
  await assert.rejects(check('11:00', '10:00'), BadRequestError)
  await assert.rejects(check('10:00', '10:00'), BadRequestError)
})
