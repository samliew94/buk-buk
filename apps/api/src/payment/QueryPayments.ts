import { Guid } from '../value-objects/Guid'
import { MyDateTime } from '../utils/MyDateTime'

export type PaymentRow = { id: string; booking_id: string; created_at: string; price: number; status: string; customer_name: string; customer_phone: string }

export class QueryPayments {
  constructor(private readonly _d1: D1Database) {}

  async query(businessId: Guid, from: MyDateTime, to: MyDateTime = from) {
    const start = new MyDateTime(from.value.setZone('Asia/Kuala_Lumpur').startOf('day'))
    const end = new MyDateTime(to.value.setZone('Asia/Kuala_Lumpur').startOf('day')).nextDay()
    const { results } = await this._d1.prepare(`
      SELECT p.id, p.booking_id, p.created_at, p.price, p.status,
        customer.name AS customer_name, customer.phone AS customer_phone
      FROM payment p
      JOIN booking b ON b.id = p.booking_id
      JOIN customer ON customer.id = b.customer_id
      WHERE p.created_at >= ? AND p.created_at < ? AND b.business_id = ?
      ORDER BY p.created_at DESC, p.id DESC
    `).bind(start.toUtcIso(), end.toUtcIso(), businessId.value).all<PaymentRow>()
    return results
  }
}
