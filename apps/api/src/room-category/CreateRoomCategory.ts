import { Guid } from '../value-objects/Guid'
import { Name } from '../value-objects/Name'
import { Acronym } from '../value-objects/Acronym'

export class CreateRoomCategory {
  constructor(private readonly _d1: D1Database) {}

  async exec(
    guid: Guid,
    businessId: Guid,
    name: Name,
    sortOrder: number,
    acronym: Acronym | null = null,
  ) {
    return await this._d1
      .prepare(
        `
      INSERT INTO room_category (id, business_id, name, sort_order, acronym)
      VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        guid.value,
        businessId.value,
        name.value,
        sortOrder,
        acronym?.value ?? null,
      )
      .run()
  }
}
