import { NotFoundError } from '../errors';
import { Guid } from '../value-objects/Guid';

export class EnsureRoomsBelongToBusiness {
  constructor(private readonly _d1: D1Database) {}

  async exec(businessId: Guid, roomIds: Guid[]): Promise<void> {
    if (roomIds.length === 0) return;

    const rooms = await this._d1.prepare(`
      SELECT r.id FROM room r JOIN room_category c ON c.id = r.room_category_id
      WHERE c.business_id = ? AND r.id IN (${roomIds.map(() => '?').join(', ')})`)
      .bind(businessId.value, ...roomIds.map(id => id.value))
      .all<{ id: string }>();

    const ownedIds = new Set(rooms.results.map(room => room.id));
    for (const roomId of roomIds) {
      if (!ownedIds.has(roomId.value)) {
        throw new NotFoundError('room not found | room_id: ' + roomId.value
          + ' | business_id: ' + businessId.value);
      }
    }
  }
}
