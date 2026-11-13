import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './sqlite'
import { createApp } from '../src/index'

test('temporary assignment bypass preserves deterministic ordering, business scope and requested category history', async (t) => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  db.exec(`INSERT INTO business(id,name) VALUES ('a','A'),('b','B');
 INSERT INTO room_category VALUES ('family','a','Family','FR',0),('empty','a','Empty',NULL,1),('foreign','b','Other',NULL,0);
 INSERT INTO room VALUES ('r3','family','FR3',0),('r2','family','FR2',0),('r1','family','FR1',0);
 INSERT INTO customer(id,name,phone) VALUES ('c','Guest','0123');`)
  const app = createApp()
  const create = (
    category = 'family',
    from = '2026-11-11T07:00:00.000Z',
    duration = 60,
  ) =>
    app.request(
      '/v1/bookings',
      {
        method: 'POST',
        body: JSON.stringify({
          business_id: 'a',
          customer_id: 'c',
          room_category_id: category,
          from,
          duration,
        }),
      },
      { DB: d1 },
    )
  const count = () =>
    ['booking', 'room_reservation', 'payment', 'demo_payment_order'].map(
      (table) => db.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n,
    )
  for (const category of ['missing', 'foreign', 'empty']) {
    const before = count()
    assert.equal(
      (await create(category)).status,
      category === 'empty' ? 409 : 404,
    )
    assert.deepEqual(count(), before)
  }
  const first = await create()
  assert.equal(first.status, 201)
  const second = await create()
  assert.equal(second.status, 201)
  const third = await create()
  assert.equal(third.status, 201)
  assert.deepEqual(
    db
      .prepare(
        'SELECT room_id, room_category_id FROM room_reservation ORDER BY rowid',
      )
      .all()
      .map((r) => [r.room_id, r.room_category_id]),
    [
      ['r1', 'family'],
      ['r1', 'family'],
      ['r1', 'family'],
    ],
  )
  assert.equal((await create()).status, 201)
  // The temporary bypass ignores reservation status and expiry.
  db.exec(
    "UPDATE booking SET status='pending', expire_at='9999-01-01T00:00:00.000Z'",
  )
  assert.equal((await create()).status, 201)
  db.exec("UPDATE booking SET expire_at='2000-01-01T00:00:00.000Z'")
  assert.equal((await create()).status, 201)
  db.exec("UPDATE booking SET status='cancelled'")
  assert.equal((await create()).status, 201)
  // Boundary meeting is permitted.
  assert.equal(
    (await create('family', '2026-11-11T08:00:00.000Z', 15)).status,
    201,
  )
  db.exec('DELETE FROM room_reservation; DELETE FROM booking;')
  // The bypass also accepts an interval without a continuously free room.
  for (const [i, room, from, to] of [
    [1, 'r1', '07:00', '07:30'],
    [2, 'r2', '07:30', '08:00'],
    [3, 'r3', '07:30', '08:00'],
  ] as const) {
    db.prepare(
      "INSERT INTO booking (business_id, id, customer_id, status, created_at, expire_at) VALUES ('a', ?, 'c', 'confirmed', 'now', 'now')",
    ).run('b' + i)
    db.prepare('INSERT INTO room_reservation VALUES (?, ?, ?, ?, ?, ?)').run(
      'res' + i,
      'b' + i,
      room,
      `2026-11-11T${from}:00.000Z`,
      `2026-11-11T${to}:00.000Z`,
      'family',
    )
  }
  assert.equal((await create()).status, 201)
  assert.equal(
    (await create('family', '2026-11-11T07:00:00.000Z', 30)).status,
    201,
  )
  // A staff room move must preserve the category originally requested.
  db.exec("UPDATE room SET room_category_id='empty' WHERE id='r2'")
  const queried = await app.request(
    '/v1/reservations',
    {
      method: 'QUERY',
      body: JSON.stringify({
        business_id: 'a',
        date: '2026-11-11T00:00:00.000Z',
      }),
    },
    { DB: d1 },
  )
  assert.ok(
    ((await queried.json()) as { room_category_id: string }[]).every(
      (r) => r.room_category_id === 'family',
    ),
  )
  const foreign = await app.request(
    '/v1/reservations',
    {
      method: 'QUERY',
      body: JSON.stringify({
        business_id: 'b',
        date: '2026-11-11T00:00:00.000Z',
      }),
    },
    { DB: d1 },
  )
  assert.deepEqual(await foreign.json(), [])
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
})
