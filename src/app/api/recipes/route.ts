import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/recipes - List all recipes for household
export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const minRating = parseInt(searchParams.get('minRating') || '0')
  const source = searchParams.get('source')
  const category = searchParams.get('category')

  const recipes = await prisma.recipe.findMany({
    where: {
      householdId: session.user.householdId,
      isActive: true,
      ...(minRating > 0 && { rating: { gte: minRating } }),
      ...(source && { source: source as any }),
      ...(category && { categories: { has: category } }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      source: true,
      rating: true,
      totalTime: true,
      prepTime: true,
      cookTime: true,
      imageUrl: true,
      categories: true,
      servings: true,
      recipeType: true,
    },
    orderBy: [
      { rating: 'desc' },
      { name: 'asc' },
    ],
  })

  return NextResponse.json(recipes)
}

// POST /api/recipes - Create a new custom recipe
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  
  const recipe = await prisma.recipe.create({
    data: {
      householdId: session.user.householdId,
      source: 'CUSTOM',
      name: body.name,
      description: body.description,
      ingredients: body.ingredients || [],
      instructions: body.instructions,
      servings: body.servings || 2,
      rating: body.rating,
      prepTime: body.prepTime,
      cookTime: body.cookTime,
      totalTime: (body.prepTime || 0) + (body.cookTime || 0) || null,
      imageUrl: body.imageUrl,
      icon: body.icon,
      categories: body.categories || [],
      notes: body.notes,
      recipeType: body.recipeType || 'REGULAR',
      maxFrequency: body.maxFrequency || 'WEEKLY',
    },
  })

  return NextResponse.json(recipe, { status: 201 })
}
