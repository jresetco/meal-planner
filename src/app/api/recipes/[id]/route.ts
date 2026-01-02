import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

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

  const body = await request.json()

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
      categories: body.categories,
      notes: body.notes,
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
