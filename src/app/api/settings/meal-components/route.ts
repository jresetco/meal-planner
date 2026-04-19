import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import type { ComponentCategory } from '@/types'

// GET /api/settings/meal-components - Get all meal components
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') as ComponentCategory | null

  const components = await prisma.mealComponent.findMany({
    where: {
      householdId: session.user.householdId,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(components)
}

// POST /api/settings/meal-components - Create a meal component
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { category, name, prepMethods, defaultCookTime, typicalIngredients } = body

  if (!category || !name) {
    return NextResponse.json({ error: 'category and name are required' }, { status: 400 })
  }

  const validCategories: ComponentCategory[] = ['PROTEIN', 'VEGGIE', 'STARCH', 'SAUCE']
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const component = await prisma.mealComponent.create({
    data: {
      householdId: session.user.householdId,
      category,
      name: name.trim(),
      prepMethods: prepMethods || [],
      defaultCookTime: defaultCookTime || null,
      typicalIngredients: typicalIngredients || null,
    },
  })

  return NextResponse.json(component, { status: 201 })
}
