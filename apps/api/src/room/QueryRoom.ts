import { Guid } from '../value-objects/Guid';

export class QueryRoom {
  constructor(private readonly _d1: D1Database) {}

  async query(businessId: Guid, roomId: Guid) {
    return await this._d1.prepare(`
      SELECT r.id, r.room_category_id, r.name, r.sort_order
      FROM room r JOIN room_category c ON c.id = r.room_category_id
      WHERE c.business_id = ? AND r.id = ?
      LIMIT 1`)
      .bind(businessId.value, roomId.value)
      .first();
  }
}
