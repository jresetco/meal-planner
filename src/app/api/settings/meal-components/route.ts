import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import type { ComponentCategory } from '@/types'

const CreateMealComponentSchema = z.object({
  category: z.enum(['PROTEIN', 'VEGGIE', 'STARCH', 'SAUCE']),
  name: z.string().min(1).max(500),
  prepMethods: z.array(z.string().max(500)).optional(),
  defaultCookTime: z.number().int().nullish(),
  typicalIngredients: z.array(z.any()).nullish(),
})

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

  const parsed = CreateMealComponentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { category, name, prepMethods, defaultCookTime, typicalIngredients } = parsed.data

  const component = await prisma.mealComponent.create({
    data: {
      householdId: session.user.householdId,
      category,
      name: name.trim(),
      prepMethods: prepMethods || [],
      defaultCookTime: defaultCookTime || null,
      ...(typicalIngredients !== undefined && typicalIngredients !== null
        ? { typicalIngredients }
        : {}),
    },
  })

  return NextResponse.json(component, { status: 201 })
}
