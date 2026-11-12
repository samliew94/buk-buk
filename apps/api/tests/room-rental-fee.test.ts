import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { fixture as sqlite } from './sqlite'
import { createApp } from '../src/index'

function fixture() {
  const {db, d1} = sqlite()
  db.exec("INSERT INTO business(id,name) VALUES ('a','A'),('b','B'); INSERT INTO room_category VALUES ('room-a','a','A',NULL,0),('room-b','b','B',NULL,0)")
  const app = createApp()
  return {
    db,
    request: (path: string, init?: RequestInit) => app.request(path, init, { DB: d1 }),
  }
}

const root = '/v1/room-category-rental-fees'
const input = { room_category_id: 'room-a', duration: 1, price: 12.5 }

test('rental fees persist, filter by room, and update by ID', async (t) => {
  const { db, request } = fixture()
  t.after(() => db.close())
  const send = (path: string, method: string, body: unknown) => request(path, { method, body: JSON.stringify(body) })
  const read = async (roomCategoryId: string) => {
    const response = await send(root, 'QUERY', { room_category_id: roomCategoryId })
    assert.equal(response.status, 200)
    return response.json()
  }
  assert.deepEqual(await read('room-a'), null)
  const created = await send(root, 'POST', input)
  assert.equal(created.status, 201)
  const fee = await created.json() as { id: string }
  assert.match(fee.id, /^[0-9a-f-]{36}$/)
  assert.deepEqual(fee, { id: fee.id, ...input })
  await send(root, 'POST', { ...input, room_category_id: 'room-b' })
  assert.deepEqual(await read('room-a'), fee)
  const updated = await send(`${root}/${fee.id}`, 'PUT', { ...input, duration: 2, price: 0 })
  assert.equal(updated.status, 200)
  assert.deepEqual(await updated.json(), { ...fee, duration: 2, price: 0 })
  assert.deepEqual(await read('room-a'), { ...fee, duration: 2, price: 0 })
  const moved = await send(`${root}/${fee.id}`, 'PUT', { ...input, room_category_id: 'room-b' })
  assert.equal(moved.status, 200)
  assert.deepEqual(await moved.json(), { ...fee, room_category_id: 'room-b' })
  assert.deepEqual(await read('room-a'), null)
  assert.deepEqual(await read('room-b'), { ...fee, room_category_id: 'room-b' })
})

test('rental fees reject invalid JSON and require every write field without changing data', async (t) => {
  const { db, request } = fixture()
  t.after(() => db.close())
  await request(root, { method: 'POST', body: JSON.stringify(input) })
  const id = (db.prepare('SELECT id FROM room_category_rental_fee').get()!).id
  const invalid = [undefined, '{', 'null', '[]', '{}', ...[
    { duration: 1, price: 1 }, { room_category_id: 'room-a', price: 1 }, { room_category_id: 'room-a', duration: 1 },
    ...[null, 1, '', '  '].map(roomCategoryId => ({ ...input, room_category_id: roomCategoryId })),
    ...[null, '', 'hourly', -1, 1.5, true, Number.MAX_SAFE_INTEGER + 1].map(duration => ({ ...input, duration })),
    ...[null, '1', -1, true, {}].map(price => ({ ...input, price })),
  ].map(value => JSON.stringify(value)), '{"room_category_id":"room-a","duration":1,"price":1e999}']
  for (const method of ['POST', 'PUT']) {
    for (const body of invalid) {
      const response = await request(root + (method === 'PUT' ? `/${id}` : ''), { method, body })
      assert.equal(response.status, 400, `${method}: ${body}`)
      assert.equal(typeof (await response.json() as { error: string }).error, 'string')
    }
  }
  assert.equal(db.prepare('SELECT count(*) AS count FROM room_category_rental_fee').get()!.count, 1)
  assert.equal(db.prepare('SELECT price FROM room_category_rental_fee').get()!.price, input.price)
  for (const body of [undefined, '{', 'null', '[]', '{}', '{"room_category_id":null}', '{"room_category_id":" "}']) {
    assert.equal((await request(root + '?room_category_id=room-a', { method: 'QUERY', body })).status, 400)
  }
  const response = await request(root + '?room_category_id=room-b', { method: 'QUERY', body: JSON.stringify({ room_category_id: 'room-a' }) })
  assert.deepEqual(await response.json(), { id, ...input })
})

test('unknown rooms return null, missing fees return 404, and QUERY supports CORS', async (t) => {
  const { db, request } = fixture()
  t.after(() => db.close())
  const missingRoom = await request(root, {
    method: 'QUERY', body: JSON.stringify({ room_category_id: 'missing' }),
  })
  assert.equal(missingRoom.status, 200)
  assert.deepEqual(await missingRoom.json(), null)
  assert.equal((await request(root + '/missing', { method: 'PUT', body: JSON.stringify(input) })).status, 404)
  assert.equal((await request(root)).status, 404)
  const response = await request(root, { method: 'OPTIONS', headers: {
    Origin: 'https://example.com', 'Access-Control-Request-Method': 'QUERY',
    'Access-Control-Request-Headers': 'content-type',
  } })
  assert.equal(response.status, 204)
  assert.ok(response.headers.get('access-control-allow-methods')?.split(',').includes('QUERY'))
  assert.equal(response.headers.get('access-control-allow-headers'), 'content-type')
})

test('rental fee schema enforces room references and required fields', (t) => {
  const { db } = fixture()
  t.after(() => db.close())
  db.exec("INSERT INTO room_category_rental_fee (id, room_category_id, duration, price) VALUES ('fee', 'room-a', 0, 0)")
  assert.equal(db.prepare('SELECT duration FROM room_category_rental_fee').get()!.duration, 0)
  for (const sql of [
    "INSERT INTO room_category_rental_fee VALUES ('bad', 'missing', 1, 1)",
    "INSERT INTO room_category_rental_fee VALUES ('bad', 'room-a', NULL, 1)",
    "INSERT INTO room_category_rental_fee VALUES ('bad', 'room-a', 1, NULL)",
  ]) assert.throws(() => db.exec(sql))
})
