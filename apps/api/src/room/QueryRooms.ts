import { Guid } from '../value-objects/Guid';

export class QueryRooms {
  constructor(private readonly _d1: D1Database) {}

  async query(businessId: Guid) {
    return await this._d1.prepare(`
      SELECT r.id, r.room_category_id, r.name, r.sort_order
      FROM room r JOIN room_category c ON c.id = r.room_category_id
      WHERE c.business_id = ?
      ORDER BY r.sort_order, r.name, r.id`)
      .bind(businessId.value)
      .all();
  }
}
