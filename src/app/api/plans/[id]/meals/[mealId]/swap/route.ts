import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateMealPlan } from '@/lib/ai/meal-planner'

// POST /api/plans/[id]/meals/[mealId]/swap - Swap a meal with a new recipe suggestion
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mealId: string }> }
) {
  const session = await auth()
  const { id, mealId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the existing meal
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
      mealPlan: {
        include: {
          plannedMeals: {
            include: { recipe: true },
          },
        },
      },
    },
  })

  if (!existingMeal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  if (existingMeal.isLocked) {
    return NextResponse.json(
      { error: 'Cannot swap a locked meal' },
      { status: 400 }
    )
  }

  // Get all recipes that could replace this meal
  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: session.user.householdId,
      isActive: true,
      OR: [
        { categories: { has: existingMeal.mealType } },
        { categories: { isEmpty: true } },
      ],
    },
    select: {
      id: true,
      name: true,
      categories: true,
    },
  })

  if (recipes.length === 0) {
    return NextResponse.json(
      { error: 'No alternative recipes available' },
      { status: 400 }
    )
  }

  // Get IDs of recipes already used in this plan (excluding the current one)
  const usedRecipeIds = new Set(
    existingMeal.mealPlan.plannedMeals
      .filter(m => m.id !== mealId && m.recipeId)
      .map(m => m.recipeId)
  )

  // Filter to recipes not heavily used
  const availableRecipes = recipes.filter(r => !usedRecipeIds.has(r.id))
  
  // If all recipes are used, just pick any one that's different from current
  const candidateRecipes = availableRecipes.length > 0 
    ? availableRecipes 
    : recipes.filter(r => r.id !== existingMeal.recipeId)

  if (candidateRecipes.length === 0) {
    return NextResponse.json(
      { error: 'No alternative recipes available' },
      { status: 400 }
    )
  }

  // Pick a random recipe from candidates
  const randomIndex = Math.floor(Math.random() * candidateRecipes.length)
  const newRecipe = candidateRecipes[randomIndex]

  // Update the meal with new recipe
  const updatedMeal = await prisma.plannedMeal.update({
    where: { id: mealId },
    data: {
      recipeId: newRecipe.id,
      isLeftover: false, // Reset leftover status
    },
    include: {
      recipe: true,
    },
  })

  // Invalidate the grocery list since meals changed
  await prisma.groceryList.deleteMany({
    where: { mealPlanId: id },
  })

  return NextResponse.json(updatedMeal)
}
