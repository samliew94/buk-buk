import type { TokenPair } from './auth.types'
import type { SessionTokens } from './SessionTokens'

export class RefreshToken {
  constructor(private readonly tokens: SessionTokens) {}

  async exec(refreshToken: string): Promise<TokenPair> {
    return this.tokens.renew(refreshToken)
  }
}
