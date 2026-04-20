import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

const CreatePresetSchema = z.object({
  name: z.string().min(1).max(500),
  maxLeftovers: z.number().int().nonnegative().optional(),
  servingsPerMeal: z.number().int().positive().optional(),
  guaranteedMealIds: z.array(z.string().max(200)).optional(),
  guidelines: z.string().max(10000).nullish(),
  isDefault: z.boolean().optional(),
})

// GET /api/settings/presets - Get all baseline presets for household
export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const presets = await prisma.baselinePreset.findMany({
    where: {
      householdId: session.user.householdId,
    },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' },
    ],
  })

  return NextResponse.json(presets)
}

// POST /api/settings/presets - Create a new baseline preset
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = CreatePresetSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { name, maxLeftovers, servingsPerMeal, guaranteedMealIds, guidelines, isDefault } = parsed.data

  // If setting as default, unset all other defaults
  if (isDefault) {
    await prisma.baselinePreset.updateMany({
      where: {
        householdId: session.user.householdId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    })
  }

  const preset = await prisma.baselinePreset.create({
    data: {
      householdId: session.user.householdId,
      name,
      maxLeftovers: maxLeftovers ?? 3,
      servingsPerMeal: servingsPerMeal ?? 4,
      guaranteedMealIds: guaranteedMealIds || [],
      guidelines: guidelines || null,
      isDefault: isDefault ?? false,
    },
  })

  return NextResponse.json(preset, { status: 201 })
}
