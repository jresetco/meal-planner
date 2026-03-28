import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/plans/[id] - Get a single meal plan with planned meals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plan = await prisma.mealPlan.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
    include: {
      plannedMeals: {
        include: {
          recipe: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              ingredients: true,
              instructions: true,
              description: true,
              servings: true,
            },
          },
        },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      },
    },
  })

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  return NextResponse.json(plan)
}
