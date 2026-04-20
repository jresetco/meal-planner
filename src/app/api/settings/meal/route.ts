import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import type { MealSettings } from '@prisma/client'

const UpdateMealSettingsSchema = z.object({
  breakfastTime: z.string().max(50).optional(),
  lunchTime: z.string().max(50).optional(),
  dinnerTime: z.string().max(50).optional(),
  breakfastEnabled: z.boolean().optional(),
  lunchEnabled: z.boolean().optional(),
  dinnerEnabled: z.boolean().optional(),
  defaultServings: z.number().int().positive().optional(),
  defaultMaxRepeats: z.number().int().nonnegative().optional(),
  maxLeftoversPerWeek: z.number().int().nonnegative().optional(),
  paprikaEmail: z.string().max(500).nullish(),
  paprikaPassword: z.string().max(500).optional(),
  paprikaClearPassword: z.boolean().optional(),
  paprikaCategories: z.array(z.string().max(500)).optional(),
  paprikaMinRating: z.number().nullish(),
})

function sanitizeMealSettingsResponse(settings: MealSettings) {
  const { paprikaPassword: _removed, ...rest } = settings
  return {
    ...rest,
    paprikaPasswordConfigured: Boolean(settings.paprikaPassword?.length),
  }
}

// GET /api/settings/meal - Get meal settings (never returns Paprika password plaintext)
export async function GET(_request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let settings = await prisma.mealSettings.findUnique({
    where: { householdId: session.user.householdId },
  })

  if (!settings) {
    settings = await prisma.mealSettings.create({
      data: {
        householdId: session.user.householdId,
      },
    })
  }

  return NextResponse.json(sanitizeMealSettingsResponse(settings))
}

// PATCH /api/settings/meal - Update meal settings
export async function PATCH(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = UpdateMealSettingsSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const {
    breakfastTime,
    lunchTime,
    dinnerTime,
    breakfastEnabled,
    lunchEnabled,
    dinnerEnabled,
    defaultServings,
    defaultMaxRepeats,
    maxLeftoversPerWeek,
    paprikaEmail,
    paprikaPassword,
    paprikaClearPassword,
    paprikaCategories,
    paprikaMinRating,
  } = parsed.data

  const existingSettings = await prisma.mealSettings.findUnique({
    where: { householdId: session.user.householdId },
  })

  const updateData: Record<string, unknown> = {}

  if (breakfastTime !== undefined) updateData.breakfastTime = breakfastTime
  if (lunchTime !== undefined) updateData.lunchTime = lunchTime
  if (dinnerTime !== undefined) updateData.dinnerTime = dinnerTime
  if (breakfastEnabled !== undefined) updateData.breakfastEnabled = breakfastEnabled
  if (lunchEnabled !== undefined) updateData.lunchEnabled = lunchEnabled
  if (dinnerEnabled !== undefined) updateData.dinnerEnabled = dinnerEnabled
  if (defaultServings !== undefined) updateData.defaultServings = defaultServings
  if (defaultMaxRepeats !== undefined) updateData.defaultMaxRepeats = defaultMaxRepeats
  if (maxLeftoversPerWeek !== undefined) updateData.maxLeftoversPerWeek = maxLeftoversPerWeek
  if (paprikaEmail !== undefined) updateData.paprikaEmail = paprikaEmail

  if (paprikaClearPassword === true) {
    updateData.paprikaPassword = null
  } else if (paprikaPassword !== undefined) {
    const trimmed = typeof paprikaPassword === 'string' ? paprikaPassword.trim() : ''
    if (trimmed.length > 0) {
      updateData.paprikaPassword = encrypt(trimmed)
    }
  }

  if (paprikaCategories !== undefined) updateData.paprikaCategories = paprikaCategories
  if (paprikaMinRating !== undefined) updateData.paprikaMinRating = paprikaMinRating

  let settings: MealSettings
  if (existingSettings) {
    settings = await prisma.mealSettings.update({
      where: { householdId: session.user.householdId },
      data: updateData,
    })
  } else {
    settings = await prisma.mealSettings.create({
      data: {
        householdId: session.user.householdId,
        ...updateData,
      },
    })
  }

  return NextResponse.json(sanitizeMealSettingsResponse(settings))
}
