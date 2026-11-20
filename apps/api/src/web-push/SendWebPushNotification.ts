import { encryptNotification } from '@block65/webcrypto-web-push'
import type { Env } from '../types/env'
import { HttpError } from '../errors'
import { decode, encode, destination, publicKey } from './validation'

export class PushSendError extends HttpError {
  constructor(status: HttpError['status'], message: string, readonly providerStatus?: number) {
    super(status, message)
  }
}
export type SendWebPushNotificationInput = {
  subscription_id: string
  title: string
  body: string
  url: string
}
export type Transport = (url: string, init: RequestInit) => Promise<Response>

export class SendWebPushNotification {
  constructor(private readonly db: D1Database, private readonly env: Env,
    private readonly transport: Transport = (url, init) => globalThis.fetch(url, init),
    private readonly timeoutMs = 8000) {}

  async exec(input: SendWebPushNotificationInput) {
    try { return await this.send(input) }
    catch (error) {
      if (error instanceof PushSendError) throw error
      throw new PushSendError(503, 'web push unavailable | operation: send')
    }
  }

  private async send({ subscription_id: id, title, body, url }: SendWebPushNotificationInput) {
    const row = await this.db.prepare('SELECT endpoint, p256dh, auth, vapid_key_id, user_id FROM web_push_subscription WHERE id = ? AND user_id IS NOT NULL')
      .bind(id).first<{ endpoint: string; p256dh: string; auth: string; vapid_key_id: string; user_id: string }>()
    if (!row) throw new PushSendError(404, 'subscription not found | operation: send')
    try { destination(row.endpoint) } catch { throw new PushSendError(409, 'unsupported provider; re-register this device | operation: send') }
    let payload: RequestInit
    try {
      const raw = decode(this.env.VAPID_PUBLIC_KEY, 65)
      const pub = await publicKey(this.env.VAPID_PUBLIC_KEY)
      decode(this.env.VAPID_PRIVATE_KEY, 32)
      const privateKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: encode(raw.slice(1,33)), y: encode(raw.slice(33)), d: this.env.VAPID_PRIVATE_KEY }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
      const encoder = new TextEncoder()
      const algorithm = { name: 'ECDSA', hash: 'SHA-256' }
      const header = encode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
      const claims = encode(encoder.encode(JSON.stringify({
        aud: new URL(row.endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      })))
      const signingInput = header + '.' + claims
      const signedBytes = encoder.encode(signingInput)
      const signature = await crypto.subtle.sign(algorithm, privateKey, signedBytes)
      if (!await crypto.subtle.verify(algorithm, pub, signature, signedBytes)) throw new Error()
      const keyId = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)))
      if (keyId !== row.vapid_key_id) throw new PushSendError(409, 'application key changed; re-subscribe with current key | operation: send')

      const plaintext = encoder.encode(JSON.stringify({ title, body, url }))
      if (plaintext.length > 2048) throw new Error()
      const encryptedBody = await encryptNotification({
        endpoint: row.endpoint, expirationTime: null, keys: { p256dh: row.p256dh, auth: row.auth },
      }, plaintext)
      payload = {
        method: 'POST',
        headers: {
          authorization: `vapid t=${signingInput}.${encode(new Uint8Array(signature))}, k=${this.env.VAPID_PUBLIC_KEY}`,
          ttl: '60',
          'content-encoding': 'aes128gcm',
          'content-length': String(encryptedBody.byteLength),
          'content-type': 'application/octet-stream',
        },
        body: encryptedBody,
      }
    } catch (error) {
      if (error instanceof PushSendError) throw error
      throw new PushSendError(503, 'web push configuration invalid | operation: send')
    }
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let response: Response
    try {
      response = await Promise.race([
        this.transport(row.endpoint, { ...payload, redirect: 'manual', signal: controller.signal }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(new PushSendError(504, 'push service timed out | operation: send'))
        }, this.timeoutMs) }),
      ])
    } catch (error) {
      if (error instanceof PushSendError) throw error
      const authorization = new Headers(payload.headers).get('authorization')
      const sensitive = [
        row.endpoint, row.p256dh, row.auth, this.env.VAPID_PRIVATE_KEY,
        this.env.VAPID_PUBLIC_KEY, authorization, authorization?.match(/t=([^,]+)/)?.[1],
      ]
      const cause = error instanceof Error ? error.cause : undefined
      const details = [error, cause].filter(value => value instanceof Error).map(value => {
        let message = value.message
        for (const secret of sensitive) {
          if (secret) message = message.replaceAll(secret, '[redacted]')
        }
        return {
          name: value.name,
          message: message.replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted URL]').slice(0, 500),
        }
      })
      console.warn('Web push transport failed', {
        subscription_id: id,
        provider: new URL(row.endpoint).hostname,
        errors: details,
      })
      throw new PushSendError(503, 'push service temporarily unavailable | operation: send')
    } finally { clearTimeout(timer) }
    void response.body?.cancel().catch(() => {})
    if (response.status >= 200 && response.status < 300) return { status: 'accepted' as const }
    if (response.status === 404 || response.status === 410) {
      await this.db.prepare('DELETE FROM web_push_subscription WHERE id = ? AND user_id = ? AND p256dh = ? AND auth = ? AND vapid_key_id = ?')
        .bind(id, row.user_id, row.p256dh, row.auth, row.vapid_key_id).run()
      throw new PushSendError(410, 'subscription expired; re-register this device | operation: send', response.status)
    }
    if (response.status === 401 || response.status === 403) throw new PushSendError(502, 'push service authentication failed | operation: send', response.status)
    if (response.status === 429 || response.status >= 500) throw new PushSendError(503, 'push service temporarily unavailable | operation: send', response.status)
    throw new PushSendError(502, 'push service rejected notification | operation: send', response.status)
  }
}
