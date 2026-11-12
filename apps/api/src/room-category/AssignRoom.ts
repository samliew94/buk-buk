import { Guid } from '../value-objects/Guid'
import { MyDateTime } from '../utils/MyDateTime'
import { ConflictError } from '../errors'
export class AssignRoom {
  constructor(private readonly _d1: D1Database) {}
  // MVP preflight only: concurrent requests are not serialized.
  async exec(categoryId: Guid, from: MyDateTime, to: MyDateTime) {
    return (await this.assign(categoryId, from, to, 1, false))[0]!
  }
  async assign(categoryId: Guid, from: MyDateTime, to: MyDateTime, quantity: number, racing: boolean) {
    // Temporary conflict bypass: set to false to restore Racing overlap checks.
    const bypassRoomConflicts = true
    const checkConflicts = racing && !bypassRoomConflicts
    const result = await this._d1.prepare(`
      SELECT room.id FROM room WHERE room.room_category_id = ?
      ${checkConflicts ? `AND NOT EXISTS (
        SELECT 1 FROM room_reservation r JOIN booking b ON b.id = r.booking_id
        WHERE r.room_id = room.id AND r."from" < ? AND r."to" > ?
        AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.expire_at > ?))
      )` : ''}
      ORDER BY room.sort_order, room.name, room.id LIMIT ?
    `).bind(categoryId.value, ...(checkConflicts ? [to.toUtcIso(), from.toUtcIso(), MyDateTime.now().toUtcIso()] : []), quantity).all<{id: string}>()
    if (result.results.length < quantity) throw new ConflictError('room category unavailable | id: ' + categoryId.value)
    return result.results.map(room => Guid.from(room.id))
  }
}
