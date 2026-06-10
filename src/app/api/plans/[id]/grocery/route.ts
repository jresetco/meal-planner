import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { generateGroceryList, mergeRecurringItems, normalizeItemName } from '@/lib/ai/grocery-generator'
import { logger, logValidationFailure } from '@/lib/logger'
import type { StoreSection } from '@/types'

// Build a structured error response. Prisma's "table does not exist" (P2021)
// is the most useful one to distinguish — it means the runtime image is ahead
// of the database schema (someone deployed without running `prisma db push`),
// which the user-facing UI can surface specifically instead of a blank list.
function buildGroceryError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
    return {
      status: 503,
      body: {
        error: 'Database schema is out of date. The deploy likely skipped `prisma db push`. Apply the migration and reload.',
        code: 'GROCERY_SCHEMA_OUT_OF_DATE',
      },
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      body: {
        error: 'Cannot reach the database. Check DATABASE_URL and retry.',
        code: 'GROCERY_DB_UNREACHABLE',
      },
    }
  }
  const message = error instanceof Error ? error.message : 'Unknown error'
  return {
    status: 500,
    body: {
      error: `Failed to load grocery list: ${message}`,
      code: 'GROCERY_LOAD_FAILED',
    },
  }
}

export const maxDuration = 300

const UpdateGroceryListSchema = z.object({
  uncheckAll: z.boolean().optional(),
  checkedWholeMeals: z.array(z.string().min(1).max(500)).max(200).optional(),
})

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

  try {
    return await handleGroceryGet(id, session.user.householdId)
  } catch (error) {
    logger.error('grocery_get_failed', {
      route: '/api/plans/[id]/grocery',
      planId: id,
      err: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    })
    const { status, body } = buildGroceryError(error)
    return NextResponse.json(body, { status })
  }
}

async function handleGroceryGet(id: string, householdId: string) {
  // Get the meal plan with recipes (needed for both cache hit + regen, to compute whole meals)
  const mealPlan = await prisma.mealPlan.findFirst({
    where: {
      id,
      householdId,
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
    return NextResponse.json({ error: 'Meal plan not found', code: 'GROCERY_PLAN_NOT_FOUND' }, { status: 404 })
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

  // Get pantry staples, meal components, and recurring items in parallel
  const [pantryStaples, mealComponents, recurringItems] = await Promise.all([
    prisma.pantryStaple.findMany({
      where: {
        householdId,
        isActive: true,
      },
      select: { ingredientName: true },
    }),
    prisma.mealComponent.findMany({
      where: {
        householdId,
        isActive: true,
      },
      select: { name: true, category: true, typicalIngredients: true },
    }),
    prisma.recurringGroceryItem.findMany({
      where: {
        householdId,
        isActive: true,
      },
      select: { name: true, quantity: true, unit: true, section: true },
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
        // Robust match against MealComponent rows. Try, in order:
        //   1. exact case-insensitive name + same category (original behavior)
        //   2. normalized name (singular/plural + prep-modifier insensitive) +
        //      same category — catches "Grilled Chicken Breast" vs "Chicken Breast"
        //   3. normalized name alone (category drifted) as a last resort.
        // Unresolved components ALWAYS still fall through to a bare ingredient so
        // a protein like chicken can never silently vanish from the meals array.
        const compNorm = normalizeItemName(comp.componentName)
        const dbComponent =
          mealComponents.find(
            mc => mc.name.toLowerCase() === comp.componentName.toLowerCase() && mc.category === comp.category
          ) ||
          mealComponents.find(
            mc => normalizeItemName(mc.name) === compNorm && mc.category === comp.category
          ) ||
          mealComponents.find(mc => normalizeItemName(mc.name) === compNorm)
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
      { error: 'No recipes or dynamic meals with ingredients found in this plan', code: 'GROCERY_NO_MEALS' },
      { status: 400 }
    )
  }

  // Generate grocery list using AI (skip if there are no ingredient-bearing meals).
  // Errors here bubble to the outer try/catch in GET — Prisma errors, AI errors,
  // and validation errors all flow through buildGroceryError.
  const generatedList = meals.length > 0
    ? await generateGroceryList({
        meals,
        pantryStaples: pantryStaples.map((s: { ingredientName: string }) => s.ingredientName),
      })
    : { items: [], unmergeableItems: [] }

  // Persist BOTH active items and staple-excluded items. The UI splits them
  // into separate views ("Excluded by pantry" tab) so users can verify what
  // got hidden — fixes the past pain of items silently disappearing.
  const activeAiItems = generatedList.items.filter(item => !item.isStaple)
  const excludedAiItems = generatedList.items.filter(item => item.isStaple)

  // Merge in active recurring grocery items (bug 4). Matching is singular/
  // plural-insensitive, and on a match the recipe item is KEPT — we append
  // "Recurring" to its mealNames and reconcile quantity (sum on same unit incl.
  // count, max on differing units). Unmatched recurring items are appended.
  const mergedActive = mergeRecurringItems(
    activeAiItems.map(item => ({
      name: item.name,
      quantity: item.mergedQuantity.amount,
      unit: item.mergedQuantity.unit,
      section: item.section as StoreSection,
      mealNames: item.mealNames,
      isStaple: false,
    })),
    recurringItems.map(r => ({
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      section: r.section as StoreSection,
    }))
  )

  // Save to database (fresh list, not stale)
  const groceryList = await prisma.groceryList.create({
    data: {
      mealPlanId: id,
      isStale: false,
      items: {
        create: [
          ...mergedActive.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            section: item.section,
            mealNames: item.mealNames,
            isChecked: false,
            isStaple: false,
          })),
          ...excludedAiItems.map((item) => ({
            name: item.name,
            quantity: item.mergedQuantity.amount,
            unit: item.mergedQuantity.unit,
            section: item.section as StoreSection,
            mealNames: item.mealNames,
            isChecked: false,
            isStaple: true,
          })),
        ],
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

  const parsed = UpdateGroceryListSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    logValidationFailure('/api/plans/[id]/grocery', parsed.error)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { uncheckAll, checkedWholeMeals } = parsed.data

  if (uncheckAll) {
    await prisma.groceryItem.updateMany({
      where: { groceryListId: list.id, isChecked: true },
      data: { isChecked: false },
    })
    await prisma.groceryList.update({
      where: { id: list.id },
      data: { checkedWholeMeals: [] },
    })
  }

  if (checkedWholeMeals !== undefined) {
    await prisma.groceryList.update({
      where: { id: list.id },
      data: { checkedWholeMeals },
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
