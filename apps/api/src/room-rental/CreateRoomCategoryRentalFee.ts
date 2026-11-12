import { Guid } from '../value-objects/Guid'
import { Money } from '../value-objects/Money'

export class CreateRoomCategoryRentalFee {
  constructor(private readonly _d1: D1Database) {}

  async exec(id: Guid, roomCategoryId: Guid, duration: number, price: Money) {
    return this._d1
      .prepare(
        `
      INSERT INTO room_category_rental_fee (id, room_category_id, duration, price)
      VALUES (?, ?, ?, ?)`,
      )
      .bind(id.value, roomCategoryId.value, duration, price.value)
      .run()
  }
}
