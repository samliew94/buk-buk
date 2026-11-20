import { toUser, type UserRow } from './user'

export class QueryUsers {
  constructor(private readonly d1: D1Database) {}

  async query() {
    const { results } = await this.d1
      .prepare('SELECT id, username, role, is_banned FROM "user" ORDER BY username, id')
      .bind()
      .all<UserRow>()
    return results.map(toUser)
  }
}
