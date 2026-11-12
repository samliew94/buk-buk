import { Hono } from 'hono'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'
import { Guid } from '../value-objects/Guid'
import { Money } from '../value-objects/Money'

async function readBody(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: room rental fee')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError(
      'body must be an object | resource: room rental fee',
    )
  }
  return body as Record<string, unknown>
}

function readRoomCategoryId(body: Record<string, unknown>) {
  if (typeof body.room_category_id !== 'string' || !body.room_category_id.trim()) {
    throw new BadRequestError(
      'room_category_id must be a nonblank string | field: room_category_id',
    )
  }
  return Guid.from(body.room_category_id)
}

async function readInput(request: Request) {
  const body = await readBody(request)
  const roomCategoryId = readRoomCategoryId(body)
  if (
    typeof body.duration !== 'number' ||
    !Number.isSafeInteger(body.duration) ||
    body.duration < 0
  ) {
    throw new BadRequestError(
      'duration must be a non-negative safe integer | field: duration',
    )
  }
  if (
    typeof body.price !== 'number' ||
    !Number.isFinite(body.price) ||
    body.price < 0
  ) {
    throw new BadRequestError(
      'price must be a finite, non-negative number | field: price',
    )
  }
  return {
    room_category_id: roomCategoryId,
    duration: body.duration,
    price: new Money(body.price),
  } as const
}

export const roomCategoryRentalFees = new Hono<AppEnv>()

roomCategoryRentalFees.query('/', async (c) => {
  const roomCategoryId = readRoomCategoryId(await readBody(c.req.raw))
  const result = await c
    .get('dependencies')
    .queryRoomCategoryRentalFee.query(roomCategoryId)
  return c.json(result)
})

roomCategoryRentalFees.post('/', async (c) => {
  const { room_category_id: roomCategoryId, duration, price } = await readInput(c.req.raw)
  const id = Guid.new()
  await c
    .get('dependencies')
    .createRoomCategoryRentalFee.exec(id, roomCategoryId, duration, price)
  return c.json(
    {
      id: id.value,
      room_category_id: roomCategoryId.value,
      duration,
      price: price.value,
    },
    201,
  )
})

roomCategoryRentalFees.put('/:id', async (c) => {
  const { room_category_id: roomCategoryId, duration, price } = await readInput(c.req.raw)
  const id = Guid.from(c.req.param('id'))
  await c
    .get('dependencies')
    .updateRoomCategoryRentalFee.exec(id, roomCategoryId, duration, price)
  return c.json(
    {
      id: id.value,
      room_category_id: roomCategoryId.value,
      duration,
      price: price.value,
    },
    200,
  )
})
