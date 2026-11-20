import { createMiddleware } from 'hono/factory'
import { UnauthorizedError } from '../errors'
import type { AppEnv } from '../dependencies'

export const requireAccessToken = createMiddleware<AppEnv>(async (c, next) => {
  const match = c.req.header('authorization')?.match(/^Bearer\s+([^\s]+)$/i)
  if (!match) throw new UnauthorizedError()
  c.set('principal', await c.get('dependencies').verifyAccessToken.exec(match[1]))
  await next()
})
