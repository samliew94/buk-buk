import type { Principal } from '../auth/auth.types'
import { hashPassword } from '../auth/password'
import { ForbiddenError, NotFoundError } from '../errors'
import type { Guid } from '../value-objects/Guid'
import { QueryUser } from './QueryUser'
import { throwUserWriteError, toUser, type UserRow } from './user'
import { normalizeUsername } from './username'

export type UserUpdate = {
  username?: string
  password?: string
  is_banned?: boolean
}

export class UpdateUser {
  constructor(private readonly d1: D1Database) {}

  async exec(actor: Principal, id: Guid, input: UserUpdate) {
    const target = await new QueryUser(this.d1).query(id)
    if (!target) throw new NotFoundError('user not found | id: ' + id.value)

    const isDeveloper = actor.role === 'developer'
    if (
      !isDeveloper &&
      (actor.role !== 'manager' || target.role !== 'manager' ||
        (actor.id === id.value && input.is_banned !== undefined))
    ) {
      throw new ForbiddenError()
    }

    const username = input.username === undefined ? null : normalizeUsername(input.username)
    const passwordHash = input.password === undefined ? null : await hashPassword(input.password)
    const isBanned = input.is_banned === undefined ? null : Number(input.is_banned)

    let row: UserRow | null
    try {
      row = await this.d1
        .prepare(`UPDATE "user"
          SET username = COALESCE(?, username),
              password_hash = COALESCE(?, password_hash),
              is_banned = COALESCE(?, is_banned)
          WHERE id = ? AND (? = 1 OR role = 'manager')
          RETURNING id, username, role, is_banned`)
        .bind(username, passwordHash, isBanned, id.value, Number(isDeveloper))
        .first<UserRow>()
    } catch (error) {
      throwUserWriteError(error)
    }

    if (row) return toUser(row)

    // A direct database change could have removed or promoted the account.
    if (await new QueryUser(this.d1).query(id)) throw new ForbiddenError()
    throw new NotFoundError('user not found | id: ' + id.value)
  }
}
