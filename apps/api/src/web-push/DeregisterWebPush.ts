export class DeregisterWebPush {
  constructor(private readonly db: D1Database) {}

  async exec(userId: string, id: string): Promise<void> {
    await this.db.prepare('DELETE FROM web_push_subscription WHERE user_id = ? AND id = ?')
      .bind(userId, id).run()
  }
}
