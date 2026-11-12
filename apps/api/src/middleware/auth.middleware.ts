import { createMiddleware } from 'hono/factory'
import { ForbiddenError, UnauthorizedError } from '../errors'
import type { AppEnv } from '../dependencies'
import type { Role } from '../auth/auth.types'

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const match = c.req.header('authorization')?.match(/^Bearer\s+([^\s]+)$/i)
  if (!match) throw new UnauthorizedError('Missing bearer token')
  c.set('principal', c.get('dependencies').authService.verify(match[1]))
  await next()
})

// Must be mounted after authenticate; also rejects absent identities defensively.
export const authorize = (...roles: Role[]) => createMiddleware<AppEnv>(async (c, next) => {
  const principal = c.get('principal')
  if (!principal) throw new UnauthorizedError()
  if (!roles.includes(principal.role)) throw new ForbiddenError()
  await next()
})
