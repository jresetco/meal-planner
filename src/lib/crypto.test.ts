import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCipheriv, randomBytes } from 'crypto'
import { encrypt, decrypt, isEncrypted, generateEncryptionKey } from './crypto'

const TEST_KEY = 'a'.repeat(64) // deterministic 32-byte hex key for the suite

describe('crypto', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
  })
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  describe('encrypt/decrypt (GCM)', () => {
    it('round-trips a plaintext value', () => {
      const cipher = encrypt('hunter2')
      expect(cipher.startsWith('gcm:v1:')).toBe(true)
      expect(decrypt(cipher)).toBe('hunter2')
    })

    it('round-trips unicode + multi-line payloads', () => {
      const plain = 'pässwörd\nwith newlines 🥬'
      expect(decrypt(encrypt(plain))).toBe(plain)
    })

    it('produces different ciphertext for the same plaintext across calls (random IV)', () => {
      const a = encrypt('same')
      const b = encrypt('same')
      expect(a).not.toBe(b)
      expect(decrypt(a)).toBe('same')
      expect(decrypt(b)).toBe('same')
    })

    it('rejects tampered ciphertext via GCM auth tag', () => {
      const cipher = encrypt('secret')
      // Flip a hex char in the encrypted body (last segment after the last colon)
      const lastColon = cipher.lastIndexOf(':')
      const tampered =
        cipher.slice(0, lastColon + 1) +
        (cipher[lastColon + 1] === '0' ? '1' : '0') +
        cipher.slice(lastColon + 2)
      expect(() => decrypt(tampered)).toThrow()
    })

    it('throws on empty input', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty text')
      expect(() => decrypt('')).toThrow('Cannot decrypt empty text')
    })
  })

  describe('decrypt — legacy AES-256-CBC compatibility', () => {
    it('decrypts a legacy CBC payload produced by an earlier version', () => {
      const keyBuf = Buffer.from(TEST_KEY, 'hex')
      const plaintext = 'legacy-paprika-password'
      const iv = randomBytes(16)
      const cipher = createCipheriv('aes-256-cbc', keyBuf, iv)
      const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const legacyPayload = `${iv.toString('hex')}:${enc.toString('hex')}`

      expect(decrypt(legacyPayload)).toBe(plaintext)
    })
  })

  describe('isEncrypted', () => {
    it('returns true for GCM ciphertext produced by encrypt()', () => {
      expect(isEncrypted(encrypt('x'))).toBe(true)
    })

    it('returns true for a well-formed legacy CBC payload', () => {
      // 16-byte IV hex (32 chars) : non-empty cipher hex
      const fake = `${'ab'.repeat(16)}:${'cd'.repeat(16)}`
      expect(isEncrypted(fake)).toBe(true)
    })

    it('returns false for plain strings', () => {
      expect(isEncrypted('')).toBe(false)
      expect(isEncrypted('not encrypted')).toBe(false)
      expect(isEncrypted('hunter2')).toBe(false)
    })

    it('returns false for malformed GCM headers', () => {
      expect(isEncrypted('gcm:v1:short')).toBe(false)
      expect(isEncrypted('gcm:v1:aa:bb')).toBe(false) // only 2 parts, need 3
    })
  })

  describe('key validation', () => {
    it('throws when ENCRYPTION_KEY is missing', () => {
      delete process.env.ENCRYPTION_KEY
      expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/)
    })

    it('throws when ENCRYPTION_KEY is the wrong length', () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(32) // half the required length
      expect(() => encrypt('x')).toThrow(/64-character hex/)
    })

    it('generateEncryptionKey returns a 64-character hex string', () => {
      const key = generateEncryptionKey()
      expect(key).toHaveLength(64)
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true)
    })
  })
})
