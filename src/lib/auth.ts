// Simplified auth - no authentication required for now
// Phase 3: Add proper authentication (Google OAuth, etc.)

import { cache } from 'react'
import prisma from '@/lib/db'

// Default household ID for the single-user/household mode
export const DEFAULT_HOUSEHOLD_ID = 'default-household'
export const DEFAULT_USER_ID = 'default-user'

/**
 * Approved email allowlist — comma-separated in ALLOWED_EMAILS env var.
 * When real auth (NextAuth) is added, check this before creating sessions.
 * Returns true if the allowlist is not configured (open access) or if the email is on the list.
 */
export function isEmailAllowed(email: string): boolean {
  const allowlist = process.env.ALLOWED_EMAILS
  if (!allowlist) return true
  const allowed = allowlist.split(',').map(e => e.trim().toLowerCase())
  return allowed.includes(email.trim().toLowerCase())
}

// Track whether default user/household have been verified this process lifetime
let defaultsVerified = false

// Ensure default user and household exist (skips DB check after first successful verification)
async function ensureDefaultUserAndHousehold() {
  if (defaultsVerified) return

  // Check if default household exists
  let household = await prisma.household.findUnique({
    where: { id: DEFAULT_HOUSEHOLD_ID }
  })

  if (!household) {
    // Create default household with meal settings
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
          }
        }
      }
    })
  }

  // Check if default user exists
  let user = await prisma.user.findUnique({
    where: { id: DEFAULT_USER_ID }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: DEFAULT_USER_ID,
        email: 'user@mealplanner.local',
        name: 'Default User',
        householdId: DEFAULT_HOUSEHOLD_ID,
      }
    })
  }

  defaultsVerified = true
  return { user, household }
}

// Mock session for API routes — one Prisma bootstrap per request when called from RSC tree.
async function getSessionUncached() {
  await ensureDefaultUserAndHousehold()

  return {
    user: {
      id: DEFAULT_USER_ID,
      householdId: DEFAULT_HOUSEHOLD_ID,
      email: 'user@mealplanner.local',
      name: 'Default User',
    },
  }
}

export const getSession = cache(getSessionUncached)

// Alias for compatibility
export const auth = getSession
