import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto'

// GET /api/settings/meal - Get meal settings
export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let settings = await prisma.mealSettings.findUnique({
    where: { householdId: session.user.householdId },
  })

  // Create default settings if they don't exist
  if (!settings) {
    settings = await prisma.mealSettings.create({
      data: {
        householdId: session.user.householdId,
      },
    })
  }

  // Decrypt password if it exists and is encrypted
  if (settings.paprikaPassword && isEncrypted(settings.paprikaPassword)) {
    return NextResponse.json({
      ...settings,
      paprikaPassword: decrypt(settings.paprikaPassword),
    })
  }

  return NextResponse.json(settings)
}

// PATCH /api/settings/meal - Update meal settings
export async function PATCH(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  
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
    paprikaCategories,
  } = body

  // Check if settings exist
  const existingSettings = await prisma.mealSettings.findUnique({
    where: { householdId: session.user.householdId },
  })

  const updateData: any = {}
  
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
  if (paprikaPassword !== undefined) updateData.paprikaPassword = encrypt(paprikaPassword)
  if (paprikaCategories !== undefined) updateData.paprikaCategories = paprikaCategories

  let settings
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

  return NextResponse.json(settings)
}
