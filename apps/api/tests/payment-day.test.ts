import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './sqlite'
import { createStaffTestApp } from './staff'
const date = '2026-11-12'

test('payments preserve history, order, day boundaries and stored business scope without duplicates', async t => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  db.exec(`
    INSERT INTO business(id,name) VALUES ('a','A'),('b','B');
    INSERT INTO room_category VALUES ('ca','a','Family','FR',0),('cb','b','Foreign',NULL,0);
    INSERT INTO room VALUES ('r1','ca','One',0),('r2','ca','Two',1),('foreign','cb','Foreign',0);
    INSERT INTO customer(id,name,phone) VALUES ('c','Guest','0123');
    INSERT INTO booking (business_id, id, customer_id, status, created_at, expire_at) VALUES ('a', 'booking','c','cancelled','2020-01-01T00:00:00.000Z','2020-01-01T00:10:00.000Z'),('b', 'other','c','confirmed','2020-01-01T00:00:00.000Z','2020-01-01T00:10:00.000Z');
    INSERT INTO room_reservation VALUES ('one','booking','r1','2020-01-01','2020-01-02','cb'),('two','booking','r2','2020-01-01','2020-01-02','ca'),('three','other','foreign','2020-01-01','2020-01-02','ca');
  `)
  const insert = (id: string, created: string, status: string, booking = 'booking') => db.prepare('INSERT INTO payment VALUES (?,?,12.5,?,?)').run(id, booking, status, created)
  insert('before', '2026-11-11T15:59:59.999Z', 'paid')
  insert('start', '2026-11-11T16:00:00.000Z', 'pending')
  insert('a', '2026-11-12T01:00:00.000Z', 'paid')
  insert('z', '2026-11-12T01:00:00.000Z', 'cancelled')
  insert('last', '2026-11-12T15:59:59.999Z', 'rejected')
  insert('end', '2026-11-12T16:00:00.000Z', 'paid')
  insert('after-range', '2026-11-13T16:00:00.000Z', 'paid')
  insert('foreign', '2026-11-12T01:00:00.000Z', 'paid', 'other')
  const query = (business_id: string, day = date) => createStaffTestApp().request('/v1/payments', { method: 'QUERY', body: JSON.stringify({ business_id, date: day }) }, { DB: d1 })
  db.exec("UPDATE room SET room_category_id = 'cb' WHERE id IN ('r1','r2')")
  const response = await query('a')
  assert.equal(response.status, 200)
  const rows = await response.json() as any[]
  assert.deepEqual(rows, [['last','rejected','2026-11-12T15:59:59.999Z'],['z','cancelled','2026-11-12T01:00:00.000Z'],['a','paid','2026-11-12T01:00:00.000Z'],['start','pending','2026-11-11T16:00:00.000Z']].map(([id,status,created_at]) => ({ id, booking_id: 'booking', created_at, price: 12.5, status, customer_name: 'Guest', customer_phone: '0123' })))
  assert.deepEqual((await (await query('b')).json() as any[]).map(row => row.id), ['foreign'])
  const range = (to: string) => createStaffTestApp().request('/v1/payments', {
    method: 'QUERY', body: JSON.stringify({ business_id: 'a', from: date, to })
  }, { DB: d1 })
  const sameDay = await range(date)
  assert.equal(sameDay.status, 200)
  assert.deepEqual(await sameDay.json(), rows)
  const multiDay = await range('2026-11-13')
  assert.equal(multiDay.status, 200)
  assert.deepEqual((await multiDay.json() as any[]).map(row => row.id), ['end', 'last', 'z', 'a', 'start'])
  db.exec("INSERT INTO booking (business_id,id,customer_id,status,created_at,expire_at) VALUES ('a','orphan','c','pending','now','now')")
  insert('no-reservations', '2026-11-12T02:00:00.000Z', 'pending', 'orphan')
  assert.equal((await (await query('a')).json() as any[]).filter(row => row.id === 'no-reservations').length, 1)
  assert.deepEqual(await (await query('missing')).json(), [])
  assert.deepEqual(await (await query('a','2020-01-01')).json(), [])
})

test('payment day endpoint rejects malformed dates, bodies and ranges, and permits QUERY preflight', async () => {
  const app = createStaffTestApp()
  const invalid: unknown[] = [null, [], 1, {}, { date }, { business_id: '', date }, { business_id: 3, date },
    ...['2026-02-30', '2026-11-12T00:00:00+08:00', '20261112', '2026-1-01', '2026-13-01', ' 2026-11-12', null, 123].map(date => ({ business_id: 'a', date })),
    { business_id: 'a', from: date }, { business_id: 'a', to: date },
    { business_id: 'a', from: date, to: '2026-11-11' }, { business_id: 'a', from: date, to: '2027-11-12' }, { business_id: 'a', date, from: date }, { business_id: 'a', date, to: date }]
  for (const body of invalid) {
    const response = await app.request('/v1/payments', { method: 'QUERY', body: JSON.stringify(body) }, {})
    assert.equal(response.status, 400, JSON.stringify(body))
    assert.deepEqual(Object.keys(await response.json() as object), ['error'])
  }
  assert.equal((await app.request('/v1/payments', { method: 'QUERY', body: '{' }, {})).status, 400)
  const preflight = await app.request('/v1/payments', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'QUERY', 'Access-Control-Request-Headers': 'Content-Type' } })
  assert.equal(preflight.status, 204)
  assert.match(preflight.headers.get('Access-Control-Allow-Methods')!, /QUERY/)
  assert.match(preflight.headers.get('Access-Control-Allow-Headers')!, /Content-Type/i)
})
