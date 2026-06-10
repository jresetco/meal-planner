import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { logValidationFailure } from '@/lib/logger'
import type { MealType } from '@/types'

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER'] as const

const CreatePlannedMealSchema = z.object({
  // ISO date (YYYY-MM-DD or full ISO) for the slot
  date: z.string().min(1).max(40),
  mealType: z.enum(MEAL_TYPES),
  recipeId: z.string().max(200).optional(),
  customName: z.string().max(500).optional(),
  servings: z.number().int().min(1).max(50).optional(),
})

// POST /api/plans/[id]/meals - Create a planned meal in an (empty) slot.
// Used by the plan view to "add a meal back" after a removal. Defaults to a
// blank custom-name placeholder the user then fills via the swap dialog.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the plan belongs to the user's household.
  const plan = await prisma.mealPlan.findFirst({
    where: { id, householdId: session.user.householdId },
    select: { id: true },
  })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const parsed = CreatePlannedMealSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    logValidationFailure('/api/plans/[id]/meals', parsed.error)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { date, mealType, recipeId, customName, servings } = parsed.data

  // Normalize to the same UTC-noon convention the rest of the system uses when
  // persisting planned meals (see plan-meal-validation.ts), so exact-date
  // equality (the duplicate-slot guard below) and day display line up. The
  // client sends a YYYY-MM-DD slot key; tolerate a full ISO string too.
  const dayPart = date.split('T')[0]
  const slotDate = new Date(`${dayPart}T12:00:00.000Z`)
  if (Number.isNaN(slotDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  // Guard against duplicating a slot that already has a meal.
  const existing = await prisma.plannedMeal.findFirst({
    where: { mealPlanId: id, date: slotDate, mealType: mealType as MealType },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A meal already exists in that slot.' },
      { status: 409 }
    )
  }

  const created = await prisma.plannedMeal.create({
    data: {
      mealPlanId: id,
      date: slotDate,
      mealType: mealType as MealType,
      recipeId: recipeId || null,
      customName: recipeId ? null : customName ?? null,
      servings: servings ?? 2,
    },
    include: { recipe: true },
  })

  await prisma.groceryList.updateMany({ where: { mealPlanId: id }, data: { isStale: true } })

  return NextResponse.json(created, { status: 201 })
}
