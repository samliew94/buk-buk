import { Guid } from '../value-objects/Guid';
import { Name } from '../value-objects/Name';


export class CreateRoom {

  constructor(private readonly _d1: D1Database) {}

  async exec(guid: Guid, roomCategoryId: Guid, name: Name, sortOrder: number) {
    return await this._d1.prepare(`
      INSERT INTO room (id, room_category_id, name, sort_order)
      VALUES (?, ?, ?, ?)`)
      .bind(guid.value, roomCategoryId.value, name.value, sortOrder)
      .run();
  }

}
