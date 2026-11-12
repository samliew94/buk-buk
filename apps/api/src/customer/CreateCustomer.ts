import { Customer } from '../value-objects/Customer';

export class CreateCustomer {

  constructor(private readonly _d1: D1Database) {}

  async exec(customer: Customer) {

    return await this._d1.prepare(`
      INSERT INTO customer (id, name, phone, created_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
      .bind(customer.id.value, customer.name.value, customer.phone.value)
      .run();

  }
}
