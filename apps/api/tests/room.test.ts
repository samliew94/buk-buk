import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './sqlite'
import { createApp } from '../src/index'
import { QueryRoom } from '../src/room/QueryRoom'
import { Guid } from '../src/value-objects/Guid'

test('category and physical room management persist exact snake_case contracts and isolate businesses', async (t) => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  db.exec("INSERT INTO business(id,name) VALUES ('a','A'),('b','B')")
  const app = createApp()
  const send = (path: string, method: string, body: unknown) =>
    app.request(
      '/v1/' + path,
      { method, body: JSON.stringify(body) },
      { DB: d1 },
    )
  const input = { business_id: 'a', name: 'Family', acronym: 'FR', sort_order: 0 }
  const created = await send('room-categories', 'POST', input)
  assert.equal(created.status, 201)
  const category = (await created.json()) as typeof input & { id: string }
  assert.deepEqual(category, { id: category.id, ...input })
  assert.deepEqual(
    await (await send('room-categories', 'QUERY', { business_id: 'a' })).json(),
    [{ ...category, room_ids: [] }],
  )
  const roomInput = { room_category_id: category.id, name: 'FR3', sort_order: 2 }
  const roomResponse = await send('rooms', 'POST', roomInput)
  assert.equal(roomResponse.status, 201)
  const room = (await roomResponse.json()) as typeof roomInput & { id: string }
  assert.deepEqual(room, { id: room.id, ...roomInput })
  assert.deepEqual(
    await (await send('rooms', 'QUERY', { business_id: 'a' })).json(),
    [room],
  )
  assert.deepEqual(
    await (await send('rooms', 'QUERY', { business_id: 'b' })).json(),
    [],
  )
  assert.deepEqual(
    await new QueryRoom(d1).query(Guid.from('a'), Guid.from(room.id)),
    room,
  )
  assert.equal(
    await new QueryRoom(d1).query(Guid.from('b'), Guid.from(room.id)),
    null,
  )
  const earlier = (await (
    await send('rooms', 'POST', { ...roomInput, name: 'FR1', sort_order: 0 })
  ).json()) as { id: string }
  assert.deepEqual(
    await (await send('room-categories', 'QUERY', { business_id: 'a' })).json(),
    [{ ...category, room_ids: [earlier.id, room.id] }],
  )
  const updated = { ...roomInput, name: 'FR2', sort_order: 1 }
  assert.equal((await send('rooms/' + room.id, 'PUT', updated)).status, 204)
  const categoryUpdate = { ...input, name: 'Family suite', acronym: 'FS' }
  assert.deepEqual(
    await (
      await send('room-categories/' + category.id, 'PUT', categoryUpdate)
    ).json(),
    { id: category.id, ...categoryUpdate },
  )
  assert.equal(
    (await send('room-categories/missing', 'PUT', input)).status,
    404,
  )
  assert.equal((await send('rooms/missing', 'PUT', roomInput)).status, 404)
  assert.equal(
    (await send('rooms', 'POST', { ...roomInput, room_category_id: 'missing' }))
      .status,
    404,
  )
  assert.equal(
    (await send('room-categories', 'POST', { ...input, business_id: 'missing' }))
      .status,
    404,
  )
  const noAcronym = await send('room-categories', 'POST', {
    business_id: 'a',
    name: 'Studio',
    sort_order: 1,
  })
  assert.equal(((await noAcronym.json()) as { acronym: null }).acronym, null)
  for (const acronym of [undefined, null, '', ' '])
    assert.equal(
      (
        await send('room-categories/' + category.id, 'PUT', {
          ...input,
          acronym,
        })
      ).status,
      400,
    )
  for (const resource of ['room-categories', 'rooms']) {
    for (const body of [
      null,
      [],
      {},
      { ...(resource === 'rooms' ? roomInput : input), name: ' ' },
      { ...(resource === 'rooms' ? roomInput : input), sort_order: 1.5 },
    ]) {
      assert.equal((await send(resource, 'POST', body)).status, 400)
    }
  }
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
})

test('categories and nested room IDs have stable sort order, name and ID ordering with empty categories', async (t) => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  db.exec(`INSERT INTO business(id,name) VALUES ('a','A'),('b','B');
 INSERT INTO room_category VALUES ('z','a','Family',NULL,0),('a','a','Family',NULL,0),('first','a','Zebra',NULL,-1),('foreign','b','Foreign',NULL,0);
 INSERT INTO room VALUES ('z','a','Same',0),('a','a','Same',0),('first','a','Zebra',-1),('name-first','a','Alpha',0);`)
  const response = await createApp().request(
    '/v1/room-categories',
    { method: 'QUERY', body: JSON.stringify({ business_id: 'a' }) },
    { DB: d1 },
  )
  const records = (await response.json()) as { id: string; room_ids: string[] }[]
  assert.deepEqual(
    records.map((c) => c.id),
    ['first', 'a', 'z'],
  )
  assert.deepEqual(
    records.map((c) => c.room_ids),
    [[], ['first', 'name-first', 'a', 'z'], []],
  )
  for (const path of ['/v1/room-categories', '/v1/room-category-rental-fees']) {
    const preflight = await createApp().request(
      path,
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'QUERY',
          'Access-Control-Request-Headers': 'content-type',
        },
      },
      { DB: d1 },
    )
    assert.equal(preflight.status, 204)
    assert.ok(
      preflight.headers
        .get('access-control-allow-methods')
        ?.split(',')
        .includes('QUERY'),
    )
  }
})
