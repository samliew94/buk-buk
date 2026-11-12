import { Guid } from '../value-objects/Guid';
import { Name } from '../value-objects/Name';


export class UpdateRoom {

  constructor(private readonly _d1: D1Database) {}

  async exec(roomCategoryId: Guid, roomId: Guid, name: Name, sortOrder: number) {
    return await this._d1.prepare(`
      UPDATE room SET room_category_id = ?, name = ?, sort_order = ?
      WHERE id = ?`)
      .bind(roomCategoryId.value, name.value, sortOrder, roomId.value)
      .run();
  }

}
