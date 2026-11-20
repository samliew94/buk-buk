import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStaffTestApp } from './staff'
import { createDependencies } from '../src/dependencies'

function fixture() {
  const rows = new Map<string, { id: string; name: string }>()
  const app = createStaffTestApp((env) => ({
    ...createDependencies(env),
    createBusiness: { exec: async (id, name) => {
      rows.set(id.value, { id: id.value, name: name.value })
      return {} as D1Result<Record<string, unknown>>
    } },
    queryBusiness: { query: async (id) => rows.get(id.value) ?? null },
    updateBusiness: { exec: async (id, name) => {
      const exists = rows.has(id.value)
      if (exists) rows.set(id.value, { id: id.value, name: name.value })
      return { meta: { changes: exists ? 1 : 0 } } as D1Result<Record<string, unknown>>
    } },
  }))
  return { rows, request: (path: string, init?: RequestInit) => app.request(path, init, {}) }
}

test('business can be created and retrieved through the mounted routes', async () => {
  const { request, rows } = fixture()
  const created = await request('/v1/businesses', {
    method: 'POST', body: JSON.stringify({ name: 'Hotel' }),
    headers: { 'Content-Type': 'application/json' },
  })
  assert.equal(created.status, 201)
  const business = await created.json() as { id: string; name: string }
  assert.match(business.id, /^[0-9a-f-]{36}$/)
  assert.equal(business.name, 'Hotel')
  assert.equal(rows.size, 1)
  const retrieved = await request(`/v1/businesses/${business.id}`)
  assert.equal(retrieved.status, 200)
  assert.deepEqual(await retrieved.json(), business)
  const missing = await request('/v1/businesses/missing')
  assert.equal(missing.status, 404)
  assert.equal(typeof (await missing.json() as { error: string }).error, 'string')
})

test('invalid business input returns 400 without creating records', async () => {
  const { request, rows } = fixture()
  for (const body of ['{', 'null', '[]', '{}', '{"name":1}', '{"name":""}', '{"name":"   "}']) {
    const response = await request('/v1/businesses', { method: 'POST', body })
    assert.equal(response.status, 400, body)
  }
  assert.equal(rows.size, 0)
})

test('PUT updates an existing business and rejects invalid or missing records', async () => {
  const { request, rows } = fixture()
  rows.set('business-1', { id: 'business-1', name: 'Hotel' })
  const put = (id: string, body: string) => request(`/v1/businesses/${id}`, { method: 'PUT', body })
  const response = await put('business-1', JSON.stringify({ name: 'New hotel' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { id: 'business-1', name: 'New hotel' })
  const retrieved = await request('/v1/businesses/business-1')
  assert.deepEqual(await retrieved.json(), { id: 'business-1', name: 'New hotel' })
  for (const body of ['{', 'null', '[]', '{}', '{"name":1}', '{"name":""}', '{"name":"   "}']) {
    assert.equal((await put('business-1', body)).status, 400, body)
  }
  assert.equal(rows.get('business-1')?.name, 'New hotel')
  assert.equal((await put('missing', '{"name":"Hotel"}')).status, 404)
  assert.equal(rows.size, 1)
})
