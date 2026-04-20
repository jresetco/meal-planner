import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyMagicLinkToken } from '@/lib/magic-link'
import {
  createSessionToken,
  SESSION_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
} from '@/lib/session-token'

const VerifySchema = z.object({
  token: z.string().min(1).max(4096),
})

function isEmailAllowed(email: string): boolean {
  const single = process.env.APP_AUTH_EMAIL || ''
  const multi = process.env.ALLOWED_EMAILS || ''
  const normalized = email.toLowerCase().trim()
  if (single) return normalized === single.toLowerCase().trim()
  if (multi) {
    const list = multi.split(',').map((e) => e.trim().toLowerCase())
    return list.includes(normalized)
  }
  return true
}

export async function POST(request: NextRequest) {
  try {
    const parsed = VerifySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input' },
        { status: 400 },
      )
    }

    const payload = verifyMagicLinkToken(parsed.data.token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 },
      )
    }

    if (!isEmailAllowed(payload.email)) {
      return NextResponse.json(
        { success: false, error: 'Email not allowed' },
        { status: 403 },
      )
    }

    if (!process.env.APP_AUTH_SECRET) {
      console.error('auth-verify: APP_AUTH_SECRET not configured')
      return NextResponse.json(
        { success: false, error: 'Auth not configured' },
        { status: 500 },
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
