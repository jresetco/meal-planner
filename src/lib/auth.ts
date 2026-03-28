// Simplified auth - no authentication required for now
// Phase 3: Add proper authentication (Google OAuth, etc.)

import { cache } from 'react'
import prisma from '@/lib/db'

// Default household ID for the single-user/household mode
export const DEFAULT_HOUSEHOLD_ID = 'default-household'
export const DEFAULT_USER_ID = 'default-user'

// Ensure default user and household exist
async function ensureDefaultUserAndHousehold() {
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
