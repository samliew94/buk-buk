import { SessionTokens } from '../src/auth/SessionTokens'
import type { Principal } from '../src/auth/auth.types'
import type { Env } from '../src/types/env'
import type { DatabaseSync } from 'node:sqlite'

export const pushTokenSecrets = {
  JWT_SECRET: 'access-secret-for-web-push-tests',
  JWT_REFRESH_SECRET: 'refresh-secret-for-web-push-tests',
}

export function pushAuth(db: DatabaseSync, env: Env) {
  const tokens = new SessionTokens(env.JWT_SECRET, env.JWT_REFRESH_SECRET)
  const developer: Principal = { id: 'aaac2910-f26c-4188-94a2-838a2c5ac09f', role: 'developer' }
  const manager: Principal = { id: crypto.randomUUID(), role: 'manager' }
  db.prepare('INSERT INTO "user" (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(manager.id, 'push-manager', 'unused', manager.role)
  const headers = (principal: Principal = developer) => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + tokens.start(principal).access_token,
  })
  return { developer, manager, headers, tokens }
}
