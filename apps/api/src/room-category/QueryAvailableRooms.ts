import { Guid } from '../value-objects/Guid'
import { MyDateTime } from '../utils/MyDateTime'
import { ConflictError } from '../errors'
export class QueryAvailableRooms {
  constructor(private readonly _d1: D1Database) {}
  // MVP preflight only: concurrent requests are not serialized.
  async query(roomCategoryId: Guid, from: MyDateTime, to: MyDateTime, quantity: number) {
    // Temporary conflict bypass: set to false to restore reservation overlap checks.
    const bypassRoomConflicts = true
    const checkConflicts = !bypassRoomConflicts
    const result = await this._d1.prepare(`
      SELECT room.id FROM room WHERE room.room_category_id = ?
      ${checkConflicts ? `AND NOT EXISTS (
        SELECT 1 FROM room_reservation r JOIN booking b ON b.id = r.booking_id
        WHERE r.room_id = room.id AND r."from" < ? AND r."to" > ?
        AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.expire_at > ?))
      )` : ''}
      ORDER BY room.sort_order, room.name, room.id LIMIT ?
    `).bind(roomCategoryId.value, ...(checkConflicts ? [to.toUtcIso(), from.toUtcIso(), MyDateTime.now().toUtcIso()] : []), quantity).all<{id: string}>()
    if (result.results.length < quantity) throw new ConflictError('room category unavailable | id: ' + roomCategoryId.value)
    return result.results.map(room => Guid.from(room.id))
  }
}
