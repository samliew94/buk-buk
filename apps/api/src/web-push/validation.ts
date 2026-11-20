import { BadRequestError } from '../errors'

export function object(value: unknown, fields: string[], field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !fields.includes(key))) {
    throw new BadRequestError('invalid object | field: ' + field)
  }
  return value as Record<string, unknown>
}

export function decode(value: unknown, size: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid encoding')
  const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  if (bytes.length !== size || encode(bytes) !== value) throw new Error('invalid encoding')
  return bytes
}

export function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function publicKey(value: unknown) {
  const raw = decode(value, 65)
  if (raw[0] !== 4) throw new Error('invalid point')
  return crypto.subtle.importKey('raw', raw, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])
}

export async function subscription(value: unknown) {
  const body = object(value, ['endpoint', 'keys'], 'body')
  const keys = object(body.keys, ['p256dh', 'auth'], 'keys')
  destination(body.endpoint)
  try { await publicKey(keys.p256dh) }
  catch { throw new BadRequestError('invalid P-256 public key | field: keys.p256dh') }
  try { decode(keys.auth, 16) }
  catch { throw new BadRequestError('invalid authentication secret | field: keys.auth') }
  return { endpoint: body.endpoint as string, p256dh: keys.p256dh as string, auth: keys.auth as string }
}

export function destination(value: unknown): string {
  try {
    if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('https://') || /[\s\\]/.test(value)) throw new Error()
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || value.includes('#') ||
      !(url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname.endsWith('.push.apple.com'))) throw new Error()
    return value
  } catch { throw new BadRequestError('unsupported push destination | field: endpoint') }
}
