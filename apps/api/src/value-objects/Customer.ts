import { Guid } from "./Guid";
import { Name } from "./Name";
import { Phone } from "./Phone";

export class Customer {
  constructor(
    private readonly _id: Guid,
    private readonly _name: Name,
    private readonly _phone: Phone,
  ) {}

  get id() { return this._id }

  get name() { return this._name }
  
  get phone() { return this._phone }

  static from(id: Guid, name: Name, phone: Phone) {
    return new Customer(id, name, phone);
  }
}
