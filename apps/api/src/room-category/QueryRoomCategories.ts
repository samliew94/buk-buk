import { Guid } from '../value-objects/Guid'
export class QueryRoomCategories {
  constructor(private readonly _d1: D1Database) {}
  async query(businessId: Guid) {
    const { results } = await this._d1
      .prepare(
        `
   SELECT c.id, c.business_id, c.name, c.acronym, c.sort_order,
          r.id AS room_id
   FROM room_category c LEFT JOIN room r ON r.room_category_id = c.id
   WHERE c.business_id = ?
   ORDER BY c.sort_order, c.name, c.id, r.sort_order, r.name, r.id
  `,
      )
      .bind(businessId.value)
      .all<{
        id: string
        business_id: string
        name: string
        acronym: string | null
        sort_order: number
        room_id: string | null
      }>()
    const categories = new Map<
      string,
      {
        id: string
        business_id: string
        name: string
        acronym: string | null
        sort_order: number
        room_ids: string[]
      }
    >()
    for (const { room_id: roomId, ...category } of results) {
      if (!categories.has(category.id))
        categories.set(category.id, { ...category, room_ids: [] })
      if (roomId !== null) categories.get(category.id)!.room_ids.push(roomId)
    }
    return [...categories.values()]
  }
}
