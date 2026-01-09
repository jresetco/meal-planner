import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// PATCH /api/plans/[id]/grocery/[itemId] - Update a grocery item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  const { id, itemId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the item belongs to user's household through the meal plan
  const item = await prisma.groceryItem.findFirst({
    where: {
      id: itemId,
      groceryList: {
        mealPlan: {
          id,
          householdId: session.user.householdId,
        },
      },
    },
  })

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const body = await request.json()
  const { isChecked } = body

  const updatedItem = await prisma.groceryItem.update({
    where: { id: itemId },
    data: {
      isChecked: isChecked ?? item.isChecked,
    },
  })

  return NextResponse.json(updatedItem)
}
