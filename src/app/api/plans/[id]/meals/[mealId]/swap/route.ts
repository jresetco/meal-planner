import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getSuggestionsForSlot, type RecipeForPlanning } from '@/lib/ai/meal-planner'
import type { MealType, RecipeType, MaxFrequency } from '@/types'

// POST /api/plans/[id]/meals/[mealId]/swap - Get AI suggestions for swapping a meal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mealId: string }> }
) {
  const session = await auth()
  const { id: planId, mealId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the meal and verify ownership
  const meal = await prisma.plannedMeal.findFirst({
    where: {
      id: mealId,
      mealPlan: {
        id: planId,
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

  if (!meal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  // Get body for optional parameters
  const body = await request.json().catch(() => ({}))
  const { recipeId } = body

  // If a specific recipe ID is provided, swap directly
  if (recipeId) {
    // Record the edit for learning
    await prisma.mealEditHistory.create({
      data: {
        householdId: session.user.householdId,
        mealPlanId: planId,
        editType: 'SWAP',
        date: meal.date,
        mealType: meal.mealType,
        originalRecipeId: meal.recipeId,
        originalRecipeName: meal.recipe?.name || meal.customName,
        newRecipeId: recipeId,
        aiGenerated: true,
      },
    })

    // Update the meal
    const newRecipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, name: true, imageUrl: true },
    })

    const updatedMeal = await prisma.plannedMeal.update({
      where: { id: mealId },
      data: {
        recipeId,
        customName: null,
        isLeftover: false,
        leftoverSourceId: null,
      },
      include: { recipe: true },
    })

    return NextResponse.json({
      success: true,
      meal: updatedMeal,
    })
  }

  // Otherwise, get AI suggestions
  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: session.user.householdId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      servings: true,
      rating: true,
      categories: true,
      prepTime: true,
      cookTime: true,
      recipeType: true,
      maxFrequency: true,
    },
  })

  const recipesForPlanning: RecipeForPlanning[] = recipes.map(r => ({
    ...r,
    recipeType: (r.recipeType || 'REGULAR') as RecipeType,
    maxFrequency: (r.maxFrequency || 'WEEKLY') as MaxFrequency,
  }))

  const currentPlan = {
    meals: meal.mealPlan.plannedMeals.map(m => ({
      date: m.date.toISOString().split('T')[0],
      mealType: m.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER',
      recipeId: m.recipeId,
      recipeName: m.recipe?.name || m.customName || 'Unknown',
      isLeftover: m.isLeftover,
      leftoverFromDate: null,
      leftoverFromMealType: null,
      servings: m.servings,
      servingsUsed: m.servings,
      notes: m.notes,
    })),
  }

  const suggestions = await getSuggestionsForSlot({
    date: meal.date.toISOString().split('T')[0],
    mealType: meal.mealType as MealType,
    currentPlan,
    recipes: recipesForPlanning,
    count: 5,
  })

  return NextResponse.json({
    suggestions: suggestions.suggestions,
    currentMeal: {
      id: meal.id,
      recipeName: meal.recipe?.name || meal.customName,
      date: meal.date,
      mealType: meal.mealType,
    },
  })
}
