import { NotFoundError } from '../errors';
import { Customer } from '../value-objects/Customer';

export class UpdateCustomer {
  constructor(private readonly _d1: D1Database) {}

  async exec(customer: Customer) {
    const result = await this._d1.prepare(`
      UPDATE customer SET name = ?, phone = ?
      WHERE id = ?`)
      .bind(customer.name.value, customer.phone.value, customer.id.value)
      .run();

    if (result.meta.changes === 0) {
      throw new NotFoundError('customer not found | id: ' + customer.id.value);
    }

    return result;
  }
}
