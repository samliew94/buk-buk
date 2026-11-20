import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './sqlite'
import { createStaffTestApp } from './staff'

function setup() {
  const { db, d1 } = fixture()
  db.exec(`
    INSERT INTO business(id,name) VALUES ('a','A'),('b','B');
    INSERT INTO customer(id,name,phone) VALUES ('c','Guest','0123');
    INSERT INTO room_category VALUES ('ca','a','Family','FR',0),('cb','b','Foreign',NULL,0);
    INSERT INTO room VALUES ('r1','ca','One',0),('r2','ca','Two',1),('foreign','cb','Foreign',0);
    INSERT INTO booking(id,business_id,customer_id,status,created_at,expire_at)
    VALUES ('booking','a','c','confirmed','2026-11-01T00:00:00.000Z','2026-11-01T00:10:00.000Z');
    INSERT INTO room_reservation VALUES ('old','booking','r1','2026-11-14T00:00:00.000Z','2026-11-14T01:00:00.000Z','ca');
    INSERT INTO payment(id,booking_id,price,status,created_at) VALUES ('payment','booking',10,'pending','2026-11-01T00:00:00.000Z');
  `)
  const app = createStaffTestApp()
  const put = (body: unknown, id = 'booking') => app.request('/v1/bookings/' + id, { method: 'PUT', body: JSON.stringify(body) }, { DB: d1 })
  const get = () => app.request('/v1/bookings/booking', {}, { DB: d1 })
  return { db, d1, app, put, get }
}
const row = (room_id = 'r2', from = '2026-11-14T10:00:00+08:00', duration = 90) => ({ room_id, from, duration })

test('replacement preserves booking and payments across all statuses and expiry; GET and day reflect edits', async t => {
  const { db, d1, app, put, get } = setup()
  t.after(() => db.close())
  for (const status of ['pending', 'confirmed', 'cancelled']) {
    db.prepare('UPDATE booking SET status = ?').run(status)
    const original = db.prepare('SELECT * FROM booking').all()
    const payments = db.prepare('SELECT * FROM payment').all()
    const before = await (await get()).json() as any
    const response = await put({ reservations: [row(), row('r1','2026-11-14T11:00:00',60)] })
    assert.equal(response.status, 200)
    const body = await response.json() as any
    assert.deepEqual(body, await (await get()).json() as any)
    assert.deepEqual(Object.keys(body), ['id','customer_id','status','created_at','expire_at','reservations'])
    assert.deepEqual(db.prepare('SELECT * FROM booking').all(), original)
    assert.deepEqual(db.prepare('SELECT * FROM payment').all(), payments)
    assert.deepEqual(body.reservations.map((r: any) => ({ ...r, id: undefined })), [
      { id: undefined, room_id: 'r2', room_name: 'Two', room_category_id: 'ca', room_category_name: 'Family', room_category_acronym: 'FR', from: '2026-11-14T02:00:00.000Z', to: '2026-11-14T03:30:00.000Z', duration: 90 },
      { id: undefined, room_id: 'r1', room_name: 'One', room_category_id: 'ca', room_category_name: 'Family', room_category_acronym: 'FR', from: '2026-11-14T03:00:00.000Z', to: '2026-11-14T04:00:00.000Z', duration: 60 },
    ])
    assert.ok(body.reservations.every((r: any) => !before.reservations.some((old: any) => old.id === r.id)))
    const day = await (await app.request('/v1/bookings', { method: 'QUERY', body: JSON.stringify({ business_id: 'a', date: '2026-11-14' }) }, { DB: d1 })).json() as any
    assert.equal(day.bookings.length, status === 'pending' ? 0 : 1)
    if (day.bookings.length) assert.deepEqual(day.bookings[0].reservations, body.reservations)
    assert.equal((await put({ reservations: [row()] })).status, 200)
    assert.equal((await (await get()).json() as any).reservations.length, 1)
  }
})

test('invalid replacements leave existing rows intact; stored ownership governs rooms', async t => {
  const { db, app, d1, put, get } = setup()
  t.after(() => db.close())
  const original = await (await get()).json()
  const invalid = [null, [], {}, { reservations: [] }, { reservations: [null] }, { reservations: [row()], status: 'pending' },
    ...[{}, { ...row(), extra: 1 }, row(''), row(' '), row(3 as any), row('r1','bad'), row('r1','2026-02-30T10:00'), row('r1','2026-11-14'), ...[0,-1,null,'60',1e300,1e-300].map(d => row('r1',undefined,d as any))].map(r => ({ reservations: [r] })),
    { reservations: [row(),row('r2','2026-11-14T11:00:00+08:00')] }]
  for (const body of invalid) {
    assert.equal((await put(body)).status, 400, JSON.stringify(body))
    assert.deepEqual(await (await get()).json(), original)
  }
  assert.equal((await app.request('/v1/bookings/booking', { method: 'PUT', body: '{' }, { DB: d1 })).status,400)
  for (const id of ['missing','foreign']) {
    assert.equal((await put({ reservations: [row(),row(id)] })).status,404)
    assert.deepEqual(await (await get()).json(), original)
  }
  assert.equal((await put({ reservations: [row()] }, 'missing')).status,404)
  db.exec("UPDATE room SET room_category_id = 'cb' WHERE id = 'r1'")
  assert.equal((await put({ reservations: [row('r1')] })).status,404)
  assert.equal((await put({ reservations: [row()] })).status,200)
})

test('other bookings may conflict; adjacent same-room entries allowed; failed batch rolls back', async t => {
  const { db, put, get } = setup()
  t.after(() => db.close())
  db.exec(`INSERT INTO booking(id,business_id,customer_id,status,created_at,expire_at) VALUES ('other','a','c','confirmed','2026-11-01T00:00:00.000Z','2026-11-01T00:10:00.000Z');
    INSERT INTO room_reservation VALUES ('conflict','other','r2','2026-11-14T02:00:00.000Z','2026-11-14T05:00:00.000Z','ca');`)
  assert.equal((await put({ reservations: [row('r2',undefined,60),row('r2','2026-11-14T11:00:00+08:00',60)] })).status,200)
  const original = await (await get()).json()
  db.exec(`CREATE TRIGGER fail_replacement BEFORE INSERT ON room_reservation WHEN NEW.room_id = 'r1' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`)
  const response = await put({ reservations: [row(),row('r1')] })
  assert.equal(response.status,500)
  assert.deepEqual(await response.json(), { error: 'Internal server error' })
  assert.deepEqual(await (await get()).json(), original)
})
