import { BookingStatus } from "./booking-status.enum";

export class CancelBooking {
  constructor(
    private readonly _d1: D1Database,
  ) {}

  async exec(bookingId: string) {
    
    return await this._d1.prepare("UPDATE booking SET status = ? WHERE id = ?")
      .bind(BookingStatus.CANCELLED, bookingId)
      .run();
  }
}
