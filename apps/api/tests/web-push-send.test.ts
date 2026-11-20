import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/index'
import { createDependencies } from '../src/dependencies'
import { SendWebPushNotification } from '../src/web-push/SendWebPushNotification'
import { SendTestWebPush, testPayload } from '../src/web-push/SendTestWebPush'
import { encode, destination } from '../src/web-push/validation'
import { fixture } from './sqlite'
import type { Env } from '../src/types/env'
import { pushAuth, pushTokenSecrets } from './web-push-auth'

async function setup(status = 201, timeout = false) {
  const { db, d1 } = fixture()
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey) as JsonWebKey
  const pub = encode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer))
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const receiverRaw = new Uint8Array(await crypto.subtle.exportKey('raw', receiver.publicKey) as ArrayBuffer)
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const env: Env = { DB: d1, ...pushTokenSecrets, VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: jwk.d }
  const { headers, manager } = pushAuth(db, env)
  const calls: RequestInit[] = []
  const sender = new SendWebPushNotification(d1, env, async (_, init) => {
    calls.push(init)
    if (timeout) return new Promise(() => {})
    return new Response('secret-provider-body', { status })
  }, 5)
  const app = createApp(e => ({ ...createDependencies(e), sendTestWebPush: new SendTestWebPush(d1, sender) }))
  const register = async (suffix = 'a', requestHeaders = headers()) => {
    const response = await app.request('/v1/web-push-subscriptions', { method: 'POST', headers: requestHeaders, body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/' + suffix, keys: { p256dh: encode(receiverRaw), auth: encode(auth) } }) }, env)
    assert.equal(response.status, 200)
    return (await response.json() as { id: string }).id
  }
  const send = (id: string) => sender.exec({ subscription_id: id, ...testPayload })
  return { app, db, env, calls, register, send, manager, pair, receiver, receiverRaw, auth, otherUserHeaders: headers(manager) }
}

test('provider destination allowlist', () => {
  for (const url of ['https://fcm.googleapis.com/a', 'https://updates.push.services.mozilla.com/a', 'https://web.push.apple.com/a', 'https://fcm.googleapis.com:443/a']) assert.equal(destination(url), url)
  for (const url of ['https://push.apple.com/a','https://fcm.googleapis.com.evil.com','https://evil.com','https://127.0.0.1','https://fcm.googleapis.com:444/a','https://u@fcm.googleapis.com','https://fcm.googleapis.com/#','http://fcm.googleapis.com','https://fcm.googleapis.com\\@evil.com']) assert.throws(() => destination(url))
})

test('sender rejects missing subscriptions and allows concurrent attempts per device', async () => {
  const f = await setup()
  try {
    await assert.rejects(f.send('missing'), { status: 404 })
    const id = await f.register()
    assert.deepEqual(await Promise.all([f.send(id), f.send(id)]), [
      { status: 'accepted' },
      { status: 'accepted' },
    ])
    assert.equal(f.calls.length, 2)
  } finally { f.db.close() }
})

test('encrypted payload decrypts and VAPID signature/audience verify', async () => {
  const f = await setup()
  try {
    assert.deepEqual(await f.send(await f.register()), { status: 'accepted' })
    const init = f.calls[0]; const headers = new Headers(init.headers)
    assert.equal(init.redirect, 'manual'); assert.equal(headers.get('TTL'), '60')
    assert.equal(headers.get('Content-Encoding'), 'aes128gcm')
    const token = headers.get('Authorization')!.match(/t=([^,]+)/)![1]
    const [head, claim, signature] = token.split('.')
    const from64 = (s: string) => Uint8Array.from(Buffer.from(s, 'base64url'))
    assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, f.pair.publicKey, from64(signature), new TextEncoder().encode(head + '.' + claim)), true)
    const claims = JSON.parse(Buffer.from(claim, 'base64url').toString())
    assert.equal(claims.aud, 'https://fcm.googleapis.com'); assert.equal(Object.hasOwn(claims, 'sub'), false)
    const bytes = new Uint8Array(await new Response(init.body).arrayBuffer())
    const salt = bytes.slice(0,16); const senderRaw = bytes.slice(21,21 + bytes[20])
    const senderPub = await crypto.subtle.importKey('raw', senderRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: senderPub } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0], f.receiver.privateKey, 256)
    const hkdf = async (material: BufferSource, salt: BufferSource, info: Uint8Array, length: number) => {
      const key = await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveBits'])
      return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length)
    }
    const enc = new TextEncoder()
    const ikm = await hkdf(shared, f.auth, new Uint8Array([...enc.encode('WebPush: info\0'), ...f.receiverRaw, ...senderRaw]), 256)
    const key = await crypto.subtle.importKey('raw', await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 128), 'AES-GCM', false, ['decrypt'])
    const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 96)
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, bytes.slice(21 + bytes[20])))
    let end = plain.length - 1; while (plain[end] === 0) end--
    assert.equal(plain[end], 2); assert.equal(new TextDecoder().decode(plain.slice(0,end)), JSON.stringify(testPayload))
  } finally { f.db.close() }
})

test('expiry cleanup, redirects rejected, temporary/auth/provider failures retained, timeout', async () => {
  for (const [provider, expected] of [[404,410],[410,410],[302,502],[400,502],[401,502],[403,502],[429,503],[500,503],[201,504]]) {
    const f = await setup(provider, expected === 504)
    try {
      const id = await f.register()
      await assert.rejects(f.send(id), (error: Error & { status?: number }) =>
        error.status === expected && !error.message.includes('secret-provider-body'))
      assert.equal(f.db.prepare('SELECT count(*) AS n FROM web_push_subscription').get()!.n, expected === 410 ? 0 : 1)
      assert.equal(f.calls.length, 1)
    } finally { f.db.close() }
  }
})

test('old VAPID key is rejected', async () => {
  const f = await setup()
  try {
    const id = await f.register()
    f.db.prepare("UPDATE web_push_subscription SET vapid_key_id = 'old'").run()
    await assert.rejects(f.send(id), { status: 409 }); assert.equal(f.calls.length, 0)
  } finally { f.db.close() }
})

test('unsupported destinations remain stored and configuration failures never reach transport', async () => {
  const f = await setup()
  try {
    const id = await f.register()
    const privateKey = f.env.VAPID_PRIVATE_KEY
    f.env.VAPID_PRIVATE_KEY = 'secret-invalid-configuration'
    await assert.rejects(f.send(id), (error: Error & { status?: number }) =>
      error.status === 503 && !error.message.includes('secret-invalid'))
    f.env.VAPID_PRIVATE_KEY = privateKey
    f.db.prepare("UPDATE web_push_subscription SET endpoint = 'https://legacy.example/device'").run()
    await assert.rejects(f.send(id), { status: 409 })
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM web_push_subscription').get()!.n, 1)
    assert.equal(f.calls.length, 0)
  } finally { f.db.close() }
})

test('unowned legacy subscriptions are ineligible for test delivery', async () => {
  const f = await setup()
  try {
    const id = await f.register()
    f.db.prepare('UPDATE web_push_subscription SET user_id = NULL WHERE id = ?').run(id)
    await assert.rejects(f.send(id), { status: 404 })
    assert.equal(f.calls.length, 0)
  } finally { f.db.close() }
})

test('developer broadcast requires its secret and sends only to developer devices', async () => {
  const f = await setup()
  const broadcast = (secret?: string) => f.app.request('/v1/web-push-subscriptions/test', {
    method: 'POST',
    headers: secret ? { 'developer_secret': secret } : {},
  }, f.env)
  try {
    await f.register('developer-a')
    await f.register('developer-b')
    await f.register('manager', f.otherUserHeaders)
    const legacyId = await f.register('legacy')
    f.db.prepare('UPDATE web_push_subscription SET user_id = NULL WHERE id = ?').run(legacyId)

    assert.equal((await broadcast('test-secret')).status, 401)
    f.env.DEVELOPER_SECRET = 'test-secret'
    assert.equal((await broadcast()).status, 401)
    assert.equal((await broadcast('incorrect')).status, 401)
    assert.equal(f.calls.length, 0)

    const response = await broadcast('test-secret')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { matched: 2, accepted: 2, failed: 0 })
    assert.deepEqual(await (await broadcast('test-secret')).json(), { matched: 2, accepted: 2, failed: 0 })
    assert.equal(f.calls.length, 4)
  } finally { f.db.close() }
})

test('developer broadcast logs a safe reason and the provider status for a failed send', async t => {
  const f = await setup(403)
  const warn = t.mock.method(console, 'warn', () => {})
  try {
    const id = await f.register()
    f.env.DEVELOPER_SECRET = 'test-secret'
    const response = await f.app.request('/v1/web-push-subscriptions/test', {
      method: 'POST',
      headers: { developer_secret: 'test-secret' },
    }, f.env)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { matched: 1, accepted: 0, failed: 1 })
    assert.deepEqual(warn.mock.calls.map(call => call.arguments), [
      ['Web push test send failed', {
        subscription_id: id,
        status: 502,
        reason: 'push service authentication failed | operation: send',
        provider_status: 403,
      }],
    ])
  } finally { f.db.close() }
})

test('default transport calls fetch with the global receiver required by Workers', async t => {
  const f = await setup()
  const fetchMock = t.mock.method(globalThis, 'fetch', async function (this: unknown) {
    assert.equal(this, globalThis)
    return new Response(null, { status: 201 })
  })
  try {
    await f.register()
    const sender = new SendTestWebPush(f.env.DB, new SendWebPushNotification(f.env.DB, f.env))
    assert.deepEqual(await sender.execForDevelopers(), { matched: 1, accepted: 1, failed: 0 })
    assert.equal(fetchMock.mock.callCount(), 1)
  } finally { f.db.close() }
})

test('auto-confirmed bookings and paid webhooks notify staff devices once per confirmation', async t => {
  const f = await setup()
  t.after(() => f.db.close())
  await f.register('developer')
  await f.register('manager', f.otherUserHeaders)
  const legacyId = await f.register('legacy')
  f.db.prepare('UPDATE web_push_subscription SET user_id = NULL WHERE id = ?').run(legacyId)

  f.db.exec(`
    INSERT INTO business(id, name) VALUES ('business', 'Business');
    INSERT INTO customer(id, name, phone) VALUES ('customer', 'Guest', '0123');
    INSERT INTO room_category VALUES ('family', 'business', 'Family', 'FR', 0);
    INSERT INTO room VALUES ('room', 'family', 'FR1', 0);
    INSERT INTO booking (id, business_id, customer_id, status, created_at, expire_at)
      VALUES ('pending', 'business', 'customer', 'pending', '2026-11-07T00:00:00.000Z', '2026-11-07T00:10:00.000Z');
    INSERT INTO payment VALUES ('payment', 'pending', 25, 'pending', '2026-11-07T00:00:00.000Z');
  `)
  const recipients: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const device = new URL(url).pathname
    recipients.push(device)
    return new Response(null, { status: device === '/developer' ? 503 : 201 })
  })
  const warn = t.mock.method(console, 'warn', () => {})
  const post = (path: string, body: unknown) => f.app.request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, f.env)

  const created = await post('/v1/bookings', {
    business_id: 'business', customer_id: 'customer', room_category_id: 'family',
    from: '2026-11-11T07:00:00.000Z', duration: 60,
  })
  assert.equal(created.status, 201)
  assert.deepEqual(recipients.splice(0).sort(), ['/developer', '/manager'])
  assert.equal(warn.mock.callCount(), 1)

  const paid = { order_id: 'order', reference_id: 'payment', status: 'paid' }
  assert.equal((await post('/webhook/payment/demo', paid)).status, 204)
  assert.equal(f.db.prepare("SELECT status FROM booking WHERE id = 'pending'").get()?.status, 'confirmed')
  assert.deepEqual(recipients.splice(0).sort(), ['/developer', '/manager'])
  assert.equal((await post('/webhook/payment/demo', paid)).status, 204)
  assert.deepEqual(recipients, [])
})
