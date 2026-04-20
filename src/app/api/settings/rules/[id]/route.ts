import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db'

const UpdateRuleSchema = z.object({
  ruleText: z.string().min(1).max(10000).optional(),
  isActive: z.boolean().optional(),
  isHardRule: z.boolean().optional(),
  priority: z.number().int().optional(),
})

// PATCH /api/settings/rules/:id - Update a soft rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = UpdateRuleSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }
  const body = parsed.data

  // Verify rule belongs to user's household
  const existing = await prisma.softRule.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  const rule = await prisma.softRule.update({
    where: { id },
    data: {
      ruleText: body.ruleText ?? existing.ruleText,
      isActive: body.isActive ?? existing.isActive,
      isHardRule: body.isHardRule ?? existing.isHardRule,
      priority: body.priority ?? existing.priority,
    },
  })

  return NextResponse.json(rule)
}

// DELETE /api/settings/rules/:id - Delete a soft rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const { id } = await params
  
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify rule belongs to user's household
  const existing = await prisma.softRule.findFirst({
    where: {
      id,
      householdId: session.user.householdId,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  await prisma.softRule.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
