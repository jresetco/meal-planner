// Single-user auth: magic-link session cookie gates access, and all authenticated
// requests resolve to the one default household. The middleware enforces the gate
// at the edge; this module is the defense-in-depth check inside API/RSC code.
//
// Fail-CLOSED: missing APP_AUTH_SECRET or missing allowlist = no sign-in allowed.

import { cache } from 'react'
import { cookies } from 'next/headers'
import prisma from '@/lib/db'
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/session-token'

export const DEFAULT_HOUSEHOLD_ID = 'default-household'
export const DEFAULT_USER_ID = 'default-user'

// ---------------------------------------------------------------------------
// Auth error codes
// ---------------------------------------------------------------------------
// Distinct codes so logs and responses can disambiguate misconfiguration from
// "email not on the list". Misconfiguration must be loud in Railway logs; an
// individual user being rejected is a normal event.

export const AUTH_ERROR_CODES = {
  NO_ALLOWLIST: 'AUTH_NO_ALLOWLIST',
  EMAIL_NOT_ALLOWED: 'AUTH_EMAIL_NOT_ALLOWED',
  SECRET_NOT_CONFIGURED: 'AUTH_SECRET_NOT_CONFIGURED',
} as const
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]

const NO_ALLOWLIST_USER_MSG =
  'Sign-in is not configured for this deployment. The administrator must configure an email allowlist before anyone can sign in.'
const EMAIL_NOT_ALLOWED_USER_MSG =
  "This email isn't authorized for this app. If you believe this is an error, contact the administrator."
const SECRET_NOT_CONFIGURED_USER_MSG =
  'Sign-in is not fully configured for this deployment. The administrator must set APP_AUTH_SECRET.'

export type AllowlistCheck =
  | { allowed: true }
  | {
      allowed: false
      code: typeof AUTH_ERROR_CODES.NO_ALLOWLIST
      userMessage: string
      logMessage: string
    }
  | {
      allowed: false
      code: typeof AUTH_ERROR_CODES.EMAIL_NOT_ALLOWED
      userMessage: string
      logMessage: string
    }

/**
 * Check whether an email is allowed to sign in.
 *
 * Fail-CLOSED: when neither APP_AUTH_EMAIL nor ALLOWED_EMAILS is set, no
 * sign-in is permitted. The previous behavior (return true → "open access")
 * was a footgun on Railway, where forgetting to set the env var would silently
 * allow anyone to sign in.
 *
 * APP_AUTH_EMAIL takes precedence over ALLOWED_EMAILS when both are set, to
 * match the convention used in other apps the user runs.
 */
export function checkEmailAllowed(email: string): AllowlistCheck {
  const normalized = email.trim().toLowerCase()
  const single = process.env.APP_AUTH_EMAIL?.trim()
  const multiRaw = process.env.ALLOWED_EMAILS?.trim()

  if (!single && !multiRaw) {
    return {
      allowed: false,
      code: AUTH_ERROR_CODES.NO_ALLOWLIST,
      userMessage: NO_ALLOWLIST_USER_MSG,
      logMessage:
        'auth: SIGN-IN BLOCKED — no allowlist configured. Set APP_AUTH_EMAIL (single email) or ALLOWED_EMAILS (comma-separated) on this deployment to enable sign-in.',
    }
  }

  if (single) {
    if (normalized === single.toLowerCase()) {
      return { allowed: true }
    }
    return {
      allowed: false,
      code: AUTH_ERROR_CODES.EMAIL_NOT_ALLOWED,
      userMessage: EMAIL_NOT_ALLOWED_USER_MSG,
      logMessage: `auth: sign-in rejected — ${normalized} does not match APP_AUTH_EMAIL allowlist`,
    }
  }

  const list = (multiRaw ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (list.length === 0) {
    return {
      allowed: false,
      code: AUTH_ERROR_CODES.NO_ALLOWLIST,
      userMessage: NO_ALLOWLIST_USER_MSG,
      logMessage:
        'auth: SIGN-IN BLOCKED — ALLOWED_EMAILS is set but empty after trimming. Configure it with at least one comma-separated email.',
    }
  }

  if (list.includes(normalized)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    code: AUTH_ERROR_CODES.EMAIL_NOT_ALLOWED,
    userMessage: EMAIL_NOT_ALLOWED_USER_MSG,
    logMessage: `auth: sign-in rejected — ${normalized} not in ALLOWED_EMAILS (${list.length} entries)`,
  }
}

/**
 * Check whether the magic-link signing infrastructure is fully configured.
 * Returns ok when ready, or a structured error when not.
 */
export function checkAuthSecretConfigured():
  | { ok: true }
  | {
      ok: false
      code: typeof AUTH_ERROR_CODES.SECRET_NOT_CONFIGURED
      userMessage: string
      logMessage: string
    } {
  const linkSecret = process.env.APP_AUTH_LINK_SECRET
  const authSecret = process.env.APP_AUTH_SECRET
  if (linkSecret || authSecret) return { ok: true }
  return {
    ok: false,
    code: AUTH_ERROR_CODES.SECRET_NOT_CONFIGURED,
    userMessage: SECRET_NOT_CONFIGURED_USER_MSG,
    logMessage:
      'auth: SIGN-IN BLOCKED — APP_AUTH_SECRET is not set. Generate one with `openssl rand -hex 32` and set it in the deployment environment.',
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

let defaultsVerified = false

async function ensureDefaultUserAndHousehold() {
  if (defaultsVerified) return

  let household = await prisma.household.findUnique({
    where: { id: DEFAULT_HOUSEHOLD_ID },
  })

  if (!household) {
    household = await prisma.household.create({
      data: {
        id: DEFAULT_HOUSEHOLD_ID,
        name: 'My Household',
        mealSettings: {
          create: {
            breakfastEnabled: true,
            lunchEnabled: true,
            dinnerEnabled: true,
            defaultServings: 2,
            defaultMaxRepeats: 2,
          },
        },
      },
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: DEFAULT_USER_ID },
  })

  if (!user) {
    await prisma.user.create({
      data: {
        id: DEFAULT_USER_ID,
        email: 'user@mealplanner.local',
        name: 'Default User',
        householdId: DEFAULT_HOUSEHOLD_ID,
      },
    })
  }

  defaultsVerified = true
}

export interface Session {
  user: {
    id: string
    householdId: string
    email: string
    name: string
  }
}

async function getSessionUncached(): Promise<Session | null> {
  // Fail-CLOSED: no signing secret means no session can ever be valid.
  if (!process.env.APP_AUTH_SECRET) return null

  const store = await cookies()
  const token = store.get(AUTH_COOKIE_NAME)?.value
  const payload = await verifySessionToken(token)
  if (!payload) return null

  await ensureDefaultUserAndHousehold()

  return {
    user: {
      id: DEFAULT_USER_ID,
      householdId: DEFAULT_HOUSEHOLD_ID,
      email: payload.sub,
      name: 'Default User',
    },
  }
}

export const getSession = cache(getSessionUncached)
export const auth = getSession
