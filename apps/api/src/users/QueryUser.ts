import type { Guid } from '../value-objects/Guid'
import { toUser, type UserRow } from './user'

export class QueryUser {
  constructor(private readonly d1: D1Database) {}

  async query(id: Guid) {
    const row = await this.d1
      .prepare('SELECT id, username, role, is_banned FROM "user" WHERE id = ?')
      .bind(id.value)
      .first<UserRow>()
    return row && toUser(row)
  }
}
