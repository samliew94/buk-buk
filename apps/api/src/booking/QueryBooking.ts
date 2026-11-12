import { Guid } from '../value-objects/Guid'

export class QueryBooking {
  constructor(private readonly _d1: D1Database) {}

  async query(bookingId: Guid) {
    const booking = await this._d1.prepare(`
      SELECT id, customer_id, status, created_at, expire_at
      FROM booking
      WHERE id = ?
    `).bind(bookingId.value).first()
    if (!booking) return null

    const { results } = await this._d1.prepare(`
      SELECT r.id, r.room_id, room.name AS room_name, r.room_category_id, c.name AS room_category_name, c.acronym AS room_category_acronym, r."from", r."to"
      FROM room_reservation AS r
      JOIN room ON room.id = r.room_id
      JOIN room_category c ON c.id = r.room_category_id
      WHERE r.booking_id = ?
      ORDER BY r."from", room.sort_order, room.name, r.id
    `).bind(bookingId.value).all<{ id: string; room_id: string; room_name: string; room_category_id: string; room_category_name: string; room_category_acronym: string|null; from: string; to: string }>()

    return {
      ...booking,
      reservations: results.map(reservation => ({
        ...reservation,
        duration: (Date.parse(reservation.to) - Date.parse(reservation.from)) / 60_000,
      })),
    }
  }
}
