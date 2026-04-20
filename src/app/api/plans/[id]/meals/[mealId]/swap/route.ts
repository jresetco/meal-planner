import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { getSuggestionsForSlot, type RecipeForPlanning } from '@/lib/ai/meal-planner'
import { isRecipeAlreadyOnDate, isSlotAfter, ymd } from '@/lib/plan-meal-slots'
import type { MealType, RecipeType, MaxFrequency } from '@/types'

export const maxDuration = 120

const SwapMealSchema = z.object({
  recipeId: z.string().max(200).optional(),
  customName: z.string().max(500).optional(),
  leftoverSourceMealId: z.string().max(200).optional(),
})

// POST /api/plans/[id]/meals/[mealId]/swap - Get AI suggestions or apply swap / leftover / custom meal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mealId: string }> }
) {
  const session = await auth()
  const { id: planId, mealId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
            include: {
              recipe: true,
              leftoverSource: { select: { date: true, mealType: true } },
            },
          },
        },
      },
    },
  })

  if (!meal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  const parsed = SwapMealSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { recipeId, customName, leftoverSourceMealId } = parsed.data

  const settings = await prisma.mealSettings.findUnique({
    where: { householdId: session.user.householdId },
  })
  const defaultPortion = settings?.defaultServings ?? 2

  if (typeof leftoverSourceMealId === 'string' && leftoverSourceMealId.length > 0) {
    const source = await prisma.plannedMeal.findFirst({
      where: {
        id: leftoverSourceMealId,
        mealPlanId: planId,
        mealPlan: { householdId: session.user.householdId },
      },
      include: { recipe: true },
    })

    if (!source) {
      return NextResponse.json({ error: 'Source meal not found' }, { status: 400 })
    }

    if (source.isLeftover) {
      return NextResponse.json(
        { error: 'Choose a cooked meal as the leftover source, not another leftover' },
        { status: 400 }
      )
    }

    const tDate = ymd(meal.date)
    const sDate = ymd(source.date)
    if (
      !isSlotAfter(sDate, source.mealType as MealType, tDate, meal.mealType as MealType)
    ) {
      return NextResponse.json(
        { error: 'Leftover must be scheduled after the original cook in meal order' },
        { status: 400 }
      )
    }

    if (
      source.recipeId &&
      isRecipeAlreadyOnDate(meal.mealPlan.plannedMeals, tDate, source.recipeId, mealId)
    ) {
      return NextResponse.json(
        {
          error:
            'That recipe is already on this day. Leftovers must be on a later calendar day.',
        },
        { status: 400 }
      )
    }

    const alloc = Math.max(1, defaultPortion)

    await prisma.mealEditHistory.create({
      data: {
        householdId: session.user.householdId,
        mealPlanId: planId,
        editType: 'SWAP',
        date: meal.date,
        mealType: meal.mealType,
        originalRecipeId: meal.recipeId,
        originalRecipeName: meal.recipe?.name || meal.customName,
        newRecipeId: source.recipeId,
        newRecipeName: source.recipe?.name || source.customName,
        aiGenerated: false,
      },
    })

    const updatedMeal = await prisma.plannedMeal.update({
      where: { id: mealId },
      data: {
        isLeftover: true,
        leftoverSourceId: source.id,
        recipeId: source.recipeId,
        customName: source.customName,
        preparedServings: null,
        servings: alloc,
      },
      include: { recipe: true },
    })

    await prisma.groceryList.updateMany({ where: { mealPlanId: planId }, data: { isStale: true } })

    return NextResponse.json({ success: true, meal: updatedMeal })
  }

  if (typeof customName === 'string' && customName.trim().length > 0 && !recipeId) {
    const name = customName.trim().slice(0, 200)

    await prisma.mealEditHistory.create({
      data: {
        householdId: session.user.householdId,
        mealPlanId: planId,
        editType: 'SWAP',
        date: meal.date,
        mealType: meal.mealType,
        originalRecipeId: meal.recipeId,
        originalRecipeName: meal.recipe?.name || meal.customName,
        newRecipeName: name,
        aiGenerated: false,
      },
    })

    const updatedMeal = await prisma.plannedMeal.update({
      where: { id: mealId },
      data: {
        recipeId: null,
        customName: name,
        isLeftover: false,
        leftoverSourceId: null,
        preparedServings: null,
        servings: Math.max(1, meal.servings),
      },
      include: { recipe: true },
    })

    await prisma.groceryList.updateMany({ where: { mealPlanId: planId }, data: { isStale: true } })

    return NextResponse.json({ success: true, meal: updatedMeal })
  }

  if (recipeId) {
    const newRecipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, name: true, imageUrl: true, servings: true },
    })

    if (!newRecipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    const targetDateStr = ymd(meal.date)
    if (isRecipeAlreadyOnDate(meal.mealPlan.plannedMeals, targetDateStr, recipeId, mealId)) {
      return NextResponse.json(
        { error: 'That recipe is already planned on this day. Pick a different recipe or day.' },
        { status: 400 }
      )
    }

    const batch = Math.max(1, newRecipe.servings || defaultPortion)
    const alloc = Math.min(Math.max(1, meal.servings), batch)

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
        aiGenerated: false,
      },
    })

    const updatedMeal = await prisma.plannedMeal.update({
      where: { id: mealId },
      data: {
        recipeId,
        customName: null,
        isLeftover: false,
        leftoverSourceId: null,
        preparedServings: batch,
        servings: alloc,
      },
      include: { recipe: true },
    })

    await prisma.groceryList.updateMany({ where: { mealPlanId: planId }, data: { isStale: true } })

    return NextResponse.json({
      success: true,
      meal: updatedMeal,
    })
  }

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
      isDynamic: m.isDynamic,
      dynamicComponents: m.dynamicComponents as any ?? null,
      isLeftover: m.isLeftover,
      leftoverFromDate: m.leftoverSource
        ? m.leftoverSource.date.toISOString().split('T')[0]
        : null,
      leftoverFromMealType: m.leftoverSource
        ? (m.leftoverSource.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER')
        : null,
      servings: m.preparedServings ?? m.servings,
      servingsUsed: m.servings,
      notes: m.notes,
    })),
  }

  const suggestions = await getSuggestionsForSlot({
    date: meal.date.toISOString().split('T')[0],
    mealType: meal.mealType as MealType,
    currentPlan,
    recipes: recipesForPlanning,
    count: 8,
  })

  const targetDateStr = ymd(meal.date)
  const recipeIdsUsedToday = new Set(
    meal.mealPlan.plannedMeals
      .filter((m) => ymd(m.date) === targetDateStr && m.id !== mealId)
      .map((m) => m.recipeId)
      .filter((id): id is string => Boolean(id))
  )
  const filteredSuggestions = suggestions.suggestions.filter(
    (s) => !recipeIdsUsedToday.has(s.recipeId)
  )

  return NextResponse.json({
    suggestions: filteredSuggestions.slice(0, 5),
    currentMeal: {
      id: meal.id,
      recipeName: meal.recipe?.name || meal.customName,
      date: meal.date,
      mealType: meal.mealType,
    },
  })
}
