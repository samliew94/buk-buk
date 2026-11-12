import jwt from 'jsonwebtoken'
import { createHash, timingSafeEqual } from 'node:crypto'
import { UnauthorizedError } from '../errors'
import type { Principal } from './auth.types'

const JWT_TTL_SECONDS = 24 * 60 * 60
const ISSUER = 'booking-api'
const AUDIENCE = 'booking-web'

export interface AuthenticationService {
  login(password: string): { token: string; expires_at: string }
  verify(token: string): Principal
}

export class AuthService implements AuthenticationService {
  constructor(private readonly secret: string, private readonly adminPassword: string) {}

  private assertConfigured(): void {
    if (!this.secret || this.secret.length < 32 || !this.adminPassword) {
      throw new Error('Configure JWT_SECRET (at least 32 characters) and ADMIN_PASSWORD')
    }
  }

  login(password: string): { token: string; expires_at: string } {
    this.assertConfigured()
    const digest = (value: string) => createHash('sha256').update(value).digest()
    if (!timingSafeEqual(digest(password), digest(this.adminPassword))) {
      throw new UnauthorizedError('Invalid credentials')
    }
    const token = jwt.sign({ role: 'admin' }, this.secret, {
      subject: 'admin', algorithm: 'HS256', expiresIn: JWT_TTL_SECONDS,
      issuer: ISSUER, audience: AUDIENCE,
    })
    return { token, expires_at: new Date(Date.now() + JWT_TTL_SECONDS * 1000).toISOString() }
  }

  verify(token: string): Principal {
    this.assertConfigured()
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
      })
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub ||
          typeof payload.exp !== 'number' || (payload.role !== 'admin' && payload.role !== 'user')) {
        throw new Error('Invalid claims')
      }
      return { id: payload.sub, role: payload.role }
    } catch {
      throw new UnauthorizedError('Invalid or expired authorization token')
    }
  }
}
