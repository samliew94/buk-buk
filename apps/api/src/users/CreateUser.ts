import type { Principal } from '../auth/auth.types'
import { hashPassword } from '../auth/password'
import { ForbiddenError } from '../errors'
import type { Guid } from '../value-objects/Guid'
import { throwUserWriteError, type User } from './user'
import { normalizeUsername } from './username'

export class CreateUser {
  constructor(private readonly d1: D1Database) {}

  async exec(actor: Principal, id: Guid, input: { username: string; password: string }): Promise<User> {
    if (actor.role !== 'developer' && actor.role !== 'manager') {
      throw new ForbiddenError()
    }

    const username = normalizeUsername(input.username)
    const passwordHash = await hashPassword(input.password)

    try {
      await this.d1
        .prepare(`INSERT INTO "user" (id, username, password_hash, role, is_banned)
          VALUES (?, ?, ?, 'manager', 0)`)
        .bind(id.value, username, passwordHash)
        .run()
    } catch (error) {
      throwUserWriteError(error)
    }

    return { id: id.value, username, role: 'manager', is_banned: false }
  }
}
