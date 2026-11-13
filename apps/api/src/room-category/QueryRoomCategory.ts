import { Guid } from '../value-objects/Guid'
import { NotFoundError } from '../errors'
export class QueryRoomCategory {
  constructor(private readonly _d1: D1Database) {}
  async query(roomCategoryId: Guid, businessId?: Guid) {
    const row = await this._d1
      .prepare(
        `SELECT id, acronym FROM room_category WHERE id = ? ${businessId ? 'AND business_id = ?' : ''}`,
      )
      .bind(roomCategoryId.value, ...(businessId ? [businessId.value] : []))
      .first<{ id: string; acronym: string | null }>()
    if (!row)
      throw new NotFoundError('room category not found | id: ' + roomCategoryId.value)
    return row
  }
}
