import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

const UpdateMealComponentSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  prepMethods: z.array(z.string().max(500)).optional(),
  defaultCookTime: z.number().int().nullish(),
  typicalIngredients: z.array(z.any()).optional(),
  isActive: z.boolean().optional(),
})

// PATCH /api/settings/meal-components/[id] - Update a meal component
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.mealComponent.findFirst({
    where: { id, householdId: session.user.householdId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Component not found' }, { status: 404 })
  }

  const parsed = UpdateMealComponentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { name, prepMethods, defaultCookTime, typicalIngredients, isActive } = parsed.data

  const component = await prisma.mealComponent.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(prepMethods !== undefined ? { prepMethods } : {}),
      ...(defaultCookTime !== undefined ? { defaultCookTime } : {}),
      ...(typicalIngredients !== undefined ? { typicalIngredients } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  })

  return NextResponse.json(component)
}

// DELETE /api/settings/meal-components/[id] - Delete a meal component
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.mealComponent.findFirst({
    where: { id, householdId: session.user.householdId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Component not found' }, { status: 404 })
  }

  await prisma.mealComponent.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
