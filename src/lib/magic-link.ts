import crypto from 'crypto'

type MagicLinkPayload = {
  email: string
  from?: string
  exp: number
}

const encodeBase64Url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const decodeBase64Url = (input: string) => {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(normalized, 'base64')
}

const getSigningSecret = (): string => {
  const linkSecret = process.env.APP_AUTH_LINK_SECRET
  const authSecret = process.env.APP_AUTH_SECRET
  if (linkSecret) return linkSecret
  if (authSecret) return authSecret
  throw new Error(
    'Missing required env var: set APP_AUTH_LINK_SECRET or APP_AUTH_SECRET',
  )
}

export const createMagicLinkToken = (payload: MagicLinkPayload): string => {
  const secret = getSigningSecret()
  const header = { alg: 'HS256', typ: 'JWS' }
  const headerB64 = encodeBase64Url(Buffer.from(JSON.stringify(header)))
  const payloadB64 = encodeBase64Url(Buffer.from(JSON.stringify(payload)))
  const toSign = `${headerB64}.${payloadB64}`
  const signature = crypto.createHmac('sha256', secret).update(toSign).digest()
  const signatureB64 = encodeBase64Url(signature)
  return `${toSign}.${signatureB64}`
}

export const verifyMagicLinkToken = (
  token: string,
): MagicLinkPayload | null => {
  try {
    const secret = getSigningSecret()
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, signatureB64] = parts
    const toSign = `${headerB64}.${payloadB64}`

    const expected = crypto.createHmac('sha256', secret).update(toSign).digest()
    const actual = decodeBase64Url(signatureB64)

    if (
      expected.length !== actual.length ||
      !crypto.timingSafeEqual(expected, actual)
    ) {
      return null
    }

    const payloadJson = decodeBase64Url(payloadB64).toString('utf8')
    const payload = JSON.parse(payloadJson) as MagicLinkPayload

    const now = Math.floor(Date.now() / 1000)
    if (!payload.exp || payload.exp < now) return null
    if (!payload.email) return null

    return payload
  } catch {
    return null
  }
}
