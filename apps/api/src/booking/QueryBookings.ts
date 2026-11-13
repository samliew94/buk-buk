import { Guid } from '../value-objects/Guid'
import { MyDateTime } from '../utils/MyDateTime'

type Room = { id: string; room_category_id: string; name: string; sort_order: number; room_category_name: string; room_category_acronym: string | null }
type Booking = { id: string; customer_id: string; customer_name: string; customer_phone: string; status: string; created_at: string; expire_at: string }
type Reservation = { id: string; room_id: string; room_name: string; room_category_id: string; room_category_name: string; room_category_acronym: string | null; from: string; to: string }

export class QueryBookings {
  constructor(private readonly _d1: D1Database) {}

  async query(businessId: Guid, date: MyDateTime) {
    const day = new MyDateTime(date.value.setZone('Asia/Kuala_Lumpur').startOf('day'))
    const { results: rooms } = await this._d1.prepare(`
      SELECT room.id, room.room_category_id, room.name, room.sort_order,
        c.name AS room_category_name, c.acronym AS room_category_acronym
      FROM room JOIN room_category c ON c.id = room.room_category_id
      WHERE c.business_id = ? ORDER BY c.sort_order, room.sort_order, c.name, c.id, room.name, room.id
    `).bind(businessId.value).all<Room>()
    const { results } = await this._d1.prepare(`
      SELECT b.id AS booking_id, b.customer_id, customer.name AS customer_name, customer.phone AS customer_phone, b.status, b.created_at, b.expire_at,
        r.id, r.room_id, room.name AS room_name, r.room_category_id,
        requested.name AS room_category_name, requested.acronym AS room_category_acronym,
        r."from", r."to"
      FROM room_reservation r
      JOIN booking b ON b.id = r.booking_id
      JOIN customer ON customer.id = b.customer_id
      JOIN room ON room.id = r.room_id
      JOIN room_category requested ON requested.id = r.room_category_id
      WHERE b.business_id = ? AND r."from" < ? AND r."to" > ?
        AND (b.status != 'pending' OR b.expire_at > ?)
      ORDER BY r."from", room.sort_order, room.name, room.id, r.id
    `).bind(businessId.value, day.nextDay().toUtcIso(), day.toUtcIso(), MyDateTime.now().toUtcIso())
      .all<Omit<Booking, 'id'> & Reservation & { booking_id: string }>()
    const bookings = new Map<string, Booking & { reservations: (Reservation & { duration: number })[] }>()
    for (const row of results) {
      const { booking_id, customer_id, customer_name, customer_phone, status, created_at, expire_at, ...reservation } = row
      if (!bookings.has(booking_id)) bookings.set(booking_id, { id: booking_id, customer_id, customer_name, customer_phone, status, created_at, expire_at, reservations: [] })
      bookings.get(booking_id)!.reservations.push({ ...reservation, duration: (Date.parse(row.to) - Date.parse(row.from)) / 60_000 })
    }
    return { rooms, bookings: [...bookings.values()] }
  }
}
