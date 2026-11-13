import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/index'
import { createDependencies } from '../src/dependencies'
import { HandleDemoPaymentWebhook } from '../src/payment/HandleDemoPaymentWebhook'
import { DemoPaymentStatus } from '../src/payment/demo-payment-status.enum'

function setup() {
  const outcomes: unknown[] = []
  const demo = new HandleDemoPaymentWebhook(
    { exec: async () => 'booking-1' },
    { exec: async () => ({ success: true }) as D1Result<Record<string, unknown>> },
    { exec: async () => 'booking-1' },
    { exec: async () => ({ success: true }) as D1Result<Record<string, unknown>> },
  )
  demo.handleSuccess = async (referenceId) => { outcomes.push({ reference_id: referenceId, success: true }) }
  demo.handleFail = async (referenceId, status) => { outcomes.push({ reference_id: referenceId, status, success: false }) }
  const app = createApp((env) => ({
    ...createDependencies(env),
    handleDemoPaymentWebhook: demo,
  }))
  const send = (body: string) => app.request('/webhook/payment/demo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  }, { JWT_SECRET: 'test-secret', ADMIN_PASSWORD: 'test-password' })
  return { outcomes, send }
}

test('public demo payment webhook dispatches terminal outcomes', async () => {
  const { outcomes, send } = setup()
  for (const status of [DemoPaymentStatus.PAID, DemoPaymentStatus.CANCELLED, DemoPaymentStatus.REJECTED]) {
    const response = await send(JSON.stringify({ order_id: 'order-1', reference_id: 'payment-1', status }))
    assert.equal(response.status, 204)
    assert.equal(await response.text(), '')
  }
  assert.deepEqual(outcomes, [
    { reference_id: 'payment-1', success: true },
    { reference_id: 'payment-1', status: 'cancelled', success: false },
    { reference_id: 'payment-1', status: 'rejected', success: false },
  ])
})

test('invalid webhook payloads do not dispatch outcomes', async () => {
  const { outcomes, send } = setup()
  for (const body of ['{', 'null', '[]', '{}',
    JSON.stringify({ status: 'paid' }),
    JSON.stringify({ orderId: 'order-1', referenceId: 'p', status: 'paid' }),
    JSON.stringify({ order_id: 'order-1', referenceId: 'p', status: 'paid' }),
    JSON.stringify({ order_id: 'order-1', reference_id: ' ', status: 'paid' }),
    JSON.stringify({ order_id: 'order-1', status: 'paid' }),
    JSON.stringify({ reference_id: 'p', status: 'paid' }),
    JSON.stringify({ order_id: ' ', reference_id: 'p', status: 'paid' }),
    JSON.stringify({ order_id: 123, reference_id: 'p', status: 'paid' }),
    JSON.stringify({ order_id: 'order-1', reference_id: 123, status: 'paid' }),
    JSON.stringify({ paymentId: 'p', status: 'paid' }),
    JSON.stringify({ order_id: 'order-1', reference_id: 'p', status: 'pending' }),
  ]) {
    assert.equal((await send(body)).status, 400)
  }
  assert.deepEqual(outcomes, [])
})

for (const status of ['paid', 'cancelled', 'rejected']) {
  test(`demo ${status} payment records outcome and updates booking`, async (t) => {
    // Site-specific configuration migrations 0014–0016 require ST3 seed data.
  const db = new DatabaseSync(':memory:')
    t.after(() => db.close())
    const migrations = new URL('../migrations/', import.meta.url)
    for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql') && (name < '0014' || name.startsWith('0017'))).sort()) {
      db.exec(readFileSync(new URL(name, migrations), 'utf8'))
    }
    db.exec(`
      INSERT INTO business(id,name) VALUES ('business-1','Business');
      INSERT INTO customer (id, name, phone) VALUES ('customer-1', 'Guest', '0123');
      INSERT INTO booking (business_id, id, customer_id, status, created_at, expire_at)
        VALUES ('business-1', 'booking-1', 'customer-1', 'pending', '2026-11-07T00:00:00.000Z', '2026-11-07T00:10:00.000Z');
      INSERT INTO payment VALUES ('payment-1', 'booking-1', 25, 'pending', '2026-11-07T00:00:00.000Z');
    `)
    const d1 = {
      prepare(sql: string) {
        return { bind(...values: (string | number)[]) {
          return {
            async first() { return db.prepare(sql).get(...values) ?? null },
            async run() { db.prepare(sql).run(...values); return { success: true } },
          }
        } }
      },
    } as unknown as D1Database
    const app = createApp()
    const send = (referenceId: string) => app.request('/webhook/payment/demo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1', reference_id: referenceId, status }),
    }, { DB: d1 })
    assert.equal((await send('unknown')).status, 404)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payment').get()!.count, 1)
    assert.equal(db.prepare('SELECT status FROM booking').get()!.status, 'pending')
    assert.equal((await send('payment-1')).status, 204)
    assert.equal(db.prepare('SELECT status FROM booking').get()!.status, status === 'paid' ? 'confirmed' : 'cancelled')
    assert.equal(db.prepare('SELECT status FROM payment WHERE id = ?').get('payment-1')!.status, 'pending')
    const outcome = db.prepare('SELECT * FROM payment WHERE id != ?').get('payment-1')!
    assert.equal(outcome.booking_id, 'booking-1')
    assert.equal(outcome.price, 25)
    assert.equal(outcome.status, status)
    assert.ok(outcome.created_at)
  })
}
