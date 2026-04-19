import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Encryption for sensitive data at rest.
 * - New values: AES-256-GCM (authenticated).
 * - Legacy: AES-256-CBC (read-only); re-encrypted to GCM on next save via encrypt().
 */

const GCM_PREFIX = 'gcm:v1:'
const GCM_IV_LENGTH = 12
const GCM_TAG_LENGTH = 16
const LEGACY_ALGORITHM = 'aes-256-cbc'
const LEGACY_IV_LENGTH = 16

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }

  return Buffer.from(keyHex, 'hex')
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

function encryptGcm(plain: string, key: Buffer): string {
  const iv = randomBytes(GCM_IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${GCM_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decryptGcm(payload: string, key: Buffer): string {
  const rest = payload.slice(GCM_PREFIX.length)
  const parts = rest.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid GCM encrypted text format')
  }
  const [ivHex, tagHex, cipherHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(cipherHex, 'hex')
  if (iv.length !== GCM_IV_LENGTH || tag.length !== GCM_TAG_LENGTH) {
    throw new Error('Invalid GCM IV or auth tag length')
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function decryptLegacyCbc(payload: string, key: Buffer): string {
  const parts = payload.split(':')
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format')
  }
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = Buffer.from(parts[1], 'hex')
  const decipher = createDecipheriv(LEGACY_ALGORITHM, key, iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/**
 * Encrypt a string (always AES-256-GCM).
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty text')
  }
  const key = getEncryptionKey()
  return encryptGcm(text, key)
}

/**
 * Decrypt a string (GCM or legacy CBC).
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Cannot decrypt empty text')
  }
  const key = getEncryptionKey()
  if (encryptedText.startsWith(GCM_PREFIX)) {
    return decryptGcm(encryptedText, key)
  }
  return decryptLegacyCbc(encryptedText, key)
}

/**
 * True if value looks like ciphertext we manage (GCM v1 or legacy CBC iv:cipher).
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false
  if (text.startsWith(GCM_PREFIX)) {
    const rest = text.slice(GCM_PREFIX.length)
    const parts = rest.split(':')
    return (
      parts.length === 3 &&
      parts[0].length === GCM_IV_LENGTH * 2 &&
      parts[1].length === GCM_TAG_LENGTH * 2 &&
      parts[2].length > 0
    )
  }
  const parts = text.split(':')
  return parts.length === 2 && parts[0].length === LEGACY_IV_LENGTH * 2 && parts[1].length > 0
}
