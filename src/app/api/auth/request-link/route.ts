import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { createMagicLinkToken } from '@/lib/magic-link'

const RequestLinkSchema = z.object({
  email: z.string().email().max(320),
  from: z.string().max(500).optional(),
})

function isEmailAllowed(email: string): boolean {
  const single = process.env.APP_AUTH_EMAIL || ''
  const multi = process.env.ALLOWED_EMAILS || ''
  const normalized = email.toLowerCase().trim()

  if (single) {
    return normalized === single.toLowerCase().trim()
  }
  if (multi) {
    const list = multi.split(',').map((e) => e.trim().toLowerCase())
    return list.includes(normalized)
  }
  return true
}

function hasSigningSecret(): boolean {
  return Boolean(process.env.APP_AUTH_LINK_SECRET || process.env.APP_AUTH_SECRET)
}

export async function POST(request: NextRequest) {
  try {
    const parsed = RequestLinkSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input' },
        { status: 400 },
      )
    }

    const { email, from } = parsed.data

    if (!isEmailAllowed(email)) {
      return NextResponse.json(
        { success: false, error: 'Email not allowed' },
        { status: 403 },
      )
    }

    if (!hasSigningSecret()) {
      console.error('auth-request-link: APP_AUTH_SECRET not configured')
      return NextResponse.json(
        { success: false, error: 'Sign-in is not fully configured' },
        { status: 500 },
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
