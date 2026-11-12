import { Guid } from '../value-objects/Guid'
import { DateTime } from 'luxon'
import { toDB } from '../utils/datetime.util'
import { MyDateTime } from '../utils/MyDateTime'

export class QueryReservations {
  constructor(private readonly _d1: D1Database) {}

  async query(businessId: Guid, from: DateTime, to: DateTime) {
    return await this._d1
      .prepare(
        `
        SELECT DISTINCT b.id, r.room_id, r.room_category_id, b.customer_id, b.status, b.created_at, b.expire_at, r."from", r."to"
        FROM room_reservation AS r
        JOIN booking AS b ON b.id = r.booking_id
      JOIN room ON room.id = r.room_id
      JOIN room_category c ON c.id = room.room_category_id
        WHERE c.business_id = ? AND r."from" >= ? AND r."to" < ?
        ORDER BY r."from", r.room_id
      `,
      )
      .bind(businessId.value, toDB(from), toDB(to))
      .all()
  }

  /** customer-facing calls this */
  async queryByDate(businessId: Guid, date: MyDateTime) {
    const from = date.value.toUTC()

    return await this._d1
      .prepare(
        `
      SELECT DISTINCT b.id, r.room_id, r.room_category_id, b.customer_id, b.status, b.created_at, b.expire_at, r."from", r."to"
      FROM room_reservation AS r
      JOIN booking AS b ON b.id = r.booking_id
      JOIN room ON room.id = r.room_id
      JOIN room_category c ON c.id = room.room_category_id
      WHERE c.business_id = ? AND r."to" > ? AND r."from" < ?
      ORDER BY r."from", r.room_id
    `,
      )
      .bind(businessId.value, toDB(from), toDB(from.plus({ days: 1 })))
      .all()
  }
}
