import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { createMagicLinkToken } from '@/lib/magic-link'
import {
  checkAuthSecretConfigured,
  checkEmailAllowed,
} from '@/lib/auth'
import { logValidationFailure } from '@/lib/logger'

const RequestLinkSchema = z.object({
  email: z.string().email().max(320),
  from: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = RequestLinkSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      logValidationFailure('/api/auth/request-link', parsed.error)
      return NextResponse.json(
        { success: false, error: 'Invalid input' },
        { status: 400 },
      )
    }

    const { email, from } = parsed.data

    // Check signing secret BEFORE the allowlist so misconfigured deployments
    // surface that error first instead of silently swallowing every login.
    const secretCheck = checkAuthSecretConfigured()
    if (!secretCheck.ok) {
      console.error(secretCheck.logMessage)
      return NextResponse.json(
        { success: false, error: secretCheck.userMessage, code: secretCheck.code },
        { status: 500 },
      )
    }

    const allowlistCheck = checkEmailAllowed(email)
    if (!allowlistCheck.allowed) {
      // NO_ALLOWLIST is a deployment error (Railway), EMAIL_NOT_ALLOWED is a normal user event.
      // Log both, but at different levels so log triage stays useful.
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

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail =
      process.env.APP_AUTH_FROM_EMAIL || 'Meal Planner <no-reply@resend.dev>'

    if (!resendApiKey) {
      console.error('auth-request-link: RESEND_API_KEY not configured')
      return NextResponse.json(
        { success: false, error: 'Email not configured' },
        { status: 500 },
      )
    }

    const origin =
      process.env.APP_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`

    const expiresInMinutes = 30
    const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60

    const token = createMagicLinkToken({
      email,
      from: from || '/',
      exp,
    })

    const verifyUrl = `${origin}/auth/verify?token=${encodeURIComponent(token)}`

    const resend = new Resend(resendApiKey)
    const sendResult = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Your Meal Planner magic link',
      text: `Click to sign in to Meal Planner:\n\n${verifyUrl}\n\nThis link expires in ${expiresInMinutes} minutes.`,
    })

    if (sendResult.error) {
      console.error('auth-request-link: Resend error', sendResult.error.name)
      return NextResponse.json(
        { success: false, error: 'Email could not be sent' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(
      'auth-request-link: internal error',
      error instanceof Error ? error.message : String(error),
    )
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
