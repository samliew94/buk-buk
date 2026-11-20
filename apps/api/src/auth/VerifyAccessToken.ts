import type { Principal } from './auth.types'
import type { SessionTokens } from './SessionTokens'

export class VerifyAccessToken {
  constructor(private readonly tokens: SessionTokens) {}

  async exec(token: string): Promise<Principal> {
    return this.tokens.accessPrincipal(token)
  }
}
