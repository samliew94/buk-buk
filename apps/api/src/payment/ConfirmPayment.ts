import { InternalServerError, NotFoundError } from '../errors'
import { Guid } from '../value-objects/Guid'
import { MyDateTime } from '../utils/MyDateTime'
import { PaymentStatus } from './payment-status.enum'
import type { QueryPayment } from './QueryPayment'

export class ConfirmPayment {
  constructor(
    private readonly _d1: D1Database,
    private readonly _queryPayment: Pick<QueryPayment, 'query'>,
  ) {}

  async exec(paymentId: string): Promise<string> {
    const payment = await this._queryPayment.query(paymentId)
    if (!payment) throw new NotFoundError('payment not found | id: ' + paymentId)

    const result = await this._d1.prepare(`
      INSERT INTO payment (id, booking_id, price, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(Guid.new().value, payment.booking_id, payment.price,
      PaymentStatus.PAID, MyDateTime.now().toUtcIso()).run()
    if (!result.success) {
      throw new InternalServerError('could not confirm payment | paymentId: ' + payment.id)
    }
    return payment.booking_id
  }

} 
