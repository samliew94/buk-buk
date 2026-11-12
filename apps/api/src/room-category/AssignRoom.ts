import { Guid } from '../value-objects/Guid'
import { MyDateTime } from '../utils/MyDateTime'
import { ConflictError } from '../errors'
export class AssignRoom {
  constructor(private readonly _d1: D1Database) {}
  // MVP preflight only: concurrent requests are not serialized.
  async exec(categoryId: Guid, from: MyDateTime, to: MyDateTime) {
    const room = await this._d1
      .prepare(
        `
   SELECT room.id FROM room WHERE room.room_category_id = ? AND NOT EXISTS (
    SELECT 1 FROM room_reservation r JOIN booking b ON b.id = r.booking_id
    WHERE r.room_id = room.id AND r."from" < ? AND r."to" > ?
     AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.expire_at > ?))
   ) ORDER BY room.sort_order, room.name, room.id LIMIT 1
  `,
      )
      .bind(
        categoryId.value,
        to.toUtcIso(),
        from.toUtcIso(),
        MyDateTime.now().toUtcIso(),
      )
      .first<{ id: string }>()
    if (!room)
      throw new ConflictError(
        'room category unavailable | id: ' + categoryId.value,
      )
    return Guid.from(room.id)
  }
}
