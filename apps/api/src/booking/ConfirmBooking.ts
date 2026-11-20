import type { SendBookingConfirmedNotification } from "./SendBookingConfirmedNotification";
import { BookingStatus } from "./booking-status.enum";

export class ConfirmBooking {
  constructor(
    private readonly _d1: D1Database,
    private readonly _sendBookingConfirmedNotification: Pick<SendBookingConfirmedNotification, 'exec'>,
  ) {}

  async exec(bookingId: string) {
    const result = await this._d1.prepare("UPDATE booking SET status = ? WHERE id = ? AND status <> ?")
      .bind(BookingStatus.CONFIRMED, bookingId, BookingStatus.CONFIRMED)
      .run();
    if (result.meta.changes > 0) {
      await this._sendBookingConfirmedNotification.exec(bookingId);
    }
    return result;
  }
}
