/** does Business require upfront payment to secure booking? */

import { Guid } from "../value-objects/Guid";

export class QueryUpfrontPaymentPolicy {

  constructor(private readonly _d1: D1Database) { }

  async query(businessId: Guid): Promise<any> {
    return await this._d1.prepare(`
      SELECT business_id, price
      FROM upfront_payment_policy
      WHERE business_id = ?
      LIMIT 1`)
      .bind(businessId.value)
      .first();
  }

}
