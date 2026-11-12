import { Guid } from '../value-objects/Guid'
import { NotFoundError } from '../errors'
export class RequireRoomCategory {
  constructor(private readonly _d1: D1Database) {}
  async exec(id: Guid, businessId?: Guid) {
    const row = await this._d1
      .prepare(
        `SELECT id, acronym FROM room_category WHERE id = ? ${businessId ? 'AND business_id = ?' : ''}`,
      )
      .bind(id.value, ...(businessId ? [businessId.value] : []))
      .first<{ id: string; acronym: string | null }>()
    if (!row)
      throw new NotFoundError('room category not found | id: ' + id.value)
    return row
  }
}
