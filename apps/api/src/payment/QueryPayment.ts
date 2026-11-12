export interface PaymentRecord {
  id: string
  booking_id: string
  price: number
}

export class QueryPayment {
  constructor(private readonly _d1: D1Database) {}

  async query(paymentId: string): Promise<PaymentRecord | null> {
    return this._d1.prepare(`
      SELECT id, booking_id, price FROM payment WHERE id = ?
    `).bind(paymentId).first<PaymentRecord>()
  }
}
