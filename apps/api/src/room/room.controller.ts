import { requireAccessToken } from '../middleware/auth.middleware'
import { Hono } from 'hono'
import type { AppEnv, Dependencies } from '../dependencies'
import { BadRequestError, NotFoundError } from '../errors'

import { Guid } from '../value-objects/Guid'
import { Name } from '../value-objects/Name'

function readId(value: unknown, field: string): Guid {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(
      field + ' must be a nonblank string | field: ' + field,
    )
  }
  return Guid.from(value)
}

async function requireCategory(dependencies: Dependencies, id: Guid) {
  await dependencies.queryRoomCategory.query(id)
}

async function requireBusiness(dependencies: Dependencies, businessId: Guid) {
  const business = await dependencies.queryBusiness.query(businessId)
  if (!business)
    throw new NotFoundError('business not found | id: ' + businessId.value)
}

async function readBody(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: room')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: room')
  }
  return body
}

async function readRoomInput(request: Request) {
  const body = await readBody(request)
  const roomCategoryId = readId(
    'room_category_id' in body ? body.room_category_id : undefined,
    'room_category_id',
  )
  if (!('name' in body) || typeof body.name !== 'string' || !body.name.trim()) {
    throw new BadRequestError('name must be a nonblank string | field: name')
  }
  if (
    !('sort_order' in body) ||
    typeof body.sort_order !== 'number' ||
    !Number.isSafeInteger(body.sort_order)
  ) {
    throw new BadRequestError(
      'sort_order must be a safe integer | field: sort_order',
    )
  }
  return {
    room_category_id: roomCategoryId,
    name: Name.from(body.name),
    sort_order: body.sort_order,
  }
}

export const rooms = new Hono<AppEnv>()

rooms.query('/', async (c) => {
  const body = await readBody(c.req.raw)
  const businessId = readId(
    'business_id' in body ? body.business_id : undefined,
    'business_id',
  )
  const dependencies = c.get('dependencies')
  await requireBusiness(dependencies, businessId)
  const result = await dependencies.queryRooms.query(businessId)
  return c.json(result.results)
})

rooms.post('/', requireAccessToken, async (c) => {
  const { room_category_id: roomCategoryId, name, sort_order: sortOrder } = await readRoomInput(c.req.raw)
  const id = Guid.new()
  const dependencies = c.get('dependencies')
  await requireCategory(dependencies, roomCategoryId)
  await dependencies.createRoom.exec(id, roomCategoryId, name, sortOrder)
  return c.json(
    {
      id: id.value,
      room_category_id: roomCategoryId.value,
      name: name.value,
      sort_order: sortOrder,
    },
    201,
  )
})

rooms.put('/:roomId', requireAccessToken, async (c) => {
  const { room_category_id: roomCategoryId, name, sort_order: sortOrder } = await readRoomInput(c.req.raw)
  const roomId = Guid.from(c.req.param('roomId'))
  const dependencies = c.get('dependencies')
  await requireCategory(dependencies, roomCategoryId)
  const result = await dependencies.updateRoom.exec(
    roomCategoryId,
    roomId,
    name,
    sortOrder,
  )
  if (result.meta.changes === 0) {
    throw new NotFoundError('room not found | id: ' + roomId.value)
  }
  return c.body(null, 204)
})
