import { UnauthorizedError } from '../errors'
import { normalizeUsername } from '../users/username'
import type { Principal, TokenPair } from './auth.types'
import { verifyPassword } from './password'
import type { SessionTokens } from './SessionTokens'

// Run scrypt for missing accounts too, to keep credential failures similar in cost.
const DUMMY_HASH = 'scrypt$v1$00000000000000000000000000000000$' + '0'.repeat(64)

export class Login {
  constructor(private readonly db: D1Database, private readonly tokens: SessionTokens) {}

  async exec(username: string, password: string): Promise<TokenPair> {
    if (password.length > 256 || [...password].length > 128) throw new UnauthorizedError()
    const user = await this.db.prepare(
      'SELECT id, role, password_hash, is_banned FROM user WHERE username = ?',
    ).bind(normalizeUsername(username)).first<Principal & { password_hash: string; is_banned: number }>()
    const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH)
    if (!user || user.is_banned !== 0 || !valid) throw new UnauthorizedError()
    return this.tokens.start({ id: user.id, role: user.role })
  }
}
