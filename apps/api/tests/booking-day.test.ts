import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './sqlite'
import { createStaffTestApp } from './staff'
import { MyDateTime } from '../src/utils/MyDateTime'
import { DateTime } from 'luxon'

const date = '2026-11-12'
test('booking roster groups categories before ordering physical rooms', async t => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  db.exec(`
    INSERT INTO business(id,name) VALUES ('a','A');
    INSERT INTO room_category VALUES ('open','a','Open','OPEN',2),('vip','a','VIP','VIP',3),('racing','a','Racing','RACING',4);
    INSERT INTO room VALUES ('r4','racing','R4',4),('vip','vip','VIP',1),('r2','racing','R2',2),('os4','open','OS4',1),('r1','racing','R1',1),('r3','racing','R3',3);
  `)
  const response = await createStaffTestApp().request('/v1/bookings', {
    method: 'QUERY', body: JSON.stringify({ business_id: 'a', date })
  }, { DB: d1 })
  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.deepEqual(body.rooms.map((room: any) => room.name), ['OS4', 'VIP', 'R1', 'R2', 'R3', 'R4'])
})

test('booking day query uses stored business scope, strict overlap, full intervals and stable roster', async t => {
  t.mock.method(MyDateTime, 'now', () => new MyDateTime(DateTime.fromISO('2026-11-12T00:00:00.000Z')))
  const { db, d1 } = fixture()
  t.after(() => db.close())
  db.exec(`
    INSERT INTO business(id,name) VALUES ('a','A'),('b','B');
    INSERT INTO room_category VALUES ('ca','a','Family','FR',0),('cb','b','Foreign',NULL,0);
    INSERT INTO room VALUES ('z','ca','Same',1),('a','ca','Same',1),('empty','ca','Empty',0),('foreign','cb','Foreign',0);
    INSERT INTO customer(id,name,phone) VALUES ('c','Guest','0123');
  `)
  const insert = (id: string, status: string, room: string, from: string, to: string, category = 'ca', bookingId = id) => {
    db.prepare("INSERT OR IGNORE INTO booking (business_id, id, customer_id, status, created_at, expire_at) VALUES ('a', ?, 'c', ?, '2026-11-01T00:00:00.000Z', '2026-11-01T00:10:00.000Z')").run(bookingId, status)
    db.prepare('INSERT INTO room_reservation VALUES (?,?,?,?,?,?)').run(id, bookingId, room, from, to, category)
  }
  insert('previous', 'confirmed', 'a', '2026-11-11T15:00:00.000Z', '2026-11-11T16:15:00.000Z')
  insert('pending', 'pending', 'z', '2026-11-12T15:45:00.000Z', '2026-11-12T18:30:00.000Z')
  insert('second', 'pending', 'a', '2026-11-12T01:00:00.000Z', '2026-11-12T01:15:00.000Z', 'ca', 'pending')
  insert('cancelled', 'cancelled', 'a', '2026-11-12T02:00:00.000Z', '2026-11-12T03:00:00.000Z')
  insert('end-at-start', 'confirmed', 'a', '2026-11-11T15:00:00.000Z', '2026-11-11T16:00:00.000Z')
  insert('start-at-end', 'confirmed', 'a', '2026-11-12T16:00:00.000Z', '2026-11-12T17:00:00.000Z')
  // Stored requested category must not establish ownership in either direction.
  insert('foreign', 'confirmed', 'foreign', '2026-11-12T01:00:00.000Z', '2026-11-12T02:00:00.000Z', 'ca', 'foreign')
  db.exec("UPDATE booking SET business_id = 'b' WHERE id = 'foreign'")
  insert('moved', 'confirmed', 'z', '2026-11-12T03:00:00.000Z', '2026-11-12T04:00:00.000Z', 'cb')
  db.prepare("UPDATE booking SET expire_at = '2026-11-12T00:00:00.001Z' WHERE id = 'pending'").run()
  const app = createStaffTestApp()
  const query = (business_id: string, day = date) => app.request('/v1/bookings', { method: 'QUERY', body: JSON.stringify({ business_id, date: day }) }, { DB: d1 })
  const response = await query('a')
  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.deepEqual(Object.keys(body), ['rooms', 'bookings'])
  assert.deepEqual(body.rooms.map((r: any) => r.id), ['empty', 'a', 'z'])
  assert.deepEqual(body.rooms[0], { id: 'empty', room_category_id: 'ca', name: 'Empty', sort_order: 0, room_category_name: 'Family', room_category_acronym: 'FR' })
  assert.deepEqual(body.bookings.map((b: any) => b.id), ['previous', 'pending', 'cancelled', 'moved'])
  assert.deepEqual(body.bookings[0], { id: 'previous', customer_id: 'c', customer_name: 'Guest', customer_phone: '0123', status: 'confirmed', created_at: '2026-11-01T00:00:00.000Z', expire_at: '2026-11-01T00:10:00.000Z', reservations: [{ id: 'previous', room_id: 'a', room_name: 'Same', room_category_id: 'ca', room_category_name: 'Family', room_category_acronym: 'FR', from: '2026-11-11T15:00:00.000Z', to: '2026-11-11T16:15:00.000Z', duration: 75 }] })
  assert.deepEqual(body.bookings[1].reservations.map((r: any) => [r.id, r.duration]), [['second', 15], ['pending', 165]])
  assert.equal(body.bookings[3].reservations[0].room_category_name, 'Foreign')
  assert.deepEqual(await (await query('missing')).json(), { rooms: [], bookings: [] })
  const empty = await (await query('a', '2020-01-01')).json() as any
  assert.equal(empty.rooms.length, 3)
  assert.deepEqual(empty.bookings, [])
  const other = await (await query('b')).json() as any
  assert.deepEqual(other.rooms.map((r: any) => r.id), ['foreign'])
  assert.deepEqual(other.bookings[0].reservations.map((r: any) => r.id), ['foreign'])
  db.exec("UPDATE room SET room_category_id = 'cb' WHERE id = 'z'")
  const reassigned = await (await query('a')).json() as any
  assert.deepEqual(reassigned.bookings, body.bookings)
  assert.deepEqual(reassigned.rooms.map((r: any) => r.id), ['empty', 'a'])
  db.exec("UPDATE room SET room_category_id = 'ca' WHERE id = 'z'")
  // Compare against current time, regardless of the requested reservation day.
  assert.equal(body.bookings[1].status, 'pending')
  for (const expiry of ['2026-11-12T00:00:00.000Z', '2026-11-11T23:59:59.999Z']) {
    db.prepare("UPDATE booking SET expire_at = ? WHERE id = 'pending'").run(expiry)
    const filtered = await (await query('a')).json() as any
    assert.deepEqual(filtered.bookings.map((b: any) => b.id), ['previous', 'cancelled', 'moved'])
    assert.equal(filtered.rooms.length, 3)
  }
  assert.equal(db.prepare("SELECT status FROM booking WHERE id = 'pending'").get()!.status, 'pending')

})

test('booking day endpoint rejects malformed dates/bodies and range filters, and permits QUERY preflight', async () => {
  const app = createStaffTestApp()
  const invalid: unknown[] = [null, [], 1, {}, { date }, { business_id: '', date }, { business_id: 3, date },
    ...['2026-02-30', '2026-11-12T00:00:00+08:00', '20261112', '2026-1-01', '2026-13-01', ' 2026-11-12', null, 123].map(date => ({ business_id: 'a', date })),
    { business_id: 'a', from: date, to: date }, { business_id: 'a', date, from: date }, { business_id: 'a', date, to: date }]
  for (const body of invalid) {
    const response = await app.request('/v1/bookings', { method: 'QUERY', body: JSON.stringify(body) }, {})
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(Object.keys(await response.json() as object), ['error'])
  }
  assert.equal((await app.request('/v1/bookings', { method: 'QUERY', body: '{' }, {})).status, 400)
  const preflight = await app.request('/v1/bookings', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'QUERY', 'Access-Control-Request-Headers': 'Content-Type' } })
  assert.equal(preflight.status, 204)
  assert.match(preflight.headers.get('Access-Control-Allow-Methods')!, /QUERY/)
  assert.match(preflight.headers.get('Access-Control-Allow-Headers')!, /Content-Type/i)
})
