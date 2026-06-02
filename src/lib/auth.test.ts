import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkEmailAllowed,
  checkAuthSecretConfigured,
  AUTH_ERROR_CODES,
} from './auth'

const clearAuthEnv = () => {
  delete process.env.APP_AUTH_EMAIL
  delete process.env.ALLOWED_EMAILS
  delete process.env.APP_AUTH_SECRET
  delete process.env.APP_AUTH_LINK_SECRET
}

describe('checkEmailAllowed', () => {
  beforeEach(clearAuthEnv)
  afterEach(clearAuthEnv)

  describe('fail-closed when no allowlist is configured', () => {
    it('rejects all emails when neither APP_AUTH_EMAIL nor ALLOWED_EMAILS is set', () => {
      const result = checkEmailAllowed('james@example.com')
      expect(result.allowed).toBe(false)
      if (result.allowed) return
      expect(result.code).toBe(AUTH_ERROR_CODES.NO_ALLOWLIST)
      expect(result.logMessage).toMatch(/SIGN-IN BLOCKED/)
      expect(result.logMessage).toMatch(/APP_AUTH_EMAIL.*ALLOWED_EMAILS/)
    })

    it('rejects all emails when ALLOWED_EMAILS is set but empty after trimming', () => {
      process.env.ALLOWED_EMAILS = '  ,  ,  '
      const result = checkEmailAllowed('james@example.com')
      expect(result.allowed).toBe(false)
      if (result.allowed) return
      expect(result.code).toBe(AUTH_ERROR_CODES.NO_ALLOWLIST)
      expect(result.logMessage).toMatch(/empty after trimming/)
    })

    it('rejects all emails when ALLOWED_EMAILS is just whitespace', () => {
      process.env.ALLOWED_EMAILS = '   '
      const result = checkEmailAllowed('james@example.com')
      expect(result.allowed).toBe(false)
    })

    it('uses a user-facing message that does NOT leak the env var names', () => {
      const result = checkEmailAllowed('james@example.com')
      if (result.allowed) throw new Error('expected denied')
      expect(result.userMessage).not.toMatch(/APP_AUTH_EMAIL/)
      expect(result.userMessage).not.toMatch(/ALLOWED_EMAILS/)
      expect(result.userMessage).toMatch(/administrator/)
    })
  })

  describe('APP_AUTH_EMAIL (single-email mode)', () => {
    it('allows the configured email', () => {
      process.env.APP_AUTH_EMAIL = 'james@example.com'
      expect(checkEmailAllowed('james@example.com').allowed).toBe(true)
    })

    it('matches case-insensitively', () => {
      process.env.APP_AUTH_EMAIL = 'James@Example.COM'
      expect(checkEmailAllowed('james@example.com').allowed).toBe(true)
      expect(checkEmailAllowed('JAMES@EXAMPLE.COM').allowed).toBe(true)
    })

    it('trims whitespace on both env and input', () => {
      process.env.APP_AUTH_EMAIL = '  james@example.com  '
      expect(checkEmailAllowed('  james@example.com  ').allowed).toBe(true)
    })

    it('rejects a non-matching email with EMAIL_NOT_ALLOWED code', () => {
      process.env.APP_AUTH_EMAIL = 'james@example.com'
      const result = checkEmailAllowed('intruder@example.com')
      expect(result.allowed).toBe(false)
      if (result.allowed) return
      expect(result.code).toBe(AUTH_ERROR_CODES.EMAIL_NOT_ALLOWED)
      expect(result.logMessage).toMatch(/intruder@example\.com/)
      expect(result.logMessage).toMatch(/APP_AUTH_EMAIL/)
    })

    it('takes precedence over ALLOWED_EMAILS when both are set', () => {
      process.env.APP_AUTH_EMAIL = 'james@example.com'
      process.env.ALLOWED_EMAILS = 'someone-else@example.com'
      // james@ matches APP_AUTH_EMAIL (allowed) but ALLOWED_EMAILS would
      // reject — confirming APP_AUTH_EMAIL alone decides.
      expect(checkEmailAllowed('james@example.com').allowed).toBe(true)
      // someone-else@ would be allowed by ALLOWED_EMAILS, but APP_AUTH_EMAIL
      // is what's checked, so it's rejected.
      expect(checkEmailAllowed('someone-else@example.com').allowed).toBe(false)
    })
  })

  describe('ALLOWED_EMAILS (multi-email mode)', () => {
    it('allows any email in the list', () => {
      process.env.ALLOWED_EMAILS = 'a@example.com,b@example.com,c@example.com'
      expect(checkEmailAllowed('a@example.com').allowed).toBe(true)
      expect(checkEmailAllowed('b@example.com').allowed).toBe(true)
      expect(checkEmailAllowed('c@example.com').allowed).toBe(true)
    })

    it('matches case-insensitively', () => {
      process.env.ALLOWED_EMAILS = 'James@Example.COM,Wife@Example.Com'
      expect(checkEmailAllowed('james@example.com').allowed).toBe(true)
      expect(checkEmailAllowed('WIFE@EXAMPLE.COM').allowed).toBe(true)
    })

    it('trims whitespace around each entry', () => {
      process.env.ALLOWED_EMAILS = '  james@example.com  ,  wife@example.com  '
      expect(checkEmailAllowed('james@example.com').allowed).toBe(true)
      expect(checkEmailAllowed('wife@example.com').allowed).toBe(true)
    })

    it('rejects emails not in the list with EMAIL_NOT_ALLOWED code', () => {
      process.env.ALLOWED_EMAILS = 'james@example.com,wife@example.com'
      const result = checkEmailAllowed('intruder@example.com')
      expect(result.allowed).toBe(false)
      if (result.allowed) return
      expect(result.code).toBe(AUTH_ERROR_CODES.EMAIL_NOT_ALLOWED)
      expect(result.logMessage).toMatch(/intruder@example\.com/)
      expect(result.logMessage).toMatch(/2 entries/)
    })

    it('drops empty entries from the list', () => {
      process.env.ALLOWED_EMAILS = 'james@example.com,,,wife@example.com,'
      const result = checkEmailAllowed('intruder@example.com')
      expect(result.allowed).toBe(false)
      if (result.allowed) return
      expect(result.logMessage).toMatch(/2 entries/)
    })
  })

  describe('error message clarity (for log triage)', () => {
    it('distinguishes "no allowlist" (deployment error) from "not on allowlist" (user event) via different codes', () => {
      const noConfig = checkEmailAllowed('a@b.com')
      process.env.ALLOWED_EMAILS = 'allowed@example.com'
      const wrongEmail = checkEmailAllowed('a@b.com')

      if (noConfig.allowed || wrongEmail.allowed) {
        throw new Error('expected both to be denied')
      }
      expect(noConfig.code).not.toBe(wrongEmail.code)
      expect(noConfig.code).toBe(AUTH_ERROR_CODES.NO_ALLOWLIST)
      expect(wrongEmail.code).toBe(AUTH_ERROR_CODES.EMAIL_NOT_ALLOWED)
    })
  })
})

describe('checkAuthSecretConfigured', () => {
  beforeEach(clearAuthEnv)
  afterEach(clearAuthEnv)

  it('returns ok when APP_AUTH_SECRET is set', () => {
    process.env.APP_AUTH_SECRET = 'a'.repeat(32)
    expect(checkAuthSecretConfigured()).toEqual({ ok: true })
  })

  it('returns ok when only APP_AUTH_LINK_SECRET is set (link secret falls back to auth secret)', () => {
    process.env.APP_AUTH_LINK_SECRET = 'a'.repeat(32)
    expect(checkAuthSecretConfigured()).toEqual({ ok: true })
  })

  it('returns a structured error when neither secret is set', () => {
    const result = checkAuthSecretConfigured()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe(AUTH_ERROR_CODES.SECRET_NOT_CONFIGURED)
    expect(result.logMessage).toMatch(/openssl rand -hex 32/)
    expect(result.userMessage).toMatch(/administrator/)
  })
})
