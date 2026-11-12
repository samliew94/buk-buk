import { Guid } from '../value-objects/Guid';
import { Name } from '../value-objects/Name';

export class CreateBusiness {
  constructor(private readonly _d1: D1Database) {}

  async exec(guid: Guid, name: Name) {
    return await this._d1.prepare(`
      INSERT INTO business (id, name)
      VALUES (?, ?)`)
      .bind(guid.value, name.value)
      .run();
  }
}
