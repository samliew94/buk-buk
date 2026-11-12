import { Guid } from '../value-objects/Guid';
import { Name } from '../value-objects/Name';

export class UpdateBusiness {
  constructor(private readonly _d1: D1Database) {}

  async exec(businessId: Guid, name: Name) {
    return await this._d1.prepare('UPDATE business SET name = ? WHERE id = ?')
      .bind(name.value, businessId.value)
      .run();
  }
}
