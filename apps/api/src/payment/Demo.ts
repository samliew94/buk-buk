import { InternalServerError } from "../errors";
import { Guid } from "../value-objects/Guid";
import { Money } from "../value-objects/Money";
import type { CreatePaymentGatewayOrder } from "./CreatePaymentGatewayOrder";
import { CreateDemoPaymentOrder } from "./CreateDemoPaymentOrder";
import { DemoPaymentOrder } from "./DemoPaymentOrder";
import { DemoPaymentStatus } from "./demo-payment-status.enum";
import { MyDateTime } from "../utils/MyDateTime";

/** Demo simulates real PaymentGateway system with it's own internal db schema (demo_payment_order) */
export class Demo implements CreatePaymentGatewayOrder {

  constructor(
    private readonly _createDemoPaymentOrder: CreateDemoPaymentOrder
  ) {}

  async createPaymentGatewayOrder(paymentId: Guid, price: Money): Promise<{ payment_url: string }> {
    
    const demoPaymentOrderId = Guid.new();

    const result = await this._createDemoPaymentOrder.exec(
      demoPaymentOrderId, paymentId, price, DemoPaymentStatus.PENDING, MyDateTime.now());

    if (!result.success) 
      throw new InternalServerError(`Unexpected error | demoPaymentOrderId: ${demoPaymentOrderId.value} | paymentId: ${paymentId.value}, price: ${price.value}`);

    const demoPayment = new DemoPaymentOrder(
      demoPaymentOrderId, paymentId, price, DemoPaymentStatus.PENDING);

    return { payment_url: demoPayment.paymentUrl }
  }

}
