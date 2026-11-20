import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/index'
import { fixture } from './sqlite'
import { encode } from '../src/web-push/validation'
import type { Env } from '../src/types/env'
import { pushAuth, pushTokenSecrets } from './web-push-auth'

async function setup() {
  const { db, d1 } = fixture()
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey) as JsonWebKey
  const publicKey = encode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer))
  const env: Env = { DB: d1, ...pushTokenSecrets, VAPID_PUBLIC_KEY: publicKey,
    VAPID_PRIVATE_KEY: jwk.d }
  const { developer, manager, headers, tokens } = pushAuth(db, env)
  const app = createApp()
  const body = { endpoint: 'https://fcm.googleapis.com/device', keys: { p256dh: publicKey, auth: encode(new Uint8Array(16)) } }
  const post = (value: unknown = body, requestHeaders: HeadersInit = headers()) => app.request('/v1/web-push-subscriptions', {
    method: 'POST', headers: requestHeaders, body: JSON.stringify(value),
  }, env)
  const remove = (value: unknown, requestHeaders: HeadersInit = headers()) =>
    app.request('/v1/web-push-subscriptions', {
      method: 'DELETE', headers: requestHeaders, body: JSON.stringify(value),
    }, env)
  return { db, env, app, body, post, remove, developer, manager, headers, tokens }
}

test('registration without a contact subject: exact response, SQLite upsert, multiple devices and constraints', async () => {
  const { db, body, post, env, developer } = await setup()
  try {
    const first = await post(); assert.equal(first.status, 200)
    const result = await first.json() as { id: string }
    assert.deepEqual(Object.keys(result), ['id']); assert.ok(result.id)
    const original = db.prepare('SELECT * FROM web_push_subscription').get()!
    assert.equal(original.user_id, developer.id)
    body.keys.auth = encode(new Uint8Array(16).fill(1))
    const rotation = await setup()
    env.VAPID_PUBLIC_KEY = rotation.env.VAPID_PUBLIC_KEY
    env.VAPID_PRIVATE_KEY = rotation.env.VAPID_PRIVATE_KEY
    rotation.db.close()
    assert.deepEqual(await (await post()).json(), result)
    const updated = db.prepare('SELECT * FROM web_push_subscription').get()!
    assert.equal(updated.created_at, original.created_at)
    assert.equal(updated.auth, body.keys.auth)
    assert.notEqual(updated.vapid_key_id, original.vapid_key_id)
    assert.ok(String(updated.updated_at) >= String(original.updated_at))
    body.endpoint += '/other'; assert.equal((await post()).status, 200)
    assert.equal(db.prepare('SELECT count(*) AS n FROM web_push_subscription').get()!.n, 2)
    assert.throws(() => db.prepare('INSERT INTO web_push_subscription SELECT * FROM web_push_subscription LIMIT 1').run())
    assert.throws(() => db.prepare("INSERT INTO web_push_subscription (id) VALUES ('missing')").run())
  } finally { db.close() }
})

test('invalid JSON, shapes, unsupported fields, URLs, key encoding and size', async () => {
  const { db, body, post, app, env, headers } = await setup()
  try {
    const bad = [null, [], 1, {}, { ...body, extra: 1 }, { ...body, keys: [] },
      { ...body, keys: { ...body.keys, extra: 1 } },
      ...['http://push.example', 'https://u:p@push.example', 'https://push.example/#', 'x', 'https://push.example/' + 'a'.repeat(4096)]
        .map(endpoint => ({ ...body, endpoint })),
      ...['', 'A'.repeat(87), body.keys.p256dh + '='].map(p256dh => ({ ...body, keys: { ...body.keys, p256dh } })),
      ...['x', body.keys.auth + '='].map(auth => ({ ...body, keys: { ...body.keys, auth } })),
    ]
    for (const value of bad) assert.equal((await post(value)).status, 400)
    for (const raw of ['{', ' '.repeat(8193), JSON.stringify({ ...body, extra: 'x'.repeat(8192) })]) {
      assert.equal((await app.request('/v1/web-push-subscriptions', { method: 'POST', headers: headers(), body: raw }, env)).status, 400)
    }
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(' '.repeat(8193))); controller.close() } })
    const request = new Request('http://localhost/v1/web-push-subscriptions', { method: 'POST', headers: headers(), body: stream, duplex: 'half' } as RequestInit)
    assert.equal((await app.fetch(request, env)).status, 400)
    assert.equal(db.prepare('SELECT count(*) AS n FROM web_push_subscription').get()!.n, 0)
  } finally { db.close() }
})

test('registration and removal require access JWTs and only affect the authenticated owner', async () => {
  const { db, body, post, remove, headers, manager, developer, tokens, app, env } = await setup()
  try {
    assert.equal((await post(body, {})).status, 401)
    assert.equal((await post(body, { Authorization: 'Bearer ' + tokens.start(developer).refresh_token })).status, 401)
    assert.equal((await post({ ...body, user_id: manager.id })).status, 400)
    assert.equal((await remove({ id: crypto.randomUUID() }, {})).status, 401)
    const preflight = await app.request('/v1/web-push-subscriptions', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://admin.example.com',
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    }, env)
    assert.equal(preflight.status, 204)
    assert.match(preflight.headers.get('Access-Control-Allow-Methods') ?? '', /DELETE/)
    assert.match(preflight.headers.get('Access-Control-Allow-Headers') ?? '', /authorization/i)
    assert.match(preflight.headers.get('Access-Control-Allow-Headers') ?? '', /content-type/i)
    const response = await post()
    assert.equal(response.status, 200)
    const { id } = await response.json() as { id: string }
    for (const invalid of [null, {}, { id: 123 }, { id: 'invalid' }, { endpoint: body.endpoint },
      { id, user_id: manager.id }]) {
      assert.equal((await remove(invalid)).status, 400)
    }
    assert.equal((await post(body, headers(manager))).status, 409)
    assert.equal((await remove({ id }, headers(manager))).status, 204)
    assert.equal(db.prepare('SELECT user_id FROM web_push_subscription WHERE endpoint = ?').get(body.endpoint)!.user_id, developer.id)
    const other = { ...body, endpoint: body.endpoint + '/other' }
    const otherResponse = await post(other)
    assert.equal(otherResponse.status, 200)
    const { id: otherId } = await otherResponse.json() as { id: string }
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await remove({ id })).status, 204)
    }
    assert.deepEqual(db.prepare('SELECT endpoint FROM web_push_subscription').all().map(row => row.endpoint), [other.endpoint])
    db.prepare('UPDATE web_push_subscription SET user_id = NULL WHERE endpoint = ?').run(other.endpoint)
    assert.equal((await post(other)).status, 409)
    assert.equal((await remove({ id: otherId })).status, 204)
    assert.equal(db.prepare('SELECT user_id FROM web_push_subscription WHERE endpoint = ?').get(other.endpoint)!.user_id, null)
  } finally { db.close() }
})

test('banning removes all subscriptions for that user and prevents reenrollment with the old access token', async () => {
  const { db, env, app, body, post, headers, manager, developer } = await setup()
  try {
    const managerHeaders = headers(manager)
    assert.equal((await post()).status, 200)
    const managerDevice = { ...body, endpoint: body.endpoint + '/manager' }
    const registered = await post(managerDevice, managerHeaders)
    assert.equal(registered.status, 200)
    assert.equal((await post({ ...managerDevice, endpoint: managerDevice.endpoint + '/other' }, managerHeaders)).status, 200)
    const updateBan = (is_banned: boolean) => app.request('/v1/users/' + manager.id, {
      method: 'PUT', headers: headers(), body: JSON.stringify({ is_banned }),
    }, env)
    assert.equal((await updateBan(true)).status, 200)
    assert.deepEqual(db.prepare('SELECT user_id FROM web_push_subscription').all().map(row => row.user_id), [developer.id])
    assert.equal((await app.request('/v1/auth/me', { headers: managerHeaders }, env)).status, 200)
    assert.equal((await post(managerDevice, managerHeaders)).status, 403)
    assert.equal((await updateBan(false)).status, 200)
    assert.equal(db.prepare('SELECT count(*) AS n FROM web_push_subscription WHERE user_id = ?').get(manager.id)!.n, 0)
    assert.equal((await post(managerDevice, managerHeaders)).status, 200)
  } finally { db.close() }
})

test('configuration and database errors are secret safe; unrelated routes work', async () => {
  const { db, body, post, env, app } = await setup()
  const logs: unknown[] = []; const saved = console.error
  console.error = (...args) => { logs.push(args) }
  try {
    for (const field of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const) {
      const original = env[field]
      for (const value of [undefined, 'sensitive-invalid-value']) {
        env[field] = value
        const response = await post(); assert.equal(response.status, 500)
        assert.deepEqual(await response.json(), { error: 'web push registration unavailable | operation: register' })
        assert.equal((await app.request('/', {}, env)).status, 200)
      }
      env[field] = original
    }
    const originalPrivate = env.VAPID_PRIVATE_KEY
    const other = await setup(); env.VAPID_PRIVATE_KEY = other.env.VAPID_PRIVATE_KEY; other.db.close()
    assert.equal((await post()).status, 500)
    assert.equal(db.prepare('SELECT count(*) AS n FROM web_push_subscription').get()!.n, 0)
    env.VAPID_PRIVATE_KEY = originalPrivate
    env.DB = { prepare() { throw new Error(JSON.stringify(body)) } } as unknown as D1Database
    assert.equal((await post()).status, 500)
    const output = String(logs)
    for (const secret of [body.endpoint, body.keys.p256dh, body.keys.auth, env.VAPID_PRIVATE_KEY!, 'sensitive-invalid-value']) assert.ok(!output.includes(secret))
  } finally { console.error = saved; db.close() }
})
