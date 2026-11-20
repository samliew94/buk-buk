import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import { createApp } from '../src/index'
import type { Env } from '../src/types/env'
import type { User } from '../src/users/user'
import { Guid } from '../src/value-objects/Guid'
import { fixture } from './sqlite'

function setup(t: { after(fn: () => void): void }) {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  const env: Env = {
    DB: d1,
    JWT_SECRET: 'access-secret-for-SQLite-users-tests',
    JWT_REFRESH_SECRET: 'refresh-secret-for-SQLite-users-tests',
  }
  const app = createApp()
  function request(method: string, path: string, body?: unknown, token?: string) {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    if (token) headers.set('Authorization', 'Bearer ' + token)
    return app.request('/v1' + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }, env)
  }
  async function login(username: string, password: string) {
    const response = await request('POST', '/auth/login', { username, password })
    assert.equal(response.status, 200)
    const result = await response.json() as { access_token: string; refresh_token: string }
    return result
  }
  async function createManager(actorToken: string, username: string, password: string) {
    const response = await request('POST', '/users', { username, password }, actorToken)
    assert.equal(response.status, 201)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const result = await response.json() as User
    assert.deepEqual(result, { id: result.id, username: username.trim().toLowerCase(), role: 'manager', is_banned: false })
    return result
  }
  return { db, request, login, createManager }
}

test('migration seeds valid credentials and preserves existing sam; account keys stay immutable', async (t) => {
  const { db, login, request } = setup(t)
  const seeded = db.prepare('SELECT * FROM "user" WHERE username = ?').get('sam')!
  assert.equal(seeded.role, 'developer')
  assert.equal(seeded.is_banned, 0)
  assert.match(String(seeded.password_hash), /^scrypt\$v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
  const { access_token } = await login('  SaM  ', 'changeit')
  assert.deepEqual(await (await request('GET', '/auth/me', undefined, access_token)).json(), {
    id: seeded.id, role: 'developer',
  })

  const existingId = Guid.new().value
  db.prepare('DELETE FROM "user" WHERE username = ?').run('sam')
  db.prepare('INSERT INTO "user" VALUES (?, ?, ?, ?, ?)').run(existingId, 'sam', 'existing hash', 'manager', 1)
  db.exec(readFileSync(new URL('../migrations/0020_create_user.sql', import.meta.url), 'utf8'))
  assert.deepEqual({ ...db.prepare('SELECT * FROM "user" WHERE username = ?').get('sam')! }, {
    id: existingId, username: 'sam', password_hash: 'existing hash', role: 'manager', is_banned: 1,
  })
  assert.throws(() => db.prepare('UPDATE "user" SET id = ? WHERE id = ?').run(Guid.new().value, existingId), /immutable/)
  assert.throws(() => db.prepare('UPDATE "user" SET role = ? WHERE id = ?').run('owner', existingId), /CHECK/)
  assert.throws(() => db.prepare('UPDATE "user" SET is_banned = ? WHERE id = ?').run(2, existingId), /CHECK/)
})

test('users API requires access; returns exact projections and applies normalized partial updates', async (t) => {
  const { db, request, login, createManager } = setup(t)
  const missing = '/users/' + Guid.new().value
  for (const [method, path, body] of [
    ['QUERY', '/users', {}],
    ['GET', missing, undefined],
    ['POST', '/users', { username: 'staff', password: 'password' }],
    ['PUT', missing, { username: 'staff' }],
  ] as const) {
    const response = await request(method, path, body)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  }

  const { access_token: token } = await login('sam', 'changeit')
  const alice = await createManager(token, '  ALICE  ', '  alice password  ')
  const bob = await createManager(token, 'Bob', 'bob password')
  const samId = db.prepare('SELECT id FROM "user" WHERE username = ?').get('sam')!.id
  assert.deepEqual(await (await request('QUERY', '/users', {}, token)).json(), [
    alice, bob, { id: samId, username: 'sam', role: 'developer', is_banned: false },
  ])

  const detail = '/users/' + alice.id
  assert.deepEqual(await (await request('GET', detail, undefined, token)).json(), alice)
  assert.equal(await (await request('GET', missing, undefined, token)).json(), null)
  assert.equal((await request('PUT', missing, { is_banned: true }, token)).status, 404)

  const storedHash = () => db.prepare('SELECT password_hash FROM "user" WHERE id = ?').get(alice.id)!.password_hash
  const originalHash = storedHash()
  assert.equal((await request('POST', '/users', { username: ' Alice ', password: 'another password' }, token)).status, 409)
  const duplicate = await request('PUT', detail, { username: '  BOB  ', password: 'replacement password' }, token)
  assert.equal(duplicate.status, 409)
  assert.deepEqual(await duplicate.json(), { error: 'username already exists | field: username' })
  assert.equal(storedHash(), originalHash)

  const response = await request('PUT', detail, { username: '  Ava  ' }, token)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ...alice, username: 'ava' })
  assert.equal(storedHash(), originalHash)
  await login('ava', '  alice password  ')
  assert.equal((await request('POST', '/auth/login', { username: 'ava', password: 'alice password' })).status, 401)

  const newPassword = await request('PUT', detail, { password: '  new password  ' }, token)
  assert.deepEqual(await newPassword.json(), { ...alice, username: 'ava' })
  assert.notEqual(storedHash(), originalHash)
  await login('ava', '  new password  ')

  const banned = await request('PUT', detail, { is_banned: true }, token)
  assert.deepEqual(await banned.json(), { ...alice, username: 'ava', is_banned: true })
  assert.equal((await request('POST', '/auth/login', { username: 'ava', password: '  new password  ' })).status, 401)
  assert.equal((await request('PUT', detail, { is_banned: false }, token)).status, 200)
  await login('ava', '  new password  ')
})

test('users API validates write fields, password boundaries and the role matrix', async (t) => {
  const { request, login, createManager } = setup(t)
  const { access_token: developer } = await login('sam', 'changeit')
  const { id: developerId } = await (await request('GET', '/auth/me', undefined, developer)).json() as { id: string }
  const manager = await createManager(developer, 'manager', '12345678')
  const { access_token: managerToken } = await login('manager', '12345678')
  const other = await createManager(managerToken, 'other', '👩'.repeat(128))

  for (const input of [
    { username: 'x', password: '1234567' },
    { username: 'y', password: 'x'.repeat(129) },
    { username: '  ', password: 'valid password' },
  ]) {
    assert.equal((await request('POST', '/users', input, managerToken)).status, 400)
  }
  assert.equal((await request('POST', '/users', { username: 'candidate', password: 'valid password', role: 'manager' }, managerToken)).status, 400)
  assert.equal((await request('QUERY', '/users', { role: 'manager' }, managerToken)).status, 400)
  for (const input of [
    {},
    { is_banned: 0 },
    { is_banned: 'false' },
    { is_banned: null },
    { username: '' },
    { password: '' },
    { role: 'developer' },
  ]) {
    assert.equal((await request('PUT', '/users/' + other.id, input, managerToken)).status, 400)
  }

  assert.equal((await request('QUERY', '/users', {}, managerToken)).status, 200)
  assert.equal((await request('GET', '/users/' + developerId, undefined, managerToken)).status, 200)
  assert.equal((await request('PUT', '/users/' + developerId, { username: 'newdeveloper' }, managerToken)).status, 403)
  assert.equal((await request('PUT', '/users/' + developerId, { is_banned: true }, managerToken)).status, 403)
  assert.equal((await request('PUT', '/users/' + manager.id, { is_banned: true }, managerToken)).status, 403)
  assert.equal((await request('PUT', '/users/' + manager.id, { is_banned: false }, managerToken)).status, 403)
  assert.equal((await request('PUT', '/users/' + manager.id, { username: 'lead' }, managerToken)).status, 200)
  assert.equal((await request('PUT', '/users/' + other.id, { username: 'teammate', is_banned: true }, managerToken)).status, 200)
  const unban = await request('PUT', '/users/' + other.id, { is_banned: false }, managerToken)
  assert.deepEqual(await unban.json(), { ...other, username: 'teammate' })
  await login('teammate', '👩'.repeat(128))
  const renameDeveloper = await request('PUT', '/users/' + developerId, { username: 'admin' }, developer)
  assert.deepEqual(await renameDeveloper.json(), { id: developerId, username: 'admin', role: 'developer', is_banned: false })
})
