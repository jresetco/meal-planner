import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateMealPlanWithStreaming, regenerateDay, summarizeHistoricalPatterns, type RecipeForPlanning } from '@/lib/ai/meal-planner'
import {
  mergeGeneratedPlanWithLockedSlots,
  processGeneratedMealsForPersistence,
  processRegeneratedDayMeals,
  applyLeftoverLinksForPlan,
  lockedPlannedMealToGenerated,
} from '@/lib/plan-meal-validation'
import { ymd } from '@/lib/plan-meal-slots'
import type { MealType, RecipeType, MaxFrequency } from '@/types'

// POST /api/plans/[id]/regenerate - Regenerate entire plan (keeping locked meals)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id: planId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { date } = body // If date is provided, regenerate only that day

  // Get the existing plan
  const plan = await prisma.mealPlan.findFirst({
    where: {
      id: planId,
      householdId: session.user.householdId,
    },
    include: {
      plannedMeals: {
        include: { recipe: true, leftoverSource: true },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      },
    },
  })

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  // Get recipes and rules
  const [recipes, softRules, settings, historicalPlans, editHistory] = await Promise.all([
    prisma.recipe.findMany({
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
    }),
    prisma.softRule.findMany({
      where: {
        householdId: session.user.householdId,
        isActive: true,
      },
      select: { ruleText: true, priority: true, isHardRule: true },
    }),
    prisma.mealSettings.findUnique({
      where: { householdId: session.user.householdId },
    }),
    prisma.historicalPlan.findMany({
      where: { householdId: session.user.householdId },
      orderBy: { importedAt: 'desc' },
      take: 10,
    }),
    prisma.mealEditHistory.findMany({
      where: { householdId: session.user.householdId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  const recipesForPlanning: RecipeForPlanning[] = recipes.map(r => ({
    ...r,
    recipeType: (r.recipeType || 'REGULAR') as RecipeType,
    maxFrequency: (r.maxFrequency || 'WEEKLY') as MaxFrequency,
  }))

  // Get locked meals
  const lockedMeals = plan.plannedMeals.filter(m => m.isLocked)

  if (date) {
    // Regenerate single day
    const dateStr = new Date(date).toISOString().split('T')[0]
    const lockedForDayEntities = lockedMeals.filter(
      m => m.date.toISOString().split('T')[0] === dateStr
    )
    const lockedForDay = lockedForDayEntities
      .filter(m => m.recipeId)
      .map(m => ({
        mealType: m.mealType as MealType,
        recipeId: m.recipeId!,
      }))

    const currentPlan = {
      meals: plan.plannedMeals.map(m => ({
        date: m.date.toISOString().split('T')[0],
        mealType: m.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER',
        recipeId: m.recipeId,
        recipeName: m.recipe?.name || m.customName || 'Unknown',
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

    const regenerated = await regenerateDay({
      currentPlan,
      dateToRegenerate: dateStr,
      recipes: recipesForPlanning,
      softRules,
      householdSize: settings?.defaultServings || 2,
      lockedMeals: lockedForDay,
    })

    // Delete old meals for that day (except locked)
    const mealsToDelete = plan.plannedMeals.filter(
      m => m.date.toISOString().split('T')[0] === dateStr && !m.isLocked
    )
    
    await prisma.plannedMeal.deleteMany({
      where: {
        id: { in: mealsToDelete.map(m => m.id) },
      },
    })

    // Record edit history
    for (const meal of mealsToDelete) {
      await prisma.mealEditHistory.create({
        data: {
          householdId: session.user.householdId,
          mealPlanId: planId,
          editType: 'REGENERATE',
          date: meal.date,
          mealType: meal.mealType,
          originalRecipeId: meal.recipeId,
          originalRecipeName: meal.recipe?.name || meal.customName,
          aiGenerated: true,
        },
      })
    }

    const newMeals = regenerated.meals.filter(
      m => !lockedForDay.some(l => l.mealType === m.mealType)
    )

    const lockedStubs = lockedForDayEntities.map(lm =>
      lockedPlannedMealToGenerated({
        date: lm.date,
        mealType: lm.mealType as MealType,
        recipeId: lm.recipeId,
        customName: lm.customName,
        isLeftover: lm.isLeftover,
        servings: lm.servings,
        preparedServings: lm.preparedServings,
        notes: lm.notes,
        recipe: lm.recipe,
      })
    )

    const defaultPortion = settings?.defaultServings || 2
    const planStartStr = plan.startDate.toISOString().split('T')[0]
    const processedNew = processRegeneratedDayMeals(
      dateStr,
      lockedStubs,
      newMeals,
      defaultPortion,
      planStartStr
    )

    await prisma.plannedMeal.createMany({
      data: processedNew.map(m => ({
        mealPlanId: planId,
        date: m.date,
        mealType: m.mealType,
        recipeId: m.recipeId,
        customName: m.customName,
        isLeftover: m.isLeftover,
        leftoverSourceId: null,
        preparedServings: m.preparedServings,
        servings: m.servings,
        status: 'PLANNED',
        notes: m.notes,
      })),
    })

    await applyLeftoverLinksForPlan(planId, processedNew)

    // Fetch and return updated plan
    const updatedPlan = await prisma.mealPlan.findUnique({
      where: { id: planId },
      include: {
        plannedMeals: {
          include: { recipe: { select: { id: true, name: true, imageUrl: true } } },
          orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
        },
      },
    })

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
      reasoning: regenerated.reasoning,
    })
  }

  // Full plan regeneration (keeping locked meals)
  const pinnedMeals = lockedMeals.map(m => ({
    date: m.date.toISOString().split('T')[0],
    mealType: m.mealType as MealType,
    recipeId: m.recipeId!,
    recipeName: m.recipe?.name || 'Unknown',
  }))

  // Get generation params from original plan
  const genParams = plan.generationParams as {
    enabledMeals?: { breakfast: boolean; lunch: boolean; dinner: boolean }
    maxRepeats?: number
    guidelines?: string
  } || {}

  const { historicalContext, editPatterns } = summarizeHistoricalPatterns(
    historicalPlans.map(p => ({
      id: p.id,
      householdId: p.householdId,
      importedAt: p.importedAt,
      source: p.source,
      rawData: p.rawData,
      data: p.data,
      weekCount: p.weekCount,
      description: p.description,
    })),
    editHistory.map(e => ({
      id: e.id,
      householdId: e.householdId,
      mealPlanId: e.mealPlanId,
      editType: e.editType as any,
      date: e.date,
      mealType: e.mealType as any,
      originalRecipeId: e.originalRecipeId,
      originalRecipeName: e.originalRecipeName,
      newRecipeId: e.newRecipeId,
      newRecipeName: e.newRecipeName,
      reason: e.reason,
      aiGenerated: e.aiGenerated,
      createdAt: e.createdAt,
    }))
  )

  const generatedPlan = await generateMealPlanWithStreaming({
    recipes: recipesForPlanning,
    dateRange: { start: plan.startDate, end: plan.endDate },
    enabledMeals: genParams.enabledMeals || { breakfast: true, lunch: true, dinner: true },
    maxRepeats: genParams.maxRepeats || 2,
    pinnedMeals,
    skippedMeals: [],
    softRules,
    householdSize: settings?.defaultServings || 2,
    historicalContext,
    editPatterns,
    guidelines: genParams.guidelines,
  })

  // Record edit history for unlocked meals
  const unlockedMeals = plan.plannedMeals.filter(m => !m.isLocked)
  for (const meal of unlockedMeals) {
    await prisma.mealEditHistory.create({
      data: {
        householdId: session.user.householdId,
        mealPlanId: planId,
        editType: 'REGENERATE',
        date: meal.date,
        mealType: meal.mealType,
        originalRecipeId: meal.recipeId,
        originalRecipeName: meal.recipe?.name || meal.customName,
        aiGenerated: true,
      },
    })
  }

  // Delete unlocked meals
  await prisma.plannedMeal.deleteMany({
    where: {
      mealPlanId: planId,
      isLocked: false,
    },
  })

  const defaultPortion = settings?.defaultServings || 2
  const merged = mergeGeneratedPlanWithLockedSlots(
    generatedPlan.meals,
    lockedMeals.map(lm => ({
      date: lm.date,
      mealType: lm.mealType as MealType,
      recipeId: lm.recipeId,
      customName: lm.customName,
      isLeftover: lm.isLeftover,
      servings: lm.servings,
      preparedServings: lm.preparedServings,
      notes: lm.notes,
      recipe: lm.recipe,
    }))
  )
  const planStartStr = ymd(plan.startDate)
  const persisted = processGeneratedMealsForPersistence(merged, defaultPortion, planStartStr)
  const lockedSlots = new Set(lockedMeals.map(m => `${ymd(m.date)}-${m.mealType}`))
  const toInsert = persisted.filter(p => !lockedSlots.has(`${ymd(p.date)}-${p.mealType}`))

  await prisma.plannedMeal.createMany({
    data: toInsert.map(m => ({
      mealPlanId: planId,
      date: m.date,
      mealType: m.mealType,
      recipeId: m.recipeId,
      customName: m.customName,
      isLeftover: m.isLeftover,
      leftoverSourceId: null,
      preparedServings: m.preparedServings,
      servings: m.servings,
      status: 'PLANNED',
      notes: m.notes,
    })),
  })

  await applyLeftoverLinksForPlan(planId, toInsert)

  // Update plan reasoning
  await prisma.mealPlan.update({
    where: { id: planId },
    data: { aiReasoning: generatedPlan.reasoning },
  })

  // Fetch and return updated plan
  const updatedPlan = await prisma.mealPlan.findUnique({
    where: { id: planId },
    include: {
      plannedMeals: {
        include: { recipe: { select: { id: true, name: true, imageUrl: true } } },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      },
    },
  })

  return NextResponse.json({
    success: true,
    plan: updatedPlan,
    reasoning: generatedPlan.reasoning,
    leftoverSummary: generatedPlan.leftoverSummary,
  })
}
