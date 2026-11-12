import { Guid } from "../value-objects/Guid";
import { Money } from "../value-objects/Money";
import { DemoPaymentStatus } from "./demo-payment-status.enum";

export class DemoPaymentOrder {
  constructor(
    readonly id: Guid,
    readonly referenceId: Guid,
    readonly price: Money,
    readonly status: DemoPaymentStatus,
  ) {}

  get paymentUrl(): string {
    return `/payment/demo/${this.id.value}`;
  }

}
