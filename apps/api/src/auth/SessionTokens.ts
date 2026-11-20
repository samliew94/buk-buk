import jwt from 'jsonwebtoken'
import { validate as isGuid } from 'uuid'
import { UnauthorizedError } from '../errors'
import type { Principal, TokenPair } from './auth.types'

const ACCESS_SECONDS = 15 * 60
const SESSION_SECONDS = 7 * 24 * 60 * 60
const ISSUER = 'booking-api'
const AUDIENCES = { access: 'booking-admin-access', refresh: 'booking-admin-refresh' }
type Purpose = keyof typeof AUDIENCES

export class SessionTokens {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private secret(purpose: Purpose): string {
    if ((this.accessSecret?.trim().length ?? 0) < 32 ||
        (this.refreshSecret?.trim().length ?? 0) < 32 || this.accessSecret === this.refreshSecret) {
      throw new Error('Configure distinct JWT_SECRET and JWT_REFRESH_SECRET values of at least 32 characters')
    }
    return purpose === 'access' ? this.accessSecret : this.refreshSecret
  }

  private issue(principal: Principal, now: number, deadline: number): TokenPair {
    const accessExpiry = Math.min(now + ACCESS_SECONDS, deadline)
    const sign = (purpose: Purpose, exp: number) => jwt.sign(
      { role: principal.role, purpose, exp, iat: now },
      this.secret(purpose),
      {
        algorithm: 'HS256',
        issuer: ISSUER,
        audience: AUDIENCES[purpose],
        subject: principal.id,
        jwtid: crypto.randomUUID(),
      },
    )
    return {
      access_token: sign('access', accessExpiry),
      refresh_token: sign('refresh', deadline),
      expires_at: new Date(accessExpiry * 1000).toISOString(),
      refresh_expires_at: new Date(deadline * 1000).toISOString(),
    }
  }

  private verify(token: string, purpose: Purpose, now: number): { principal: Principal; expiry: number } {
    const secret = this.secret(purpose)
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCES[purpose],
        clockTimestamp: now,
      })
      if (typeof payload === 'string' || payload.purpose !== purpose ||
          payload.aud !== AUDIENCES[purpose] ||
          typeof payload.sub !== 'string' || !isGuid(payload.sub) ||
          typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp) ||
          payload.exp <= now ||
          (payload.role !== 'developer' && payload.role !== 'manager')) {
        throw new UnauthorizedError()
      }
      return { principal: { id: payload.sub, role: payload.role }, expiry: payload.exp }
    } catch {
      throw new UnauthorizedError()
    }
  }

  start(principal: Principal): TokenPair {
    const now = Math.floor(this.now() / 1000)
    return this.issue(principal, now, now + SESSION_SECONDS)
  }

  renew(token: string): TokenPair {
    const now = Math.floor(this.now() / 1000)
    const { principal, expiry } = this.verify(token, 'refresh', now)
    return this.issue(principal, now, expiry)
  }

  accessPrincipal(token: string): Principal {
    return this.verify(token, 'access', Math.floor(this.now() / 1000)).principal
  }
}
