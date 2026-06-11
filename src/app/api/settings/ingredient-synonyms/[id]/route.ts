import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

async function findOwned(itemId: string, householdId: string) {
  return prisma.ingredientSynonym.findFirst({
    where: { id: itemId, householdId },
  })
}

// DELETE /api/settings/ingredient-synonyms/[id] - Remove a synonym
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

  await prisma.ingredientSynonym.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
