import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/plans/[id]/meals/[mealId] - Get a specific planned meal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mealId: string }> }
) {
  const session = await auth()
  const { id, mealId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const meal = await prisma.plannedMeal.findFirst({
    where: {
      id: mealId,
      mealPlan: {
        id,
        householdId: session.user.householdId,
      },
    },
    include: {
      recipe: true,
    },
  })

  if (!meal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  return NextResponse.json(meal)
}

// PATCH /api/plans/[id]/meals/[mealId] - Update a planned meal (lock/unlock)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mealId: string }> }
) {
  const session = await auth()
  const { id, mealId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify meal belongs to user's household
  const existingMeal = await prisma.plannedMeal.findFirst({
    where: {
      id: mealId,
      mealPlan: {
        id,
        householdId: session.user.householdId,
      },
    },
  })

  if (!existingMeal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  const body = await request.json()
  const { isLocked, recipeId } = body

  const updateData: { isLocked?: boolean; recipeId?: string } = {}
  
  if (typeof isLocked === 'boolean') {
    updateData.isLocked = isLocked
  }
  
  if (recipeId) {
    updateData.recipeId = recipeId
  }

  const updatedMeal = await prisma.plannedMeal.update({
    where: { id: mealId },
    data: updateData,
    include: {
      recipe: true,
    },
  })

  return NextResponse.json(updatedMeal)
}

// DELETE /api/plans/[id]/meals/[mealId] - Delete a planned meal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mealId: string }> }
) {
  const session = await auth()
  const { id, mealId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify meal belongs to user's household
  const existingMeal = await prisma.plannedMeal.findFirst({
    where: {
      id: mealId,
      mealPlan: {
        id,
        householdId: session.user.householdId,
      },
    },
  })

  if (!existingMeal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  await prisma.plannedMeal.delete({
    where: { id: mealId },
  })

  return NextResponse.json({ success: true })
}
