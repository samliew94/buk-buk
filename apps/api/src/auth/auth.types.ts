export type Role = 'developer' | 'manager'

export interface Principal {
  id: string
  role: Role
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_at: string
  refresh_expires_at: string
}
