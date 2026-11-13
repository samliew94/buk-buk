import { BadRequestError, NotFoundError } from '../errors'
import { Guid } from '../value-objects/Guid'
import { QueryBooking } from './QueryBooking'

export class UpdateBooking {
  constructor(
    private readonly _d1: D1Database,
    private readonly _queryBooking: Pick<QueryBooking, 'query'>,
  ) {}

  async exec(bookingId: Guid, reservations: { room_id: string; from: string; to: string }[]) {
    const booking = await this._d1.prepare('SELECT business_id FROM booking WHERE id = ?')
      .bind(bookingId.value).first<{ business_id: string }>()
    if (!booking) throw new NotFoundError('booking not found | id: ' + bookingId.value)

    const replacements = []
    for (const [index, reservation] of reservations.entries()) {
      if (reservations.slice(0, index).some(other => other.room_id === reservation.room_id
        && other.from < reservation.to && other.to > reservation.from)) {
        throw new BadRequestError('overlapping reservations | room_id: ' + reservation.room_id)
      }
      const room = await this._d1.prepare(`
        SELECT room.room_category_id FROM room
        JOIN room_category c ON c.id = room.room_category_id
        WHERE room.id = ? AND c.business_id = ?
      `).bind(reservation.room_id, booking.business_id).first<{ room_category_id: string }>()
      if (!room) throw new NotFoundError('room not found in booking business | id: ' + reservation.room_id)
      replacements.push(this._d1.prepare(`
        INSERT INTO room_reservation (id, booking_id, room_id, room_category_id, "from", "to")
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(Guid.new().value, bookingId.value, reservation.room_id, room.room_category_id, reservation.from, reservation.to))
    }
    // D1 batches execute transactionally: any failed insert rolls back the deletion too.
    await this._d1.batch([
      this._d1.prepare('DELETE FROM room_reservation WHERE booking_id = ?').bind(bookingId.value),
      ...replacements,
    ])
    return this._queryBooking.query(bookingId)
  }
}
