// Web Crypto based so the same code runs in Edge (middleware) and Node (API routes).

type SessionPayload = {
  sub: string
  iat: number
  exp: number
}

const encodeBase64UrlFromBytes = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

const encodeBase64UrlFromString = (s: string): string =>
  encodeBase64UrlFromBytes(new TextEncoder().encode(s))

const decodeBase64UrlToBytes = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const getSigningSecret = (): string => {
  const secret = process.env.APP_AUTH_SECRET
  if (!secret) throw new Error('Missing required env var: APP_AUTH_SECRET')
  return secret
}

const importHmacKey = async (
  secret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> =>
  globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60

export const createSessionToken = async (
  subject: string = 'user',
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> => {
  const secret = getSigningSecret()
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    sub: subject,
    iat: now,
    exp: now + ttlSeconds,
  }
  const header = { alg: 'HS256', typ: 'JWS' }
  const headerB64 = encodeBase64UrlFromString(JSON.stringify(header))
  const payloadB64 = encodeBase64UrlFromString(JSON.stringify(payload))
  const toSign = `${headerB64}.${payloadB64}`

  const key = await importHmacKey(secret, ['sign'])
  const signatureBuf = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(toSign),
  )
  const signatureB64 = encodeBase64UrlFromBytes(new Uint8Array(signatureBuf))
  return `${toSign}.${signatureB64}`
}

export const verifySessionToken = async (
  token: string | undefined | null,
): Promise<SessionPayload | null> => {
  if (!token) return null
  try {
    const secret = getSigningSecret()
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, signatureB64] = parts
    const toSign = `${headerB64}.${payloadB64}`

    const key = await importHmacKey(secret, ['verify'])
    const signatureBytes = decodeBase64UrlToBytes(signatureB64)
    const sigView = new Uint8Array(signatureBytes.length)
    sigView.set(signatureBytes)
    const ok = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      sigView,
      new TextEncoder().encode(toSign),
    )
    if (!ok) return null

    const payloadJson = new TextDecoder().decode(
      decodeBase64UrlToBytes(payloadB64),
    )
    const payload = JSON.parse(payloadJson) as SessionPayload
    const now = Math.floor(Date.now() / 1000)
    if (!payload.exp || payload.exp < now) return null
    if (!payload.sub) return null
    return payload
  } catch {
    return null
  }
}

export const SESSION_COOKIE_MAX_AGE = DEFAULT_TTL_SECONDS
export const AUTH_COOKIE_NAME = 'meal-planner-auth'
