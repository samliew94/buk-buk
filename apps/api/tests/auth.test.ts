import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import { SessionTokens } from '../src/auth/SessionTokens'
import type { TokenPair } from '../src/auth/auth.types'
import { hashPassword, verifyPassword } from '../src/auth/password'
import { createDependencies } from '../src/dependencies'
import { createApp } from '../src/index'
import { fixture } from './sqlite'

const secrets = {
  JWT_SECRET: 'test-access-secret-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-characters',
}
const app = createApp()
const staffId = 'b60ffc7b-3016-4a8f-a7a5-0943fb9e4157'

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const bearer = (token: string): RequestInit => ({ headers: { Authorization: 'Bearer ' + token } })

test('health and retired routes', async () => {
  assert.equal((await app.request('/', undefined, secrets)).status, 200)
  for (const path of ['/v1/games', '/v1/players', '/v1/poses', '/v1/riddles', '/v1/station-presets', '/v1/stations', '/v1/buckets', '/v1/ais', '/assets/test', '/v1/auth/gm/login', '/v1/auth/player/login', '/v1/auth/exchange-token']) {
    const init = path.includes('/auth/') ? { method: 'POST' } : undefined
    assert.equal((await app.request(path, init, secrets)).status, 404, path)
  }
})

test('seeded developer login normalizes username and returns an uncached token pair', async (t) => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  const env = { ...secrets, DB: d1 }
  const response = await app.request('/v1/auth/login', json({ username: '  SaM ', password: 'changeit' }), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const result = await response.json() as TokenPair
  assert.deepEqual(Object.keys(result).sort(), ['access_token', 'expires_at', 'refresh_expires_at', 'refresh_token'])
  assert.equal(Date.parse(result.refresh_expires_at) - Date.parse(result.expires_at), (7 * 24 * 60 - 15) * 60_000)
  const sam = db.prepare("SELECT id, role FROM user WHERE username = 'sam'").get()
  for (const path of ['/v1/auth/me', '/v1/auth/admin']) {
    const identity = await app.request(path, bearer(result.access_token), env)
    assert.equal(identity.status, 200)
    assert.equal(identity.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await identity.json(), { ...sam })
  }
})

test('scrypt salts equal passwords independently and preserves whitespace', async () => {
  const password = ' two spaces '
  const first = await hashPassword(password)
  const second = await hashPassword(password)
  assert.notEqual(first, second)
  assert.match(first, /^scrypt\$v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/)
  assert.equal(await verifyPassword(password, first), true)
  assert.equal(await verifyPassword(password.trim(), second), false)
  assert.equal(await verifyPassword(password, 'scrypt$v2$invalid'), false)
})

test('auth rejects malformed JSON and returns one generic credential error', async (t) => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  const env = { ...secrets, DB: d1 }
  for (const input of [null, [], {}, { username: 1, password: 'changeit' }, { username: 'sam', password: '' }, { username: ' ', password: 'changeit' }, { username: 'sam', password: 'changeit', role: 'developer' }]) {
    const response = await app.request('/v1/auth/login', json(input), env)
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  for (const path of ['/v1/auth/login', '/v1/auth/refresh']) {
    assert.equal((await app.request(path, { method: 'POST', body: '{' }, env)).status, 400)
  }
  const wrong = await app.request('/v1/auth/login', json({ username: 'sam', password: 'wrong' }), env)
  const unknown = await app.request('/v1/auth/login', json({ username: 'unknown', password: 'changeit' }), env)
  db.prepare("UPDATE user SET is_banned = 1 WHERE username = 'sam'").run()
  const banned = await app.request('/v1/auth/login', json({ username: 'sam', password: 'changeit' }), env)
  const invalidRefresh = await app.request('/v1/auth/refresh', json({ refresh_token: 'invalid' }), env)
  for (const response of [wrong, unknown, banned, invalidRefresh]) {
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Unauthorized' })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('www-authenticate'), 'Bearer')
  }
})

test('access routes reject missing, tampered, expired, legacy and wrong-purpose JWTs', async () => {
  const sign = (claims: object = {}, options: jwt.SignOptions = {}, key = secrets.JWT_SECRET) =>
    jwt.sign({ role: 'manager', purpose: 'access', ...claims }, key, {
      issuer: 'booking-api', audience: 'booking-admin-access', subject: staffId, expiresIn: 900, ...options,
    })
  const tokens = new SessionTokens(secrets.JWT_SECRET, secrets.JWT_REFRESH_SECRET)
  const pair = tokens.start({ id: staffId, role: 'manager' })
  const invalid = [
    'invalid', sign() + 'x', sign({}, { expiresIn: -1 }), sign({}, { algorithm: 'HS384' }),
    sign({ role: 'admin' }), sign({ role: 'user' }), sign({}, { issuer: 'other' }),
    sign({}, { audience: 'booking-web' }), sign({}, { subject: 'admin' }),
    sign({ purpose: 'refresh' }), sign({ purpose: undefined }), pair.refresh_token,
    sign({}, {}, secrets.JWT_REFRESH_SECRET),
    jwt.sign({ role: 'manager', purpose: 'access', iss: 'booking-api', aud: 'booking-admin-access', sub: staffId }, secrets.JWT_SECRET),
    jwt.sign({ role: 'admin', sub: 'admin', iss: 'booking-api', aud: 'booking-web' }, secrets.JWT_SECRET, { expiresIn: 60 }),
  ]
  assert.equal((await app.request('/v1/auth/me', undefined, secrets)).status, 401)
  for (const token of invalid) {
    const response = await app.request('/v1/auth/me', bearer(token), secrets)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('www-authenticate'), 'Bearer')
  }
  const wrongRefresh = await app.request('/v1/auth/refresh', json({ refresh_token: pair.access_token }), secrets)
  assert.equal(wrongRefresh.status, 401)
  const response = await app.request('/v1/auth/admin', bearer(pair.access_token), secrets)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { id: staffId, role: 'manager' })
})

test('refresh requires no D1 after password changes or banning, and keeps earlier refresh tokens usable', async (t) => {
  const { db, d1 } = fixture()
  t.after(() => db.close())
  const response = await app.request('/v1/auth/login', json({ username: 'sam', password: 'changeit' }), { ...secrets, DB: d1 })
  assert.equal(response.status, 200)
  const pair = await response.json() as TokenPair
  const sam = db.prepare("SELECT id, role FROM user WHERE username = 'sam'").get()
  const updatedHash = await hashPassword('different-password')
  db.prepare("UPDATE user SET password_hash = ?, role = 'manager', is_banned = 1 WHERE username = 'sam'").run(updatedHash)
  const refresh = () => app.request('/v1/auth/refresh', json({ refresh_token: pair.refresh_token }), secrets)
  for (const refreshed of [await refresh(), await refresh()]) {
    assert.equal(refreshed.status, 200)
    const next = await refreshed.json() as TokenPair
    assert.notEqual(next.refresh_token, pair.refresh_token)
    assert.equal(next.refresh_expires_at, pair.refresh_expires_at)
    const identity = await app.request('/v1/auth/me', bearer(next.access_token), secrets)
    assert.deepEqual(await identity.json(), { ...sam })
  }
})

test('refresh requires its own issuer, audience, purpose, role, subject and signing key', async () => {
  const sign = (claims: object, options: jwt.SignOptions = {}, key = secrets.JWT_REFRESH_SECRET) =>
    jwt.sign({ role: 'manager', purpose: 'refresh', ...claims }, key, {
      issuer: 'booking-api', audience: 'booking-admin-refresh', subject: staffId, expiresIn: 900, ...options,
    })
  for (const refresh_token of [
    sign({ purpose: 'access' }), sign({ role: 'admin' }), sign({}, { issuer: 'other' }),
    sign({}, { audience: 'booking-admin-access' }), sign({}, { subject: '' }),
    sign({}, { expiresIn: -1 }), sign({}, {}, secrets.JWT_SECRET),
  ]) {
    const response = await app.request('/v1/auth/refresh', json({ refresh_token }), secrets)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'Unauthorized' })
  }
})

test('refresh caps the new access expiry at the fixed session deadline', () => {
  let now = Date.UTC(2026, 10, 19)
  const tokens = new SessionTokens(secrets.JWT_SECRET, secrets.JWT_REFRESH_SECRET, () => now)
  const principal = { id: staffId, role: 'developer' } as const
  const pair = tokens.start(principal)
  now = Date.parse(pair.refresh_expires_at) - 1000
  assert.throws(() => tokens.accessPrincipal(pair.access_token), { status: 401 })
  const nearExpiry = tokens.renew(pair.refresh_token)
  assert.equal(nearExpiry.expires_at, pair.refresh_expires_at)
  assert.equal(nearExpiry.refresh_expires_at, pair.refresh_expires_at)
  assert.deepEqual(tokens.accessPrincipal(nearExpiry.access_token), principal)
  now += 1000
  for (const refreshToken of [pair.refresh_token, nearExpiry.refresh_token]) {
    assert.throws(() => tokens.renew(refreshToken), { status: 401 })
  }
  assert.throws(() => tokens.accessPrincipal(nearExpiry.access_token), { status: 401 })
})

test('app dependencies can be replaced without changing controllers', async () => {
  const injected = createApp((bindings) => ({
    ...createDependencies(bindings),
    verifyAccessToken: { exec: async () => ({ id: 'injected', role: 'developer' }) },
  }))
  const response = await injected.request('/v1/auth/me', bearer('test'), secrets)
  assert.deepEqual(await response.json(), { id: 'injected', role: 'developer' })
})
