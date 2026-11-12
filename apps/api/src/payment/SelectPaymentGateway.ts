import { Guid } from "../value-objects/Guid";
import type { CreatePaymentGatewayOrder } from "./CreatePaymentGatewayOrder";
import { Demo } from "./Demo";

/** if not configured, default to demo PG */
export class SelectPaymentGateway {
  constructor(
    private readonly _d1: D1Database,
    private readonly _demo: Demo,
  ) {}

  async select(businessId: Guid): Promise<CreatePaymentGatewayOrder> {
    const configuration = await this._d1.prepare(`
      SELECT business_id
      FROM business_payment_gateway
      WHERE business_id = ?
      LIMIT 1`)
      .bind(businessId.value)
      .first();

    // implement other rules to select other PGs in the future

    return this._demo; // for now
  }
}
