import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StoreSection } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { logValidationFailure } from '@/lib/logger'
import { normalizeItemName } from '@/lib/ai/grocery-generator'

const UpdateGroceryItemSchema = z.object({
  isChecked: z.boolean().optional(),
  section: z.nativeEnum(StoreSection).optional(),
  // When true (with `section`), remember this section for the item's normalized
  // name as a permanent per-household override applied to future lists.
  persistSection: z.boolean().optional(),
})

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

  const parsed = UpdateGroceryItemSchema.safeParse(await request.json())
  if (!parsed.success) {
    logValidationFailure('/api/plans/[id]/grocery/[itemId]', parsed.error)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { isChecked, section, persistSection } = parsed.data

  const updatedItem = await prisma.groceryItem.update({
    where: { id: itemId },
    data: {
      isChecked: isChecked ?? item.isChecked,
      section: section ?? item.section,
    },
  })

  // Persist a permanent per-household section override keyed by normalized name,
  // so every future generated list places this ingredient in the chosen section.
  if (persistSection && section) {
    const ingredientName = normalizeItemName(item.name)
    if (ingredientName) {
      await prisma.grocerySectionOverride.upsert({
        where: {
          householdId_ingredientName: {
            householdId: session.user.householdId,
            ingredientName,
          },
        },
        create: {
          householdId: session.user.householdId,
          ingredientName,
          section,
        },
        update: { section },
      })
    }
  }

  return NextResponse.json(updatedItem)
}

// DELETE /api/plans/[id]/grocery/[itemId] - Remove an item from the active grocery list
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  const { id, itemId } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  await prisma.groceryItem.delete({ where: { id: itemId } })

  return NextResponse.json({ success: true })
}
