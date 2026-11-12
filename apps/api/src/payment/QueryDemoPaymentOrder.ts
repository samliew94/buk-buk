import { Guid } from '../value-objects/Guid'

export class QueryDemoPaymentOrder {
  constructor(private readonly _d1: D1Database) {}

  async query(demoPaymentOrderId: Guid) {
    return this._d1.prepare(`
      SELECT id, reference_id, price, status, created_at
      FROM demo_payment_order
      WHERE id = ?
    `).bind(demoPaymentOrderId.value).first()
  }
}
