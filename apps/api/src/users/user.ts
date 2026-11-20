import type { Principal } from '../auth/auth.types'
import { ConflictError, InternalServerError } from '../errors'

export type User = Principal & {
  username: string
  is_banned: boolean
}

export type UserRow = Omit<User, 'is_banned'> & { is_banned: 0 | 1 }

export function toUser({ id, username, role, is_banned }: UserRow): User {
  return { id, username, role, is_banned: is_banned === 1 }
}

export function throwUserWriteError(error: unknown): never {
  // D1 and the SQLite test adapter both include the failed column in this error.
  if (error instanceof Error && /UNIQUE constraint failed: user\.username\b/.test(error.message)) {
    throw new ConflictError('username already exists | field: username')
  }
  // Avoid forwarding database diagnostics that could contain password hashes.
  throw new InternalServerError('Internal server error')
}
