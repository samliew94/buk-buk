import { NotFoundError } from '../errors'
import { Guid } from '../value-objects/Guid'
import { Money } from '../value-objects/Money'

export class UpdateRoomCategoryRentalFee {
  constructor(private readonly _d1: D1Database) {}

  async exec(id: Guid, roomCategoryId: Guid, duration: number, price: Money) {
    const result = await this._d1
      .prepare(
        `
      UPDATE room_category_rental_fee SET room_category_id = ?, duration = ?, price = ?
      WHERE id = ?`,
      )
      .bind(roomCategoryId.value, duration, price.value, id.value)
      .run()
    if (result.meta.changes === 0) {
      throw new NotFoundError('room rental fee not found | id: ' + id.value)
    }
    return result
  }
}
