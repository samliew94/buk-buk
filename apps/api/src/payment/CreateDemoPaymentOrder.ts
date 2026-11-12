import { Guid } from "../value-objects/Guid";
import { Money } from "../value-objects/Money";
import { DemoPaymentStatus } from "./demo-payment-status.enum";
import { MyDateTime } from "../utils/MyDateTime";

export class CreateDemoPaymentOrder {
  constructor(private readonly _d1: D1Database) {}

  async exec(
    demoPaymentOrderId: Guid,
    referenceId: Guid,
    price: Money,
    status: DemoPaymentStatus,
    createdAt: MyDateTime,
  ) {
    return await this._d1.prepare(`
      INSERT INTO demo_payment_order (id, reference_id, price, status, created_at)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(demoPaymentOrderId.value, referenceId.value, price.value, status, createdAt.toUtcIso())
      .run();
  }
}
