import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import type { PlanStatus } from '@/types'

// GET /api/plans - List all meal plans for household
// Plan creation: POST /api/plans/generate (streaming) — single entry point for new plans.
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
      ...(status ? { status: status as PlanStatus } : {}),
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
