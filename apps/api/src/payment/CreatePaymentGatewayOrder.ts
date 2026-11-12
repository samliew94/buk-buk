import { Guid } from "../value-objects/Guid";
import { Money } from "../value-objects/Money";

export interface CreatePaymentGatewayOrder {
  createPaymentGatewayOrder(paymentId: Guid, price: Money): Promise<{ payment_url: string }>;
}
