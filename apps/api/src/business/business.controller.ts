import { requireAccessToken } from '../middleware/auth.middleware'
import { Hono } from 'hono'
import type { AppEnv } from '../dependencies'
import { BadRequestError, NotFoundError } from '../errors'
import { Guid } from '../value-objects/Guid'
import { Name } from '../value-objects/Name'

export const business = new Hono<AppEnv>()

business.put('/:id', requireAccessToken, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new BadRequestError('Invalid JSON body')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !('name' in body) || typeof body.name !== 'string') {
    throw new BadRequestError('name must be a string')
  }
  const businessId = Guid.from(c.req.param('id'))
  const name = Name.from(body.name)
  const result = await c.get('dependencies').updateBusiness.exec(businessId, name)
  if (result.meta.changes === 0) throw new NotFoundError('business not found | id: ' + c.req.param('id'))
  return c.json({ id: businessId.value, name: name.value })
})

business.get('/:id', async (c) => {
  const business = await c.get('dependencies')
    .queryBusiness.query(
      Guid.from(c.req.param('id')))

  if (!business) 
    throw new NotFoundError('business not found | id: ' + c.req.param('id'))
  
  return c.json(business)})

business.post('/', requireAccessToken, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new BadRequestError('Invalid JSON body')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !('name' in body) || typeof body.name !== 'string') {
    throw new BadRequestError('name must be a string')}

  const name = Name.from(body.name)
  const id = Guid.new()

  await c.get('dependencies').createBusiness.exec(id, name)
  
  return c.json({ id: id.value, name: name.value }, 201)})
