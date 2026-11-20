import type { Env } from '../types/env'
import { ConflictError, ForbiddenError, HttpError, InternalServerError } from '../errors'
import { Guid } from '../value-objects/Guid'
import { decode, encode, publicKey } from './validation'

export class RegisterWebPush {
  constructor(private readonly db: D1Database, private readonly env: Env) {}

  async exec(input: { endpoint: string; p256dh: string; auth: string }, userId: string) {
    try {
      const pub = await publicKey(this.env.VAPID_PUBLIC_KEY)
      const raw = decode(this.env.VAPID_PUBLIC_KEY, 65)
      decode(this.env.VAPID_PRIVATE_KEY, 32)
      const privateKey = await crypto.subtle.importKey('jwk', {
        kty: 'EC', crv: 'P-256', x: encode(raw.slice(1, 33)), y: encode(raw.slice(33)),
        d: this.env.VAPID_PRIVATE_KEY,
      }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
      const challenge = new TextEncoder().encode('web-push configuration validation')
      const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, challenge)
      if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, signature, challenge)) throw new Error()
      const identifier = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)))
      const now = new Date().toISOString()
      const row = await this.db.prepare(`
        INSERT INTO web_push_subscription (id, endpoint, p256dh, auth, vapid_key_id, created_at, updated_at, user_id)
        SELECT ?, ?, ?, ?, ?, ?, ?, id FROM "user" WHERE id = ? AND is_banned = 0
        ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth,
          vapid_key_id = excluded.vapid_key_id, updated_at = excluded.updated_at
        WHERE web_push_subscription.user_id = excluded.user_id
        RETURNING id
      `).bind(Guid.new().value, input.endpoint, input.p256dh, input.auth, identifier, now, now, userId).first<{ id: string }>()
      if (!row) {
        const activeUser = await this.db.prepare('SELECT id FROM "user" WHERE id = ? AND is_banned = 0')
          .bind(userId).first()
        if (!activeUser) throw new ForbiddenError('active user required | operation: register')
        throw new ConflictError('replace browser subscription | operation: register')
      }
      return { id: row.id }
    } catch (error) {
      if (error instanceof HttpError) throw error
      // Discard provider/SQL errors: they may contain subscription data or credentials.
      throw new InternalServerError('web push registration unavailable | operation: register')
    }
  }
}
