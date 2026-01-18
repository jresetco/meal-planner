import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * Encryption utility for sensitive data
 * Uses AES-256-CBC encryption
 */

const ALGORITHM = 'aes-256-cbc'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits

/**
 * Get encryption key from environment variable
 * The key should be a 32-byte hex string (64 characters)
 */
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

/**
 * Generate a random encryption key (for setup)
 * Run this once and store the output in your environment variables
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Encrypt a string
 * Returns: IV:EncryptedData (both in hex format)
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty text')
  }
  
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ])
  
  // Return IV:EncryptedData format
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

/**
 * Decrypt a string
 * Expects format: IV:EncryptedData (both in hex format)
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Cannot decrypt empty text')
  }
  
  const parts = encryptedText.split(':')
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format')
  }
  
  const key = getEncryptionKey()
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = Buffer.from(parts[1], 'hex')
  
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])
  
  return decrypted.toString('utf8')
}

/**
 * Check if a string is encrypted (has IV:Data format)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false
  const parts = text.split(':')
  return parts.length === 2 && parts[0].length === 32 && parts[1].length > 0
}
