import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'
import { logValidationFailure } from '@/lib/logger'

const UpsertSynonymSchema = z.object({
  fromName: z.string().min(1).max(200),
  toName: z.string().min(1).max(200),
})

// GET /api/settings/ingredient-synonyms - List all synonyms for the household
export async function GET() {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await prisma.ingredientSynonym.findMany({
    where: { householdId: session.user.householdId },
    orderBy: [{ fromName: 'asc' }],
  })

  return NextResponse.json(items)
}

// POST /api/settings/ingredient-synonyms - Add or upsert a synonym
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = UpsertSynonymSchema.safeParse(await request.json())
  if (!parsed.success) {
    logValidationFailure('/api/settings/ingredient-synonyms', parsed.error)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const fromName = parsed.data.fromName.toLowerCase().trim()
  const toName = parsed.data.toName.trim()

  if (!fromName || !toName) {
    return NextResponse.json({ error: 'Both names are required' }, { status: 400 })
  }

  const item = await prisma.ingredientSynonym.upsert({
    where: {
      householdId_fromName: {
        householdId: session.user.householdId,
        fromName,
      },
    },
    create: {
      householdId: session.user.householdId,
      fromName,
      toName,
    },
    update: { toName },
  })

  return NextResponse.json(item, { status: 201 })
}
