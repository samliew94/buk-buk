import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/index'
import { createDependencies } from '../src/dependencies'

const env = { JWT_SECRET: 'test-secret-with-at-least-32-characters', ADMIN_PASSWORD: 'test-password' }
const app = createApp()
const request = (path: string, init?: RequestInit) => app.request(path, init, env)
const login = (body: unknown) => request('/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const signed = (claims: object, options: jwt.SignOptions = {}) => jwt.sign(claims, env.JWT_SECRET, {
  issuer: 'booking-api', audience: 'booking-web', subject: 'user-1', expiresIn: '1h', ...options,
})

test('health and retired routes', async () => {
  assert.equal((await request('/')).status, 200)
  for (const path of ['/v1/games', '/v1/players', '/v1/poses', '/v1/riddles', '/v1/station-presets', '/v1/stations', '/v1/buckets', '/v1/ais', '/assets/test', '/v1/auth/gm/login', '/v1/auth/player/login', '/v1/auth/exchange-token']) {
    assert.equal((await request(path, { method: path.includes('login') || path.includes('exchange') ? 'POST' : 'GET' })).status, 404, path)
  }
})

test('admin login produces usable credentials', async () => {
  const response = await login({ password: env.ADMIN_PASSWORD })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const result = await response.json() as { token: string; expires_at: string }
  assert.deepEqual(Object.keys(result).sort(), ['expires_at', 'token'])
  assert.ok(Date.parse(result.expires_at) > Date.now())
  for (const path of ['/v1/auth/me', '/v1/auth/admin']) {
    const response = await request(path, { headers: { Authorization: `Bearer ${result.token}` } })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { id: 'admin', role: 'admin' })
  }
})

test('invalid inputs and passwords', async () => {
  assert.equal((await login({ password: 'wrong' })).status, 401)
  for (const body of [null, [], {}, { password: 1 }, { password: '' }, { password: 'test', role: 'admin' }]) {
    assert.equal((await login(body)).status, 400)
  }
  assert.equal((await request('/v1/auth/login', { method: 'POST', body: '{' })).status, 400)
})

test('authentication rejects missing, tampered, expired and invalid claims', async () => {
  assert.equal((await request('/v1/auth/me')).status, 401)
  const tokens = ['invalid', signed({ role: 'admin' }) + 'x', signed({ role: 'admin' }, { expiresIn: -1 }),
    signed({ role: 'gm' }), signed({ role: 'admin' }, { issuer: 'other' }),
    signed({ role: 'admin' }, { audience: 'other' }), signed({ role: 'admin' }, { subject: '' }),
    jwt.sign({ role: 'admin', sub: 'admin', iss: 'booking-api', aud: 'booking-web' }, env.JWT_SECRET)]
  for (const token of tokens) {
    const response = await request('/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('www-authenticate'), 'Bearer')
  }
})

test('authenticated users cannot access admin resources', async () => {
  const headers = { Authorization: `Bearer ${signed({ role: 'user' })}` }
  assert.equal((await request('/v1/auth/me', { headers })).status, 200)
  assert.equal((await request('/v1/auth/admin', { headers })).status, 403)
})

test('app dependencies can be replaced without changing controllers', async () => {
  const injected = createApp((bindings) => ({ ...createDependencies(bindings), authService: {
    login: () => ({ token: 'injected', expires_at: 'test' }),
    verify: () => ({ id: 'injected', role: 'admin' }),
  } }))
  const response = await injected.request('/v1/auth/me', { headers: { Authorization: 'Bearer test' } }, env)
  assert.deepEqual(await response.json(), { id: 'injected', role: 'admin' })
})
