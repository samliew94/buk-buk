import { MyDateTime } from "../utils/MyDateTime";
import { Guid } from "../value-objects/Guid";
import { Money } from "../value-objects/Money";
import { PaymentStatus } from "./payment-status.enum";

export class CreatePayment {
  constructor(private readonly _d1: D1Database) {}

  async exec(
    paymentId: Guid,
    bookingId: Guid,
    price: Money,
    status: PaymentStatus,
    createdAt: MyDateTime
  ) {
    return await this._d1.prepare(`
      INSERT INTO payment (id, booking_id, price, status, created_at)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(
        paymentId.value,
        bookingId.value,
        price.value,
        status,
        createdAt.toUtcIso())
      .run();
  }
}
