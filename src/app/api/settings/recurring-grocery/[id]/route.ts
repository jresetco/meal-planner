import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StoreSection } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { logValidationFailure } from '@/lib/logger'

const UpdateRecurringSchema = z.object({
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  section: z.nativeEnum(StoreSection).optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

async function findOwned(itemId: string, householdId: string) {
  return prisma.recurringGroceryItem.findFirst({
    where: { id: itemId, householdId },
  })
}

// PATCH /api/settings/recurring-grocery/[id] - Update a recurring item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await findOwned(id, session.user.householdId)
  if (!existing) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const parsed = UpdateRecurringSchema.safeParse(await request.json())
  if (!parsed.success) {
    logValidationFailure('/api/settings/recurring-grocery/[id]', parsed.error)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const body = parsed.data

  const updated = await prisma.recurringGroceryItem.update({
    where: { id },
    data: {
      quantity: body.quantity === undefined ? existing.quantity : body.quantity,
      unit: body.unit === undefined ? existing.unit : (body.unit?.trim() || null),
      section: body.section ?? existing.section,
      notes: body.notes === undefined ? existing.notes : (body.notes?.trim() || null),
      isActive: body.isActive ?? existing.isActive,
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/settings/recurring-grocery/[id] - Remove a recurring item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await findOwned(id, session.user.householdId)
  if (!existing) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  await prisma.recurringGroceryItem.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
