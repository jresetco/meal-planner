import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

const CreateStapleSchema = z.object({
  ingredientName: z.string().min(1).max(500),
})

// GET /api/settings/staples - Get all pantry staples
export async function GET() {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const staples = await prisma.pantryStaple.findMany({
    where: { householdId: session.user.householdId },
    orderBy: { ingredientName: 'asc' },
  })

  return NextResponse.json(staples)
}

// POST /api/settings/staples - Add a pantry staple
export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = CreateStapleSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const body = parsed.data

  const staple = await prisma.pantryStaple.upsert({
    where: {
      householdId_ingredientName: {
        householdId: session.user.householdId,
        ingredientName: body.ingredientName.toLowerCase().trim(),
      },
    },
    create: {
      householdId: session.user.householdId,
      ingredientName: body.ingredientName.toLowerCase().trim(),
      isActive: true,
    },
    update: {
      isActive: true,
    },
  })

  return NextResponse.json(staple, { status: 201 })
}

// DELETE /api/settings/staples - Remove a pantry staple
export async function DELETE(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ingredientName = searchParams.get('name')

  if (!ingredientName) {
    return NextResponse.json({ error: 'Missing ingredient name' }, { status: 400 })
  }

  await prisma.pantryStaple.updateMany({
    where: {
      householdId: session.user.householdId,
      ingredientName: ingredientName.toLowerCase().trim(),
    },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
