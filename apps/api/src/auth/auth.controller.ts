import { Hono, type Context } from 'hono'
import type { AppEnv } from '../dependencies'
import { BadRequestError } from '../errors'
import { requireAccessToken } from '../middleware/auth.middleware'

async function credentials(c: Context<AppEnv>, fields: string[]): Promise<Record<string, string>> {
  let value: unknown
  try {
    value = await c.req.json<unknown>()
  } catch {
    throw new BadRequestError('invalid JSON | field: body')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestError('expected a JSON object | field: body')
  }

  const body = value as Record<string, unknown>
  if (Object.keys(body).some((key) => !fields.includes(key))) {
    throw new BadRequestError('unsupported fields | field: body')
  }
  const result: Record<string, string> = {}
  for (const field of fields) {
    const input = body[field]
    if (typeof input !== 'string' || !(field === 'password' ? input : input.trim())) {
      throw new BadRequestError('expected a nonempty string | field: ' + field)
    }
    result[field] = input
  }
  return result
}

export const auth = new Hono<AppEnv>()
auth.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await next()
})
auth.post('/login', async (c) => {
  const { username, password } = await credentials(c, ['username', 'password'])
  return c.json(await c.get('dependencies').login.exec(username, password))
})
auth.post('/refresh', async (c) => {
  const { refresh_token } = await credentials(c, ['refresh_token'])
  return c.json(await c.get('dependencies').refreshToken.exec(refresh_token))
})
auth.get('/me', requireAccessToken, (c) => c.json(c.get('principal')))
auth.get('/admin', requireAccessToken, (c) => c.json(c.get('principal')))
