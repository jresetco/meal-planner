import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateMealPlan } from '@/lib/ai/meal-planner'

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER'

// GET /api/plans - List all meal plans for household
export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const plans = await prisma.mealPlan.findMany({
    where: {
      householdId: session.user.householdId,
      ...(status && { status: status as any }),
    },
    include: {
      plannedMeals: {
        include: {
          recipe: {
            select: { id: true, name: true, imageUrl: true },
          },
        },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      },
      _count: {
        select: { plannedMeals: true },
      },
    },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json(plans)
}

// POST /api/plans - Generate a new meal plan
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  
  const {
    startDate,
    endDate,
    enabledMeals = { breakfast: true, lunch: true, dinner: true },
    mealOverrides = [],
    maxRepeats = 2,
    pinnedMeals = [],
    skippedMeals = [],
  } = body

  // Get household settings and recipes
  const [settings, recipes, softRules] = await Promise.all([
    prisma.mealSettings.findUnique({
      where: { householdId: session.user.householdId },
    }),
    prisma.recipe.findMany({
      where: {
        householdId: session.user.householdId,
        isActive: true,
        rating: { gte: 3 },
      },
      select: {
        id: true,
        name: true,
        servings: true,
        rating: true,
        categories: true,
        prepTime: true,
        cookTime: true,
      },
    }),
    prisma.softRule.findMany({
      where: {
        householdId: session.user.householdId,
        isActive: true,
      },
      select: { ruleText: true, priority: true },
    }),
  ])

  if (recipes.length === 0) {
    return NextResponse.json(
      { error: 'No recipes found. Please add some recipes first.' },
      { status: 400 }
    )
  }

  // Generate the meal plan using AI
  const generatedPlan = await generateMealPlan({
    recipes,
    dateRange: { start: new Date(startDate), end: new Date(endDate) },
    enabledMeals,
    mealOverrides,
    maxRepeats,
    pinnedMeals,
    skippedMeals,
    softRules,
    householdSize: settings?.defaultServings || 2,
  })

  // Save the plan to database
  const mealPlan = await prisma.mealPlan.create({
    data: {
      householdId: session.user.householdId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'DRAFT',
      generationParams: {
        enabledMeals,
        maxRepeats,
        pinnedMeals,
        skippedMeals,
      },
      aiReasoning: generatedPlan.reasoning,
      plannedMeals: {
        create: generatedPlan.meals.map((meal) => ({
          date: new Date(meal.date),
          mealType: meal.mealType as MealType,
          recipeId: meal.recipeId,
          customName: meal.recipeId ? null : meal.recipeName,
          isLeftover: meal.isLeftover,
          servings: meal.servings,
          status: 'PLANNED',
        })),
      },
    },
    include: {
      plannedMeals: {
        include: {
          recipe: {
            select: { id: true, name: true, imageUrl: true },
          },
        },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      },
    },
  })

  return NextResponse.json(mealPlan, { status: 201 })
}
