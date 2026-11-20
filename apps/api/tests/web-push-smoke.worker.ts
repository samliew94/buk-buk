// Local-only Worker runtime smoke; transport is controlled and makes no network calls.
import { SendWebPushNotification } from '../src/web-push/SendWebPushNotification'
import { encode } from '../src/web-push/validation'
export default {
  async fetch() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey) as JsonWebKey
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)
    const row = { endpoint: 'https://fcm.googleapis.com/synthetic', p256dh: encode(raw), auth: encode(new Uint8Array(16)), vapid_key_id: encode(new Uint8Array(await crypto.subtle.digest('SHA-256', raw))) }
    const db = { prepare(sql: string) { return { bind() { return { async first() { return sql.startsWith('SELECT') ? row : { id: 'synthetic' } } } } } } } as unknown as D1Database
    let checked = false
    const sender = new SendWebPushNotification(db, { DB: db, JWT_SECRET: '', JWT_REFRESH_SECRET: '', VAPID_PUBLIC_KEY: encode(raw), VAPID_PRIVATE_KEY: jwk.d }, async (_, init) => {
      const headers = new Headers(init.headers)
      checked = headers.get('Content-Encoding') === 'aes128gcm' && headers.get('TTL') === '60' && headers.get('Authorization')!.startsWith('vapid ') && init.redirect === 'manual' && (await new Response(init.body).arrayBuffer()).byteLength === 4096
      return new Response(null, { status: checked ? 201 : 400 })
    })
    return Response.json({ ...await sender.exec({ subscription_id: 'synthetic', title: 'BUK BUK', body: 'This is a test notification.', url: '/calendar' }), runtime: 'workerd', controlled_transport: checked })
  }
}
