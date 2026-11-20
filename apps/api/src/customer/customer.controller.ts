import { requireAccessToken } from '../middleware/auth.middleware'
import { Hono } from 'hono'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'
import { Customer } from '../value-objects/Customer'
import { Guid } from '../value-objects/Guid'
import { Name } from '../value-objects/Name'
import { Phone } from '../value-objects/Phone'

async function readInput(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: customer')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: customer')
  }
  const input = body as Record<string, unknown>
  if (typeof input.name !== 'string' || !input.name.trim()) {
    throw new BadRequestError('name must be a nonblank string | field: name')
  }
  if (typeof input.phone !== 'string' || !input.phone.trim()) {
    throw new BadRequestError('phone must be a nonblank string | field: phone')
  }
  return { name: Name.from(input.name), phone: Phone.from(input.phone) }
}

export const customers = new Hono<AppEnv>()

customers.get('/:id', requireAccessToken, async (c) => {
  const customer = await c.get('dependencies').queryCustomer.query(Guid.from(c.req.param('id')))
  return c.json(customer)
})

customers.post('/', async (c) => {
  const { name, phone } = await readInput(c.req.raw)
  const id = Guid.new()
  await c.get('dependencies').createCustomer.exec(Customer.from(id, name, phone))
  return c.json({ id: id.value, name: name.value, phone: phone.value }, 201)
})

customers.put('/:id', requireAccessToken, async (c) => {
  const { name, phone } = await readInput(c.req.raw)
  const id = Guid.from(c.req.param('id'))
  await c.get('dependencies').updateCustomer.exec(Customer.from(id, name, phone))
  return c.json({ id: id.value, name: name.value, phone: phone.value }, 200)
})
