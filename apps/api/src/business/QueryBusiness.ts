import { Guid } from '../value-objects/Guid';

export class QueryBusiness {
  constructor(private readonly _d1: D1Database) {}

  async query(businessId: Guid) {
    return await this._d1.prepare(`
      SELECT id, name, open_at, close_at
      FROM business
      WHERE id = ?
      LIMIT 1`)
      .bind(businessId.value)
      .first();
  }
}
