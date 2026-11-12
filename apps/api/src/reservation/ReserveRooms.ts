import { MyDateTime } from "../utils/MyDateTime";
import { Guid } from "../value-objects/Guid";

export class ReserveRooms {
  constructor(private readonly _d1: D1Database) {}

  async exec(
    bookingId: Guid,
    roomId: Guid,
    roomCategoryId: Guid,
    from: MyDateTime,
    to: MyDateTime
  ) {
    return await this._d1.prepare(`
      INSERT INTO room_reservation (id, booking_id, room_id, room_category_id, "from", "to")
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(
        Guid.new().value,
        bookingId.value,
        roomId.value,
        roomCategoryId.value,
        from.toUtcIso(),
        to.toUtcIso())
      .run();
  }
}
