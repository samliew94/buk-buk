export interface Env {
  DEVELOPER_SECRET?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  DB: D1Database
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
}
