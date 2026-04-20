import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

const UpdateRecipeSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullish(),
  ingredients: z.array(z.any()).optional(),
  instructions: z.string().max(10000).nullish(),
  servings: z.number().int().positive().optional(),
  rating: z.number().nullish(),
  prepTime: z.number().int().nullish(),
  cookTime: z.number().int().nullish(),
  imageUrl: z.string().max(2000).nullish(),
  icon: z.string().max(500).nullish(),
  categories: z.array(z.string().max(200)).optional(),
  notes: z.string().max(10000).nullish(),
  recipeType: z.enum(['STAPLE', 'REGULAR', 'SPECIAL']).optional(),
  maxFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
})

// GET /api/recipes/[id] - Get a single recipe
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const recipe = await prisma.recipe.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  return NextResponse.json(recipe)
}

// PUT /api/recipes/[id] - Update a recipe
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = UpdateRecipeSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const body = parsed.data

  const recipe = await prisma.recipe.updateMany({
    where: {
      id,
      householdId: session.user.householdId,
    },
    data: {
      name: body.name,
      description: body.description,
      ingredients: body.ingredients,
      instructions: body.instructions,
      servings: body.servings,
      rating: body.rating,
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      totalTime: (body.prepTime || 0) + (body.cookTime || 0) || null,
      imageUrl: body.imageUrl,
      icon: body.icon,
      categories: body.categories,
      notes: body.notes,
      ...(body.recipeType != null && { recipeType: body.recipeType }),
      ...(body.maxFrequency != null && { maxFrequency: body.maxFrequency }),
    },
  })

  if (recipe.count === 0) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  const updated = await prisma.recipe.findUnique({ where: { id } })
  return NextResponse.json(updated)
}

// DELETE /api/recipes/[id] - Soft delete a recipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const recipe = await prisma.recipe.updateMany({
    where: {
      id,
      householdId: session.user.householdId,
    },
    data: {
      isActive: false,
    },
  })

  if (recipe.count === 0) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
