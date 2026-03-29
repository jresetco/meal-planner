import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

// PATCH /api/settings/rules/reorder - Batch update rule priorities
export async function PATCH(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { ruleIds } = body as { ruleIds: string[] }

  if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
    return NextResponse.json({ error: 'ruleIds array is required' }, { status: 400 })
  }

  // Verify all rules belong to this household
  const rules = await prisma.softRule.findMany({
    where: {
      id: { in: ruleIds },
      householdId: session.user.householdId,
    },
    select: { id: true },
  })

  if (rules.length !== ruleIds.length) {
    return NextResponse.json({ error: 'One or more rules not found' }, { status: 404 })
  }

  // Assign priorities in descending order (first in array = highest priority)
  const updates = ruleIds.map((id, index) =>
    prisma.softRule.update({
      where: { id },
      data: { priority: (ruleIds.length - index) * 10 },
    })
  )

  await prisma.$transaction(updates)

  return NextResponse.json({ success: true })
}
