import { Guid } from "../value-objects/Guid";
import { Money } from "../value-objects/Money";
import { SelectPaymentGateway } from "./SelectPaymentGateway";

export class InitiatePaymentGateway {

  constructor(
    private readonly _selectPaymentGateway: SelectPaymentGateway
  ) {}

  async exec(businessId: Guid, paymentId: Guid, price: Money) {

    const gateway = await this._selectPaymentGateway.select(businessId);
    return gateway.createPaymentGatewayOrder(paymentId, price);

  }

}
