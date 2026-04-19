import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateGroceryList } from '@/lib/ai/grocery-generator'
import type { StoreSection } from '@/types'

// GET /api/plans/[id]/grocery - Generate grocery list for a plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the meal plan with recipes (needed for both cache hit + regen, to compute whole meals)
  const mealPlan = await prisma.mealPlan.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
    include: {
      plannedMeals: {
        where: {
          status: 'PLANNED',
          isLeftover: false, // Don't count leftover ingredients
        },
        include: {
          recipe: true,
        },
      },
    },
  })

  if (!mealPlan) {
    return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
  }

  // Compute whole-meal names (meals with no recipe ingredients and not dynamic) — derived
  // on every request from the current plan state so they're never stale
  const wholeMeals: string[] = []
  for (const m of mealPlan.plannedMeals) {
    const recipeIngredients = (m.recipe?.ingredients as unknown[] | undefined) || []
    const hasRecipeIngredients = Boolean(m.recipe) && recipeIngredients.length > 0
    const hasDynamicComponents = Boolean(m.isDynamic && m.dynamicComponents)
    if (!hasRecipeIngredients && !hasDynamicComponents) {
      const name = m.recipe?.name || m.customName
      if (name) wholeMeals.push(name)
    }
  }

  // Check if grocery list already exists. If it's stale (plan changed since it was
  // generated), purge it so we regenerate from the current plan state — this prevents
  // items from swapped-out meals lingering in the list.
  const existingList = await prisma.groceryList.findUnique({
    where: { mealPlanId: id },
    include: {
      items: {
        orderBy: [{ section: 'asc' }, { name: 'asc' }],
      },
    },
  })

  if (existingList && !existingList.isStale) {
    return NextResponse.json({ ...existingList, wholeMeals })
  }

  if (existingList?.isStale) {
    await prisma.groceryList.delete({ where: { id: existingList.id } })
  }

  // Get pantry staples and meal components in parallel
  const [pantryStaples, mealComponents] = await Promise.all([
    prisma.pantryStaple.findMany({
      where: {
        householdId: session.user.householdId,
        isActive: true,
      },
      select: { ingredientName: true },
    }),
    prisma.mealComponent.findMany({
      where: {
        householdId: session.user.householdId,
        isActive: true,
      },
      select: { name: true, category: true, typicalIngredients: true },
    }),
  ])

  // Prepare meals data for AI — include only meals that actually contribute ingredients
  // (recipe-based with ingredients, or dynamic with resolved components). Meals without
  // ingredients are already captured in `wholeMeals` above.
  const meals: { name: string; ingredients: { name: string; quantity?: number | string; unit?: string }[] }[] = []

  for (const meal of mealPlan.plannedMeals) {
    if (meal.recipe) {
      const recipeIngredients = (meal.recipe.ingredients as { name: string; quantity?: number | string; unit?: string }[] | undefined) || []
      if (recipeIngredients.length === 0) continue
      meals.push({ name: meal.recipe.name, ingredients: recipeIngredients })
    } else if (meal.isDynamic && meal.dynamicComponents) {
      const components = meal.dynamicComponents as { componentName: string; category: string; prepMethod?: string | null }[]
      const mealName = meal.customName || components.map(c => c.componentName).join(' + ')
      const dynamicIngredients: { name: string; quantity?: number; unit?: string }[] = []

      for (const comp of components) {
        const dbComponent = mealComponents.find(
          mc => mc.name.toLowerCase() === comp.componentName.toLowerCase() && mc.category === comp.category
        )
        if (dbComponent?.typicalIngredients) {
          const typicals = dbComponent.typicalIngredients as { name: string; quantity?: number; unit?: string }[]
          dynamicIngredients.push(...typicals)
        } else {
          dynamicIngredients.push({ name: comp.componentName })
        }
      }

      if (dynamicIngredients.length === 0) continue
      meals.push({ name: mealName, ingredients: dynamicIngredients })
    }
  }

  if (meals.length === 0 && wholeMeals.length === 0) {
    return NextResponse.json(
      { error: 'No recipes or dynamic meals with ingredients found in this plan' },
      { status: 400 }
    )
  }

  try {
    // Generate grocery list using AI (skip if there are no ingredient-bearing meals)
    const generatedList = meals.length > 0
      ? await generateGroceryList({
          meals,
          pantryStaples: pantryStaples.map((s: { ingredientName: string }) => s.ingredientName),
        })
      : { items: [], unmergeableItems: [] }

    // Filter out staples that the AI identified
    const nonStapleItems = generatedList.items.filter(item => !item.isStaple)

    // Save to database (fresh list, not stale)
    const groceryList = await prisma.groceryList.create({
      data: {
        mealPlanId: id,
        isStale: false,
        items: {
          create: nonStapleItems.map((item) => ({
            name: item.name,
            quantity: item.mergedQuantity.amount,
            unit: item.mergedQuantity.unit,
            section: item.section as StoreSection,
            mealNames: item.mealNames,
            isChecked: false,
            isStaple: false,
          })),
        },
      },
      include: {
        items: {
          orderBy: [{ section: 'asc' }, { name: 'asc' }],
        },
      },
    })

    // Include whole meals + unmergeable items info in response for UI to handle
    return NextResponse.json({
      ...groceryList,
      wholeMeals,
      unmergeableItems: generatedList.unmergeableItems,
    }, { status: 201 })
  } catch (error) {
    console.error('Grocery list generation error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to generate grocery list: ${message}` },
      { status: 500 }
    )
  }
}

// PATCH /api/plans/[id]/grocery - Batch update grocery items (e.g. uncheck all)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const list = await prisma.groceryList.findFirst({
    where: {
      mealPlanId: id,
      mealPlan: { householdId: session.user.householdId },
    },
  })

  if (!list) {
    return NextResponse.json({ error: 'Grocery list not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { uncheckAll } = body as { uncheckAll?: boolean }

  if (uncheckAll) {
    await prisma.groceryItem.updateMany({
      where: { groceryListId: list.id, isChecked: true },
      data: { isChecked: false },
    })
  }

  return NextResponse.json({ success: true })
}

// POST /api/plans/[id]/grocery - Regenerate grocery list
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the plan belongs to user
  const mealPlan = await prisma.mealPlan.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!mealPlan) {
    return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 })
  }

  // Delete existing list
  await prisma.groceryList.deleteMany({
    where: { mealPlanId: id },
  })

  // Regenerate by calling GET logic
  return GET(request, { params })
}
