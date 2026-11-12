import { BookingStatus } from '../booking/booking-status.enum';
import { BadRequestError, ConflictError } from '../errors';
import { MyDateTime } from '../utils/MyDateTime';
import { Guid } from '../value-objects/Guid';

export class EnsureRoomsAvailable {
  constructor(private readonly _d1: D1Database) {}

  // This preflight check does not lock the room or prevent concurrent bookings.
  async exec(from: MyDateTime, to: MyDateTime, roomIds: Guid[]): Promise<void> {
    if (to.value.toMillis() <= from.value.toMillis()) {
      throw new BadRequestError('end must be after start | room_ids: ' + roomIds.map(id => id.value).join(', '));
    }

    if (roomIds.length === 0) return;

    const conflict = await this._d1.prepare(`
      SELECT r.room_id
      FROM room_reservation AS r
      JOIN booking AS b ON b.id = r.booking_id
      WHERE r.room_id IN (${roomIds.map(() => '?').join(', ')})
        AND (b.status = ? OR (b.status = ? AND b.expire_at > ?))
        AND r."from" < ? AND r."to" > ?
      LIMIT 1`)
      .bind(
        ...roomIds.map(id => id.value),
        BookingStatus.CONFIRMED,
        BookingStatus.PENDING,
        MyDateTime.now().toUtcIso(),
        to.toUtcIso(),
        from.toUtcIso())
      .first<{ room_id: string }>();

    if (conflict != null) {
      throw new ConflictError('room unavailable | room_id: ' + conflict.room_id
        + ' | from: ' + from.toUtcIso() + ' | to: ' + to.toUtcIso());
    }
  }
}
