// Single-user auth: magic-link session cookie gates access, and all authenticated
// requests resolve to the one default household. The middleware enforces the gate
// at the edge; this module is the defense-in-depth check inside API/RSC code.

import { cache } from 'react'
import { cookies } from 'next/headers'
import prisma from '@/lib/db'
import { verifySessionToken, AUTH_COOKIE_NAME } from '@/lib/session-token'

export const DEFAULT_HOUSEHOLD_ID = 'default-household'
export const DEFAULT_USER_ID = 'default-user'

/** When APP_AUTH_SECRET is unset we are in legacy mock mode (local dev only). */
function isMockAuthMode(): boolean {
  return !process.env.APP_AUTH_SECRET
}

/** Whether single-tenant behavior is active (every authorized request gets the default household). */
export function isSingleUserModeEnabled(): boolean {
  return process.env.APP_SINGLE_USER !== 'false'
}

/**
 * Approved email allowlist. Prefers APP_AUTH_EMAIL (single email, matches job-hunter pattern),
 * falls back to ALLOWED_EMAILS (comma-separated, legacy meal-planner pattern).
 * Returns true when no allowlist is configured (open access).
 */
export function isEmailAllowed(email: string): boolean {
  const single = process.env.APP_AUTH_EMAIL
  if (single) return email.trim().toLowerCase() === single.trim().toLowerCase()
  const multi = process.env.ALLOWED_EMAILS
  if (!multi) return true
  const allowed = multi.split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email.trim().toLowerCase())
}

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
  if (!isSingleUserModeEnabled()) {
    return null
  }

  let email = 'user@mealplanner.local'

  if (isMockAuthMode()) {
    // Local dev without APP_AUTH_SECRET — keep the old mock so `npm run dev` just works.
  } else {
    const store = await cookies()
    const token = store.get(AUTH_COOKIE_NAME)?.value
    const payload = await verifySessionToken(token)
    if (!payload) return null
    email = payload.sub
  }

  await ensureDefaultUserAndHousehold()

  return {
    user: {
      id: DEFAULT_USER_ID,
      householdId: DEFAULT_HOUSEHOLD_ID,
      email,
      name: 'Default User',
    },
  }
}

export const getSession = cache(getSessionUncached)
export const auth = getSession
