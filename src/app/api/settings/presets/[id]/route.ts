import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

const UpdatePresetSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  maxLeftovers: z.number().int().nonnegative().optional(),
  servingsPerMeal: z.number().int().positive().optional(),
  guaranteedMealIds: z.array(z.string().max(200)).optional(),
  guidelines: z.string().max(10000).nullish(),
  isDefault: z.boolean().optional(),
})

// GET /api/settings/presets/[id] - Get a specific preset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const preset = await prisma.baselinePreset.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!preset) {
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
  }

  return NextResponse.json(preset)
}

// PATCH /api/settings/presets/[id] - Update a preset
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existingPreset = await prisma.baselinePreset.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!existingPreset) {
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
  }

  const parsed = UpdatePresetSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { name, maxLeftovers, servingsPerMeal, guaranteedMealIds, guidelines, isDefault } = parsed.data

  // If setting as default, unset all other defaults
  if (isDefault && !existingPreset.isDefault) {
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

  const updateData: {
    name?: string
    maxLeftovers?: number
    servingsPerMeal?: number
    guaranteedMealIds?: string[]
    guidelines?: string | null
    isDefault?: boolean
  } = {}

  if (name !== undefined) updateData.name = name
  if (maxLeftovers !== undefined) updateData.maxLeftovers = maxLeftovers
  if (servingsPerMeal !== undefined) updateData.servingsPerMeal = servingsPerMeal
  if (guaranteedMealIds !== undefined) updateData.guaranteedMealIds = guaranteedMealIds
  if (guidelines !== undefined) updateData.guidelines = guidelines
  if (isDefault !== undefined) updateData.isDefault = isDefault

  const updatedPreset = await prisma.baselinePreset.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(updatedPreset)
}

// DELETE /api/settings/presets/[id] - Delete a preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existingPreset = await prisma.baselinePreset.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!existingPreset) {
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
  }

  await prisma.baselinePreset.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
