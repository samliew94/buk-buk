import { Guid } from '../value-objects/Guid'

export class QueryRoomCategoryRentalFee {
  constructor(private readonly _d1: D1Database) {}

  async query(roomCategoryId: Guid) {
    return this._d1
      .prepare(
        `
      SELECT id, room_category_id, duration, price
      FROM room_category_rental_fee
      WHERE room_category_id = ?
      ORDER BY id
      LIMIT 1`,
      )
      .bind(roomCategoryId.value)
      .first()
  }
}
