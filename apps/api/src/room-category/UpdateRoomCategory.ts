import { Guid } from '../value-objects/Guid'
import { Name } from '../value-objects/Name'
import { Acronym } from '../value-objects/Acronym'

export class UpdateRoomCategory {
  constructor(private readonly _d1: D1Database) {}

  async exec(
    businessId: Guid,
    id: Guid,
    name: Name,
    sortOrder: number,
    acronym: Acronym,
  ) {
    return await this._d1
      .prepare(
        `
      UPDATE room_category SET business_id = ?, name = ?, sort_order = ?, acronym = ?
      WHERE id = ?`,
      )
      .bind(businessId.value, name.value, sortOrder, acronym.value, id.value)
      .run()
  }
}
