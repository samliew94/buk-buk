import { Money } from "../value-objects/Money";

export class UpfrontPayment {

  private readonly PAYMENT_GATEWAY_FEE = 1.50;

  constructor(
    private readonly _businessFee: Money
  ) {}

  get total(): Money {
    return new Money(this.PAYMENT_GATEWAY_FEE + this._businessFee.value);
  }

  static async fromRowResult(result: any) {
    if (!result || result.price === 0) return null;
    return new UpfrontPayment(new Money(result.price));
  }

}
