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

  // Check if grocery list already exists
  const existingList = await prisma.groceryList.findUnique({
    where: { mealPlanId: id },
    include: {
      items: {
        orderBy: [{ section: 'asc' }, { name: 'asc' }],
      },
    },
  })

  if (existingList) {
    return NextResponse.json(existingList)
  }

  // Get the meal plan with recipes
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

  // Prepare meals data for AI — include both recipe-based and dynamic meals
  const meals: { name: string; ingredients: { name: string; quantity?: number | string; unit?: string }[] }[] = []

  // Recipe-based meals
  for (const meal of mealPlan.plannedMeals) {
    if (meal.recipe) {
      meals.push({
        name: meal.recipe.name,
        ingredients: (meal.recipe.ingredients as { name: string; quantity?: number | string; unit?: string }[]) || [],
      })
    } else if (meal.isDynamic && meal.dynamicComponents) {
      // Dynamic meals — gather ingredients from component typicalIngredients
      const components = meal.dynamicComponents as { componentName: string; category: string; prepMethod?: string | null }[]
      const mealName = meal.customName || components.map(c => c.componentName).join(' + ')
      const dynamicIngredients: { name: string; quantity?: number; unit?: string }[] = []

      // Look up typicalIngredients for each component
      for (const comp of components) {
        const dbComponent = mealComponents.find(
          mc => mc.name.toLowerCase() === comp.componentName.toLowerCase() && mc.category === comp.category
        )
        if (dbComponent?.typicalIngredients) {
          const typicals = dbComponent.typicalIngredients as { name: string; quantity?: number; unit?: string }[]
          dynamicIngredients.push(...typicals)
        } else {
          // Fallback: just add the component name as an ingredient
          dynamicIngredients.push({ name: comp.componentName })
        }
      }

      meals.push({ name: mealName, ingredients: dynamicIngredients })
    }
  }

  if (meals.length === 0) {
    return NextResponse.json(
      { error: 'No recipes or dynamic meals with ingredients found in this plan' },
      { status: 400 }
    )
  }

  try {
    // Generate grocery list using AI
    const generatedList = await generateGroceryList({
      meals,
      pantryStaples: pantryStaples.map((s: { ingredientName: string }) => s.ingredientName),
    })

    // Filter out staples that the AI identified
    const nonStapleItems = generatedList.items.filter(item => !item.isStaple)

    // Save to database
    const groceryList = await prisma.groceryList.create({
      data: {
        mealPlanId: id,
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

    // Include unmergeable items info in response for UI to handle
    return NextResponse.json({
      ...groceryList,
      unmergeableItems: generatedList.unmergeableItems,
    }, { status: 201 })
  } catch (error) {
    console.error('Grocery list generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate grocery list. Please try again.' },
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
