import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../src/index'

test('staff methods require credentials before parsing requests or reading D1', async () => {
  const app = createApp()
  const routes = [
    ['QUERY', '/v1/bookings'],
    ['PUT', '/v1/bookings/fixture'],
    ['QUERY', '/v1/payments'],
    ['GET', '/v1/customers/fixture'],
    ['PUT', '/v1/customers/fixture'],
    ['POST', '/v1/businesses'],
    ['PUT', '/v1/businesses/fixture'],
    ['POST', '/v1/rooms'],
    ['PUT', '/v1/rooms/fixture'],
    ['POST', '/v1/room-categories'],
    ['PUT', '/v1/room-categories/fixture'],
    ['POST', '/v1/room-category-rental-fees'],
    ['PUT', '/v1/room-category-rental-fees/fixture'],
    ['QUERY', '/v1/users'],
    ['GET', '/v1/users/fixture'],
    ['POST', '/v1/users'],
    ['PUT', '/v1/users/fixture'],
  ]
  for (const [method, path] of routes) {
    const response = await app.request(path, { method }, {})
    assert.equal(response.status, 401, method + ' ' + path)
    assert.equal(response.headers.get('www-authenticate'), 'Bearer')
  }
})

test('staff QUERY preflight allows Authorization and Content-Type without credentials', async () => {
  const response = await createApp().request('/v1/bookings', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'QUERY',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  }, {})
  assert.equal(response.status, 204)
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /\bQUERY\b/)
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /\bauthorization\b/i)
  assert.match(response.headers.get('access-control-allow-headers') ?? '', /\bcontent-type\b/i)
})
