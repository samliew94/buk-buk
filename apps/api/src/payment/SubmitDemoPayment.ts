import { InternalServerError, NotFoundError } from '../errors'
import type { HandleDemoPaymentWebhook } from './HandleDemoPaymentWebhook'
import { DemoPaymentStatus } from './demo-payment-status.enum'

export class SubmitDemoPayment {
  constructor(
    private readonly _d1: D1Database,
    private readonly _webhook: Pick<HandleDemoPaymentWebhook, 'exec'>,
  ) {}

  async exec(orderId: string, status: DemoPaymentStatus.PAID | DemoPaymentStatus.CANCELLED | DemoPaymentStatus.REJECTED) {
    const order = await this._d1.prepare(`
      SELECT o.id, o.reference_id, o.price, p.booking_id
      FROM demo_payment_order o
      JOIN payment p ON p.id = o.reference_id
      WHERE o.id = ?
    `).bind(orderId).first<{ id: string; reference_id: string; price: number; booking_id: string }>()
    if (!order) throw new NotFoundError('demo payment order not found | id: ' + orderId)

    const result = await this._d1.prepare(`
      UPDATE demo_payment_order SET status = ? WHERE id = ?
    `).bind(status, orderId).run()
    if (!result.success) {
      throw new InternalServerError('could not update demo payment order | id: ' + orderId)
    }
    await this._webhook.exec({ order_id: orderId, reference_id: order.reference_id, status })
    return { id: order.id, reference_id: order.reference_id, booking_id: order.booking_id, price: order.price, status }
  }
}
