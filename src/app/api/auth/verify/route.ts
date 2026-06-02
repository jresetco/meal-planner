import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMagicLinkToken } from '@/lib/magic-link'
import {
  createSessionToken,
  SESSION_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
} from '@/lib/session-token'
import {
  checkAuthSecretConfigured,
  checkEmailAllowed,
} from '@/lib/auth'
import { logValidationFailure } from '@/lib/logger'

const VerifySchema = z.object({
  token: z.string().min(1).max(4096),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = VerifySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      logValidationFailure('/api/auth/verify', parsed.error)
      return NextResponse.json(
        { success: false, error: 'Invalid input' },
        { status: 400 },
      )
    }

    // APP_AUTH_SECRET is required to issue session cookies. Check first so the
    // server log makes the misconfiguration obvious before any token work.
    const secretCheck = checkAuthSecretConfigured()
    if (!secretCheck.ok) {
      console.error(secretCheck.logMessage)
      return NextResponse.json(
        { success: false, error: secretCheck.userMessage, code: secretCheck.code },
        { status: 500 },
      )
    }

    const payload = verifyMagicLinkToken(parsed.data.token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 },
      )
    }

    const allowlistCheck = checkEmailAllowed(payload.email)
    if (!allowlistCheck.allowed) {
      // Defense-in-depth: even though request-link checks the allowlist before
      // sending, re-check here in case the allowlist changed between
      // link-issue and link-redeem.
      if (allowlistCheck.code === 'AUTH_NO_ALLOWLIST') {
        console.error(allowlistCheck.logMessage)
      } else {
        console.info(allowlistCheck.logMessage)
      }
      const status = allowlistCheck.code === 'AUTH_NO_ALLOWLIST' ? 500 : 403
      return NextResponse.json(
        {
          success: false,
          error: allowlistCheck.userMessage,
          code: allowlistCheck.code,
        },
        { status },
      )
    }

    const sessionToken = await createSessionToken(payload.email)

    const response = NextResponse.json({
      success: true,
      redirectTo: payload.from || '/',
    })

    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE,
    })

    return response
  } catch (error) {
    console.error(
      'auth-verify: internal error',
      error instanceof Error ? error.message : String(error),
    )
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
