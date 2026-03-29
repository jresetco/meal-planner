import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// GET /api/grocery-lists — lists saved grocery lists for the household (by meal plan)
export async function GET() {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lists = await prisma.groceryList.findMany({
    where: {
      mealPlan: { householdId: session.user.householdId },
    },
    include: {
      mealPlan: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
      _count: { select: { items: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(lists)
}
