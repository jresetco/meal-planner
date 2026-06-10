import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { StoreSection } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { logValidationFailure } from '@/lib/logger'

const UpsertRecurringSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  section: z.nativeEnum(StoreSection).optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/settings/recurring-grocery - List all recurring items (active + inactive)
export async function GET() {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await prisma.recurringGroceryItem.findMany({
    where: { householdId: session.user.householdId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json(items)
}

// POST /api/settings/recurring-grocery - Add or upsert a recurring item
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = UpsertRecurringSchema.safeParse(await request.json())
  if (!parsed.success) {
    logValidationFailure('/api/settings/recurring-grocery', parsed.error)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const body = parsed.data
  const normalizedName = body.name.toLowerCase().trim()

  const item = await prisma.recurringGroceryItem.upsert({
    where: {
      householdId_name: {
        householdId: session.user.householdId,
        name: normalizedName,
      },
    },
    create: {
      householdId: session.user.householdId,
      name: normalizedName,
      quantity: body.quantity ?? null,
      unit: body.unit?.trim() || null,
      section: body.section ?? StoreSection.OTHER,
      notes: body.notes?.trim() || null,
      isActive: body.isActive ?? true,
    },
    update: {
      quantity: body.quantity ?? null,
      unit: body.unit?.trim() || null,
      section: body.section ?? StoreSection.OTHER,
      notes: body.notes?.trim() || null,
      isActive: body.isActive ?? true,
    },
  })

  return NextResponse.json(item, { status: 201 })
}
