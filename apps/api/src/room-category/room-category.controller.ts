import { requireAccessToken } from '../middleware/auth.middleware'
import { Hono } from 'hono'
import type { AppEnv, Dependencies } from '../dependencies'
import { BadRequestError, NotFoundError } from '../errors'
import { Acronym } from '../value-objects/Acronym'
import { Guid } from '../value-objects/Guid'
import { Name } from '../value-objects/Name'

function readBusinessId(value: unknown): Guid {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(
      'business_id must be a nonblank string | field: business_id',
    )
  }
  return Guid.from(value)
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
    throw new BadRequestError('invalid JSON body | resource: room category')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError(
      'body must be an object | resource: room category',
    )
  }
  return body
}

async function readCategoryInput(request: Request) {
  const body = await readBody(request)
  const businessId = readBusinessId(
    'business_id' in body ? body.business_id : undefined,
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
  let acronym: Acronym | null | undefined
  if ('acronym' in body) {
    if (body.acronym === null) {
      acronym = null
    } else if (typeof body.acronym === 'string' && body.acronym.trim()) {
      acronym = Acronym.from(body.acronym)
    } else {
      throw new BadRequestError(
        'acronym must be a nonblank string or null | field: acronym',
      )
    }
  }
  return {
    business_id: businessId,
    name: Name.from(body.name),
    sort_order: body.sort_order,
    acronym,
  }
}

export const roomCategories = new Hono<AppEnv>()

roomCategories.query('/', async (c) => {
  const body = await readBody(c.req.raw)
  const businessId = readBusinessId(
    'business_id' in body ? body.business_id : undefined,
  )
  const dependencies = c.get('dependencies')
  await requireBusiness(dependencies, businessId)
  const result = await dependencies.queryRoomCategories.query(businessId)
  return c.json(result)
})

roomCategories.post('/', requireAccessToken, async (c) => {
  const { business_id: businessId, name, sort_order: sortOrder, acronym } = await readCategoryInput(
    c.req.raw,
  )
  const id = Guid.new()
  const dependencies = c.get('dependencies')
  await requireBusiness(dependencies, businessId)
  await dependencies.createRoomCategory.exec(
    id,
    businessId,
    name,
    sortOrder,
    acronym,
  )
  return c.json(
    {
      id: id.value,
      business_id: businessId.value,
      name: name.value,
      sort_order: sortOrder,
      acronym: acronym?.value ?? null,
    },
    201,
  )
})

roomCategories.put('/:id', requireAccessToken, async (c) => {
  const { business_id: businessId, name, sort_order: sortOrder, acronym } = await readCategoryInput(
    c.req.raw,
  )
  if (!acronym) {
    throw new BadRequestError(
      'acronym must be a nonblank string | field: acronym',
    )
  }
  const id = Guid.from(c.req.param('id'))
  const dependencies = c.get('dependencies')
  await requireBusiness(dependencies, businessId)
  const result = await dependencies.updateRoomCategory.exec(
    businessId,
    id,
    name,
    sortOrder,
    acronym,
  )
  if (result.meta.changes === 0) {
    throw new NotFoundError(
      'room category not found | id: ' +
        id.value +
        ' | business_id: ' +
        businessId.value,
    )
  }
  return c.json(
    {
      id: id.value,
      business_id: businessId.value,
      name: name.value,
      sort_order: sortOrder,
      acronym: acronym.value,
    },
    200,
  )
})
