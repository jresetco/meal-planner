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

// PATCH /api/plans/[id] - Update plan metadata (e.g. name)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await prisma.mealPlan.findFirst({
    where: { id, householdId: session.user.householdId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { name, dayNotes } = body as {
    name?: string | null
    dayNotes?: Record<string, string>
  }

  if (name === undefined && dayNotes === undefined) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  if (name !== undefined) {
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 200) : ''
    data.name = trimmed.length > 0 ? trimmed : null
  }

  if (dayNotes !== undefined) {
    // Merge with existing dayNotes so we can update one day at a time
    const existingNotes = (existing.dayNotes as Record<string, string>) ?? {}
    const merged = { ...existingNotes }
    for (const [date, note] of Object.entries(dayNotes)) {
      const trimmed = typeof note === 'string' ? note.trim().slice(0, 2000) : ''
      if (trimmed.length > 0) {
        merged[date] = trimmed
      } else {
        delete merged[date]
      }
    }
    data.dayNotes = Object.keys(merged).length > 0 ? merged : null
  }

  const updated = await prisma.mealPlan.update({
    where: { id },
    data,
  })

  return NextResponse.json(updated)
}
