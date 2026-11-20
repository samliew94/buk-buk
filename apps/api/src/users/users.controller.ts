import { Hono } from 'hono'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'
import { requireAccessToken } from '../middleware/auth.middleware'
import { Guid } from '../value-objects/Guid'
import type { UserUpdate } from './UpdateUser'
import { normalizeUsername } from './username'

async function readBody(request: Request, allowedFields: string[]): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new BadRequestError('invalid JSON body | resource: user')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('body must be an object | resource: user')
  }
  if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
    throw new BadRequestError('unexpected field | resource: user')
  }
  return body as Record<string, unknown>
}

function readUsername(value: unknown): string {
  if (typeof value !== 'string' || !normalizeUsername(value)) {
    throw new BadRequestError('username must be a nonblank string | field: username')
  }
  return value
}

function readPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length > 256) {
    throw new BadRequestError('password must be 8–128 characters | field: password')
  }
  const length = [...value].length
  if (length < 8 || length > 128) {
    throw new BadRequestError('password must be 8–128 characters | field: password')
  }
  return value
}

export const usersController = new Hono<AppEnv>()

usersController.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await next()
})

usersController.use('*', requireAccessToken)

usersController.query('/', async (c) => {
  await readBody(c.req.raw, [])
  return c.json(await c.get('dependencies').queryUsers.query())
})

usersController.get('/:id', async (c) => {
  const id = Guid.from(c.req.param('id'))
  return c.json(await c.get('dependencies').queryUser.query(id))
})

usersController.post('/', async (c) => {
  const body = await readBody(c.req.raw, ['username', 'password'])
  const user = await c.get('dependencies').createUser.exec(c.get('principal'), Guid.new(), {
    username: readUsername(body.username),
    password: readPassword(body.password),
  })
  return c.json(user, 201)
})

usersController.put('/:id', async (c) => {
  const body = await readBody(c.req.raw, ['username', 'password', 'is_banned'])
  if (!Object.keys(body).length) {
    throw new BadRequestError('at least one field is required | resource: user')
  }
  const input: UserUpdate = {}
  if ('username' in body) input.username = readUsername(body.username)
  if ('password' in body) input.password = readPassword(body.password)
  if ('is_banned' in body) {
    if (typeof body.is_banned !== 'boolean') {
      throw new BadRequestError('is_banned must be a boolean | field: is_banned')
    }
    input.is_banned = body.is_banned
  }
  const id = Guid.from(c.req.param('id'))
  return c.json(await c.get('dependencies').updateUser.exec(c.get('principal'), id, input))
})
