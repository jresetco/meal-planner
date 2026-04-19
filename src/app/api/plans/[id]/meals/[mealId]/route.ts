import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { isRecipeAlreadyOnDate, ymd } from '@/lib/plan-meal-slots'

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
    include: {
      recipe: true,
    },
  })

  if (!existingMeal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  const body = await request.json()
  const {
    isLocked,
    recipeId,
    customName,
    notes,
    servings,
    preparedServings,
    isLeftover,
    leftoverSourceId,
  } = body as {
    isLocked?: boolean
    recipeId?: string | null
    customName?: string | null
    notes?: string | null
    servings?: number
    preparedServings?: number | null
    isLeftover?: boolean
    leftoverSourceId?: string | null
  }

  const updateData: Prisma.PlannedMealUncheckedUpdateInput = {}
  
  if (typeof isLocked === 'boolean') {
    updateData.isLocked = isLocked
    
    // Track lock/unlock for AI learning
    await prisma.mealEditHistory.create({
      data: {
        householdId: session.user.householdId,
        mealPlanId: id,
        editType: isLocked ? 'LOCK' : 'UNLOCK',
        date: existingMeal.date,
        mealType: existingMeal.mealType,
        originalRecipeId: existingMeal.recipeId,
        originalRecipeName: existingMeal.recipe?.name || existingMeal.customName,
        aiGenerated: true,
      },
    })
  }
  
  if (recipeId !== undefined) {
    if (typeof recipeId === 'string' && recipeId.length > 0) {
      const sameDay = await prisma.plannedMeal.findMany({
        where: { mealPlanId: id, date: existingMeal.date },
        select: { id: true, date: true, recipeId: true },
      })
      if (isRecipeAlreadyOnDate(sameDay, ymd(existingMeal.date), recipeId, mealId)) {
        return NextResponse.json(
          { error: 'That recipe is already on this day.' },
          { status: 400 }
        )
      }
    }
    updateData.recipeId = recipeId
  }
  if (customName !== undefined) {
    updateData.customName = customName
  }
  if (notes !== undefined) {
    updateData.notes = notes === '' ? null : String(notes).slice(0, 2000)
  }
  if (typeof servings === 'number' && Number.isFinite(servings) && servings >= 1) {
    updateData.servings = Math.round(servings)
  }
  if (preparedServings !== undefined) {
    if (preparedServings === null) {
      updateData.preparedServings = null
    } else if (typeof preparedServings === 'number' && Number.isFinite(preparedServings) && preparedServings >= 1) {
      updateData.preparedServings = Math.round(preparedServings)
    }
  }
  if (typeof isLeftover === 'boolean') {
    updateData.isLeftover = isLeftover
  }
  if (leftoverSourceId !== undefined) {
    updateData.leftoverSourceId = leftoverSourceId
  }

  const updatedMeal = await prisma.plannedMeal.update({
    where: { id: mealId },
    data: updateData,
    include: {
      recipe: true,
    },
  })

  // Invalidate cached grocery list when meal content changes
  if (recipeId !== undefined || customName !== undefined || isLeftover !== undefined || leftoverSourceId !== undefined) {
    await prisma.groceryList.deleteMany({ where: { mealPlanId: id } })
  }

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
    include: {
      recipe: true,
    },
  })

  if (!existingMeal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  // Track delete for AI learning
  await prisma.mealEditHistory.create({
    data: {
      householdId: session.user.householdId,
      mealPlanId: id,
      editType: 'DELETE',
      date: existingMeal.date,
      mealType: existingMeal.mealType,
      originalRecipeId: existingMeal.recipeId,
      originalRecipeName: existingMeal.recipe?.name || existingMeal.customName,
      aiGenerated: true,
    },
  })

  await prisma.plannedMeal.delete({
    where: { id: mealId },
  })

  await prisma.groceryList.deleteMany({ where: { mealPlanId: id } })

  return NextResponse.json({ success: true })
}
