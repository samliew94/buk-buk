import { Hono } from 'hono'
import { validate as isUuid } from 'uuid'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../dependencies'
import { timingSafeEqual } from 'hono/utils/buffer'
import { BadRequestError, UnauthorizedError } from '../errors'
import { requireAccessToken } from '../middleware/auth.middleware'
import { object, subscription } from './validation'

export const webPush = new Hono<AppEnv>()
webPush.post('/', requireAccessToken, bodyLimit({ maxSize: 8192, onError: () => {
  throw new BadRequestError('body exceeds 8 KiB | field: body')
} }), async c => {
  let body: unknown
  try { body = await c.req.json<unknown>() }
  catch { throw new BadRequestError('invalid JSON | field: body') }
  const input = await subscription(body)
  return c.json(await c.get('dependencies').registerWebPush.exec(input, c.get('principal').id), 200)
})

webPush.delete('/', requireAccessToken, bodyLimit({ maxSize: 8192, onError: () => {
  throw new BadRequestError('body exceeds 8 KiB | field: body')
} }), async c => {
  let body: unknown
  try { body = await c.req.json<unknown>() }
  catch { throw new BadRequestError('invalid JSON | field: body') }
  const { id } = object(body, ['id'], 'body')
  if (typeof id !== 'string' || !isUuid(id)) throw new BadRequestError('invalid UUID | field: id')
  await c.get('dependencies').deregisterWebPush.exec(c.get('principal').id, id)
  return c.body(null, 204)
})

webPush.post('/test', async c => {
  const expected = c.env.DEVELOPER_SECRET
  const supplied = c.req.header('developer_secret')
  if (!expected?.trim() || !supplied || !await timingSafeEqual(supplied, expected)) {
    throw new UnauthorizedError('invalid developer secret | operation: test')
  }
  return c.json(await c.get('dependencies').sendTestWebPush.execForDevelopers(), 200)
})
