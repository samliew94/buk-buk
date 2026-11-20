import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const PREFIX = 'scrypt$v1'
const KEY_BYTES = 32

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, { N: 16384, r: 8, p: 5 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)
  return [PREFIX, salt.toString('hex'), key.toString('hex')].join('$')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const match = /^scrypt\$v1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(storedHash)
  if (!match) return false
  const candidate = await deriveKey(password, Buffer.from(match[1], 'hex'))
  return timingSafeEqual(candidate, Buffer.from(match[2], 'hex'))
}
