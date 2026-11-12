import { Guid } from '../value-objects/Guid';

export class QueryCustomer {
  constructor(private readonly _d1: D1Database) {}

  async query(customerId: Guid) {
    return await this._d1.prepare(`
      SELECT id, name, phone, created_at
      FROM customer
      WHERE id = ?`)
      .bind(customerId.value)
      .first<{ id: string; name: string; phone: string; created_at: string }>();
  }
}
