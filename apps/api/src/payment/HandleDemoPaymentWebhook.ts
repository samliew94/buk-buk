import { BadRequestError } from '../errors'
import type { ConfirmPayment } from './ConfirmPayment'
import type { ConfirmBooking } from '../booking/ConfirmBooking'
import type { CancelPayment } from './CancelPayment'
import type { CancelBooking } from '../booking/CancelBooking'
import { PaymentStatus } from './payment-status.enum'
import { DemoPaymentStatus } from './demo-payment-status.enum'

export class HandleDemoPaymentWebhook {
  constructor(
    private readonly _confirmPayment: Pick<ConfirmPayment, 'exec'>,
    private readonly _confirmBooking: Pick<ConfirmBooking, 'exec'>,
    private readonly _cancelPayment: Pick<CancelPayment, 'exec'>,
    private readonly _cancelBooking: Pick<CancelBooking, 'exec'>,
  ) {}

  async exec(payload: Record<string, unknown>) {
    if (typeof payload.order_id !== 'string' || !payload.order_id.trim()) {
      throw new BadRequestError('expected a nonblank string | field: order_id')
    }
    if (typeof payload.reference_id !== 'string' || !payload.reference_id.trim()) {
      throw new BadRequestError('expected a nonblank string | field: reference_id')
    }

    switch (payload.status) {
      case DemoPaymentStatus.PAID:
        await this.handleSuccess(payload.reference_id)
        break
      case DemoPaymentStatus.CANCELLED:
      case DemoPaymentStatus.REJECTED:
        await this.handleFail(payload.reference_id, payload.status)
        break
      default:
        throw new BadRequestError('expected paid, cancelled or rejected | field: status')
    }
  }

  async handleSuccess(referenceId: string): Promise<void> {
    const bookingId = await this._confirmPayment.exec(referenceId) // referenceId is paymentId in our system
    await this._confirmBooking.exec(bookingId)
  }

  async handleFail(referenceId: string, status: DemoPaymentStatus.CANCELLED | DemoPaymentStatus.REJECTED): Promise<void> {
    const bookingId = await this._cancelPayment.exec(referenceId, status === DemoPaymentStatus.CANCELLED
      ? PaymentStatus.CANCELLED : PaymentStatus.REJECTED)
    await this._cancelBooking.exec(bookingId)
  }
}
