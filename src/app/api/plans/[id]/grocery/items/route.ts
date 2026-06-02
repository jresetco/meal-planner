import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StoreSection } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { logValidationFailure } from '@/lib/logger'

const CreateGroceryItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  section: z.nativeEnum(StoreSection).optional(),
})

// POST /api/plans/[id]/grocery/items - Manually add a one-off item to the active grocery list
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = CreateGroceryItemSchema.safeParse(await request.json())
  if (!parsed.success) {
    logValidationFailure('/api/plans/[id]/grocery/items', parsed.error)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const body = parsed.data

  const list = await prisma.groceryList.findFirst({
    where: {
      mealPlanId: id,
      mealPlan: { householdId: session.user.householdId },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!list) {
    return NextResponse.json({ error: 'Grocery list not found' }, { status: 404 })
  }

  const item = await prisma.groceryItem.create({
    data: {
      groceryListId: list.id,
      name: body.name.trim(),
      quantity: body.quantity ?? null,
      unit: body.unit?.trim() || null,
      section: body.section ?? StoreSection.OTHER,
      mealNames: [],
    },
  })

  return NextResponse.json(item, { status: 201 })
}
